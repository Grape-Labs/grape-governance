// Chunk each payload separately: never flatten away atomic groups from builders.
export function queuedInstructionGroups(queue: any[], normalize: (value: any) => any[]) {
  return (Array.isArray(queue) ? queue : []).flatMap(item => {
    const instructions = normalize(item?.payload?.ix);
    const requested = Number(item?.payload?.proposalInstructionChunkBy ?? 1);
    if (!Number.isSafeInteger(requested) || requested < 1) throw new Error('Invalid queued instruction group size');
    const groups: any[][] = [];
    for (let offset = 0; offset < instructions.length; offset += requested) groups.push(instructions.slice(offset, offset + requested));
    return groups;
  });
}
