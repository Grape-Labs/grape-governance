import { Transaction } from '@solana/web3.js';

export function batchInstructionDraft(payload: any) {
  if (!Array.isArray(payload?.ix) || !payload.ix.length) throw new Error('The batch contains no instructions');
  return {
    type: payload.title,
    description: payload.description,
    governanceInstructions: new Transaction().add(...payload.ix),
    authorInstructions: payload.aix?.length ? new Transaction().add(...payload.aix) : null,
  };
}
