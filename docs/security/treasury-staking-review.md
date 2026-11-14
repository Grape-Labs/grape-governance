# Treasury staking code review — 2026-11-15

Scope: native StakeValidatorView builders, instruction queue forwarding through IntraDAOView, proposal instruction grouping, and governance execution source. This is a source review and local regression testing, not a deployed-program audit or an on-chain execution test.

## Funds and authorities

- Newly created stake accounts are derived with the treasury as base and the native Stake Program as owner. Initialization assigns both staker and withdrawer to the treasury. Delegation names a validator vote account, not a withdrawal recipient.
- Deactivation does not send funds or assign withdrawal authority.
- Withdraw, close, and harvest instructions name the treasury as both authority and recipient.
- Partial unstaking inherits source authorities. It now starts with a native Withdrawer authorization instruction assigning the SAME treasury address. This proves withdrawal control at execution, not merely from the RPC response, and fails atomically if the source withdrawer differs. The source must also have treasury staker authority for the subsequent split and deactivate.

## Findings and fixes

1. **Atomicity gap in queued proposals:** IntraDAO flattened all queued instructions and stored each separately, ignoring the builder's proposalInstructionChunkBy. For stake creation this could expose an uninitialized account between executions. Preserve payload groups when inserting transactions. Creation/initialization/delegation must remain one executable transaction; likewise the authority guard/create/split/deactivate sequence.
2. **Partial split builder discarded instructions:** extractInstruction(StakeProgram.split(...)) returned the first SDK instruction (account creation), not Split. The new builder creates a treasury-seeded destination, selects and verifies the actual native Split instruction, then deactivates that destination.
3. **Existing account reuse and incomplete ownership checks:** new stake creation now refuses any already-existing derived account; use a new seed instead. Existing source management checks native program ownership and fails closed on missing or external withdrawal authority; deactivate/split additionally require treasury staker authority. Withdraw/harvest repeat authority checks before building.
4. The generic single-instruction adapter now rejects multi-instruction SDK transactions instead of silently discarding all but their first instruction.

## Governance and network boundaries

Reviewed standard SPL Governance source executes instructions stored in the proposal transaction account and verifies proposal/governance association and execution eligibility. An execution caller cannot replace stored withdrawal destinations simply by submitting different instruction data. Transaction signatures protect signed bytes against network alteration. These properties depend on the actual deployed program matching its expected implementation.

A compromised frontend, malicious RPC response, compromised governance upgrade authority, or governance approval of malicious instructions is outside a blanket safety guarantee. Client checks alone are not on-chain security guarantees. The native program enforces signatures and authorities; the split guard above adds an execution-time check on inherited withdrawal control.

Existing on-chain proposals and previously created external drafts are unchanged. Review their complete stored instruction groups, both stake authorities, withdrawal recipients, and program IDs before voting or execution. Recreate affected stake creation/split proposals that were inserted as separate transactions.

## Validation

Local regression tests decode actual web3 SDK instructions to verify treasury seed/base, stake-program ownership, both initialized authorities, validator target, actual Split, same-address Withdrawer guard, grouped forwarding, rejection of existing derived accounts and external/missing authorities. Tests also cover withdrawal destination construction. No live transactions were submitted.

References:
- https://solana.com/docs/references/staking/stake-accounts
- https://raw.githubusercontent.com/solana-labs/solana-program-library/master/governance/program/src/processor/process_execute_transaction.rs

## Follow-up: atomic existing-account delegation and activation state

- Added Stake → “Stake existing account / Change validator”. It verifies treasury staker and withdrawer authority, requires verified inactive state (or a native initialized account), verifies the validator is owned by the native Vote Program, simulates the proposal, and groups same-address Withdrawer authorization plus Delegate in one executable transaction. No withdrawal or account recreation occurs.
- Fixed RPC stake parsing: account type is at `data.parsed.type`, not `data.parsed.info.type`. Runtime activation state takes precedence over raw delegation stake; fully cooled accounts may still retain raw delegated principal in their data.
- Activation RPC failures do not become inactive confirmations. UI shows Delegated/Cooldown unverified/State unavailable; changing validators and full account closure fail closed when inactivity cannot be verified. Ordinary withdrawal remains subject to native Stake Program runtime checks.
- Corrected cooldown copy: completion is not guaranteed at the next epoch boundary.
- Added tests for real RPC data shape, runtime inactive overrides, unavailable activation methods, authority preservation, validator ownership, and single governance execute transaction serialization within the network packet size.
- Fourteen targeted tests pass. Full repository type checking still reports unrelated existing errors; no errors were reported in the changed stake-management files. Live chain execution and deployed-program verification remain outstanding.
