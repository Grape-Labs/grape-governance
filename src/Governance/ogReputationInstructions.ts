import { Buffer } from 'buffer';
import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import { ixDiscriminator } from '@grapenpm/vine-reputation-client';

const names = ['initializeConfig', 'upsertProjectMetadata', 'setAuthority', 'setSeason', 'setDecayBps', 'setRepMint', 'addReputation', 'transferReputation', 'closeReputation', 'closeConfig', 'adminCloseAny'];
const discriminators = Promise.all(names.map(async name => [name, Buffer.from(await ixDiscriminator(name)).toString('hex')]));

// Decode only the bytes and accounts voters will authorize; never infer intent from proposal text.
export async function describeOgReputationInstruction(ix: any) {
  const data = Buffer.from(ix.data || []);
  const base = { type: 'OG Reputation', data: ix.data, hex: data.toString('hex'), base64: data.toString('base64') };
  const account = (i: number) => {
    const key = (ix.accounts || ix.keys || [])[i]?.pubkey;
    if (!key) throw new Error('Missing account');
    return key.toBase58?.() || String(key);
  };
  try {
    const name = (await discriminators).find(([, hex]) => hex === data.subarray(0, 8).toString('hex'))?.[0];
    const expected = { initializeConfig: 74, setAuthority: 40, setSeason: 10, setDecayBps: 10, setRepMint: 40, addReputation: 16, transferReputation: 8, closeReputation: 10, closeConfig: 8, adminCloseAny: 8 }[name || ''];
    if (!name || (expected !== undefined && data.length !== expected)) throw new Error('Unsupported layout');
    const pk = (offset: number) => new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    let description: string;
    switch (name) {
      case 'initializeConfig': description = `Initialize reputation space ${pk(8)} with REP mint ${pk(40)}, season ${data.readUInt16LE(72)} and authority ${account(1)}`; break;
      case 'setAuthority': description = `Transfer control of reputation space ${account(0)} from ${account(1)} to ${pk(8)}. The new authority can manage reputation and space settings.`; break;
      case 'setSeason': description = `Set reputation space ${account(0)} to season ${data.readUInt16LE(8)}`; break;
      case 'setDecayBps': description = `Set reputation decay to ${data.readUInt16LE(8) / 100}% (${data.readUInt16LE(8)} basis points) for space ${account(0)}`; break;
      case 'setRepMint': description = `Change REP mint to ${pk(8)} for reputation space ${account(0)}`; break;
      case 'addReputation': description = `Set reputation total to ${new BN(data.subarray(8, 16), 'le').toString(10)} points for wallet ${account(2)} (reputation account ${account(3)}, space ${account(0)}). This is the stored total, including any points calculated when the proposal was created.`; break;
      case 'transferReputation': description = `Transfer reputation from wallet ${account(2)} to ${account(3)} in space ${account(0)}`; break;
      case 'closeReputation': description = `Close reputation for wallet ${account(2)}, season ${data.readUInt16LE(8)}, in space ${account(0)}; return account rent to ${account(4)}`; break;
      case 'closeConfig': description = `Close reputation space configuration ${account(0)}; return account rent to ${account(2)}`; break;
      case 'adminCloseAny': description = `Administratively close account ${account(1)}; return account rent to ${account(2)}`; break;
      case 'upsertProjectMetadata': {
        if (data.length < 12 || data.length !== 12 + data.readUInt32LE(8)) throw new Error('Invalid URI layout');
        description = `Update metadata URI to ${data.subarray(12).toString('utf8')} for reputation space ${account(0)}`;
        break;
      }
      default: throw new Error('Unknown instruction');
    }
    return { ...base, op: name, description };
  } catch {
    return { ...base, description: 'Unrecognized or malformed OG Reputation instruction. Inspect raw data and accounts before voting.' };
  }
}
