import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { fetchConfig, fetchReputation, fetchReputationsForDaoSeason } from '@grapenpm/vine-reputation-client';
import { GRAPE_VERIFICATION_PROGRAM_ID, deriveVerificationSpacePda, parseVerificationSpace, hashVerificationWallet, parseVerificationLink, parseVerificationIdentity } from './grapeVerification';

export const GRAPE_PROPOSAL_REALM = 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
export async function checkGrapeVerification(connection: any, realm: PublicKey, wallet: PublicKey) {
    const [spacePda] = deriveVerificationSpacePda(realm);
    const account = await connection.getAccountInfo(spacePda, 'confirmed');
    if (!account || !account.owner.equals(GRAPE_VERIFICATION_PROGRAM_ID)) throw new Error('Grape Verification is unavailable.');
    const space = parseVerificationSpace(account.data);
    if (!space.daoId.equals(realm) || space.isFrozen) throw new Error('Grape Verification is unavailable or frozen.');
    const hash = await hashVerificationWallet(space.salt, wallet);
    const accounts = await connection.getProgramAccounts(GRAPE_VERIFICATION_PROGRAM_ID, {
      commitment: 'confirmed', filters: [{ dataSize: 88 }, { memcmp: { offset: 41, bytes: bs58.encode(hash) } }],
    });
    const links = accounts.map(({ account }: any) => parseVerificationLink(account.data))
      .filter((link: any) => Buffer.from(link.walletHash).equals(Buffer.from(hash)));
    const identities = links.length ? await connection.getMultipleAccountsInfo(links.map((link: any) => link.identity), 'confirmed') : [];
    const verified = identities.some((identityAccount: any) => {
      if (!identityAccount?.owner.equals(GRAPE_VERIFICATION_PROGRAM_ID)) return false;
      const identity = parseVerificationIdentity(identityAccount.data);
      return identity.space.equals(spacePda) && identity.verified && (identity.expiresAt === 0 || identity.expiresAt > Date.now() / 1000);
    });
    if (!verified) throw new Error('An active Grape DAO verification is required to create a proposal.');
    return 'Active verification';
}

export async function checkGrapeReputation(connection: any, realm: PublicKey, wallet: PublicKey) {
    const config = await fetchConfig(connection, realm);
    if (!config?.daoId?.equals(realm)) throw new Error('Grape DAO reputation is unavailable.');
    let season = Number(config.currentSeason);
    const rows = await fetchReputationsForDaoSeason({ conn: connection, daoId: realm, season, commitment: 'confirmed', limit: 10000 });
    if (!rows.some(row => BigInt(row.points || 0) > 0n) && season > 1) season -= 1;
    const reputation = await fetchReputation(connection, realm, wallet, season);
    if (BigInt(reputation?.points || 0) <= 0n) throw new Error(`Positive Grape DAO reputation in season ${season} is required to create a proposal.`);    return `${reputation.points} points · season ${season}`;
}

export async function getGrapeProposalEligibility(connection: any, realm: PublicKey, wallet: PublicKey) {
  const [verification, reputation] = await Promise.allSettled([
    checkGrapeVerification(connection, realm, wallet),
    checkGrapeReputation(connection, realm, wallet),
  ]);
  const status = (result: PromiseSettledResult<string>) => result.status === 'fulfilled'
    ? { passed: true, message: result.value }
    : { passed: false, message: result.reason instanceof Error ? result.reason.message : 'Check unavailable. Please retry.' };
  return { verification: status(verification), reputation: status(reputation) };
}

export async function assertGrapeProposalEligibility(connection: any, realm: PublicKey, wallet: PublicKey) {
  if (realm.toBase58() !== GRAPE_PROPOSAL_REALM) return;
  if (!wallet) throw new Error('Connect a wallet to check Grape DAO proposal eligibility.');
  const checks = await getGrapeProposalEligibility(connection, realm, wallet);
  const failures = [checks.verification, checks.reputation].filter(check => !check.passed);
  if (failures.length) throw new Error(`Grape DAO proposal creation blocked: ${failures.map(check => check.message).join(' ')}`);
}
