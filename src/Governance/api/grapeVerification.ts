import { PublicKey } from '@solana/web3.js';
export const GRAPE_VERIFICATION_PROGRAM_ID = new PublicKey('VrFyyRxPoyWxpABpBXU4YUCCF9p8giDSJUv2oXfDr5q');
export function parseVerificationSpace(data: Uint8Array) {
    if (data.length < 139) throw new Error('Invalid Grape Verification space account');
    let offset = 9;
    const daoId = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const authority = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const attestor = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const isFrozen = data[offset] === 1; offset += 2;
    const salt = data.slice(offset, offset + 32);
    return { daoId, authority, attestor, isFrozen, salt };
}

export function deriveVerificationSpacePda(daoId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('space'), daoId.toBuffer()],
        GRAPE_VERIFICATION_PROGRAM_ID,
    );
}

export async function hashVerificationWallet(salt: Uint8Array, wallet: PublicKey): Promise<Uint8Array> {
    const domain = new TextEncoder().encode('wallet');
    const input = new Uint8Array(salt.length + domain.length + 32);
    input.set(salt, 0);
    input.set(domain, salt.length);
    input.set(wallet.toBytes(), salt.length + domain.length);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
}

export function parseVerificationLink(data: Uint8Array) {
    if (data.length !== 88) throw new Error('Invalid Grape Verification link account');
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return {
        identity: new PublicKey(data.slice(9, 41)),
        walletHash: data.slice(41, 73),
        linkedAt: Number(view.getBigInt64(73, true)),
    };
}

export function parseVerificationIdentity(data: Uint8Array) {
    if (data.length < 124) throw new Error('Invalid Grape Verification identity account');
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 9;
    const space = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const platform = view.getUint8(offset); offset += 33;
    const verified = view.getUint8(offset) === 1; offset += 1;
    const verifiedAt = Number(view.getBigInt64(offset, true)); offset += 8;
    const expiresAt = Number(view.getBigInt64(offset, true)); offset += 8;
    const attestedBy = new PublicKey(data.slice(offset, offset + 32));
    return { space, platform, verified, verifiedAt, expiresAt, attestedBy };
}

