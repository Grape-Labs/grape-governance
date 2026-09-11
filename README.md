# Governance.so

Governance.so by Grape is a fast SPL Governance interface focused on proposal execution, treasury operations, and DAO automation on Solana.

## Key Features

- Indexed governance browsing with fast proposal/member loading.
- Proposal builder with multi-instruction queueing.
- Treasury wallet operations with governance-native instruction flow.
- Extension system for protocol-specific actions.
- Governance stats, participation views, and realtime monitoring.

## Governance Tooling (Extensions)

### Governance Tools

- Governance config updates.
- DAO decommission workflows.
- Create treasury wallet proposal helpers.

### Proposal Builder

- Draft proposal creation.
- Poll proposal creation.
- Custom instruction builder with simulation flow.
- Memo instruction builder.
- Queue-only mode for staged instruction building.

### Treasury Operations

- Send and batch send (SOL/SPL).
- Token manager (create/mint/update authority flows).
- Program authority manager:
  - Queue authority transfer/revoke.
  - Queue program upgrade.
  - Queue close buffer.
  - Direct wallet-to-treasury funding.
- Token housekeeping (burn/close flows).
- Validator staking operations.

### DeFi & Automation

- Jupiter swap.
- Jupiter DCA.
- Streamflow instruction integration.
- Sanctum LST swap integration (shown only when `APP_SANCTUM_API_KEY` is configured).

### Identity & Claims

- Token metadata proposal workflows.
- Mythic metadata workflows.
- SNS domain workflows.
- Directory + claim integrations.

### IntraDAO

- IntraDAO action flows.
- OG Reputation Spaces integration:
  - Initialize/set authority/season/decay/rep mint.
  - Add points, reset, transfer, close reputation.
  - Batch add points via CSV (`wallet,amount` or `wallet` defaults to 1).
  - DAO ID quick set (`Use Treasury`, `Use Realm`) and random DAO ID generator.
  - REP mint creation helper (creates mint and transfers mint authority to treasury wallet).

## Core URLs

- Realtime: `https://governance.so/realtime`
- Profile: `https://governance.so/profile`
- Admin: `https://governance.so/admin`

## Tech Stack

- SPL Governance
- Solana Wallet Adapter
- React + Material UI
- GraphQL + indexed account queries
- Protocol SDK integrations (Jupiter, Streamflow, Sanctum, Vine Reputation)

## Local Development

```bash
yarn install
yarn start
```

Build:

```bash
yarn build
```

Optional env flags used by specific extensions:

- `APP_SANCTUM_API_KEY` (enables Sanctum extension UI)
- `REACT_APP_SOLANA_CLUSTER` (`mainnet` or `devnet`, defaults to `mainnet`)


### Proposal link previews

Vercel routes `/proposal/:realm/:proposal` and `/embedproposal/:realm/:proposal`
through `api/proposal-preview.js`. It injects proposal metadata into the built
app shell, so Discord and other crawlers receive it without running JavaScript.
`api/proposal-image.js` renders a 1200 × 630 PNG with the title, DAO, and status.
Both read Solana directly, including draft proposals that are not indexed yet.

Set `SOCIAL_RPC_ENDPOINT` in the Vercel server environment to a working mainnet
Solana RPC URL. Configured Shyft, Helius, QuickNode, Alchemy, and Flux endpoints are
tried automatically if a provider fails, with the public mainnet RPC last.
Each attempt has a two-second timeout within a 6.5-second total budget. `SITE_ORIGIN` defaults to
`https://governance.so`. Successful previews are cached for 60 seconds; missing
accounts and RPC failures return an uncached address-only preview.

Deploy the application to activate these routes. Previously shared Discord
links may retain their cached preview; share a fresh URL (for example, append
`?preview=2`) when verifying the deployment.

Run the preview tests with Node 22.3+ or Node 24:

```sh
node --experimental-test-module-mocks --test tests/proposal-preview.test.mjs
```

### Grant tracking

Open **DAO → Treasury → Grant tracking**. Grape defaults to the designated
`6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD` distribution wallet. Choose
**Find grants**, load older pages as needed, and select a recipient's
**Activity** to inspect swaps, outgoing transfers, wallet balance, and transaction
links. Standard SPL Governance deposits are attributed to the beneficiary named
in the deposit instruction, including Grape's direct-to-governance distributions.
The recipient table separates tokens granted to wallets from tokens granted into
governance. The latter grant governance power without crediting the member's
liquid wallet balance; they are included once in total tokens granted.

This is an on-demand tracker, not a background index: each page scans up to 100
provider transactions. Totals cover loaded history only. Grant transactions are not automatically linked to their authorizing proposal. Swap totals
are wallet activity from the earliest loaded grant date, not proof that specific
granted tokens were sold. Only decoded swaps with the recipient's community-token
input count as confirmed swaps; other outgoing transfers stay separate. Balances
exclude governance deposits, staking, escrow, and other wallets.

The **≥10% swap review** compares each confirmed swap transaction with the
member's native community-token deposit position in the selected DAO, not their
liquid wallet balance. A withdrawal preserves the position immediately before
withdrawal as the review basis until a subsequent deposit or revocation updates
it. Transfers alone are never flagged. Percentages can exceed 100% and do not
prove which tokens were sold.

Opening recipient activity also scans the member's token-owner-record history,
including third-party grants. The scan must finish and reconcile with a finalized
on-chain deposit snapshot before percentages are shown. The initial scan loads up
to five pages; use **Continue governance history scan** when more are needed.
Incomplete, unreconciled, zero-basis, and ambiguous same-slot histories show an
unavailable assessment. Voting-plugin positions and nonstandard governance/token
programs are not supported by this review. Recipient badges reflect only inspected
activity and are not a background scan of all members.

Configure `REACT_APP_API_HELIUS` on the server. Grant tracking uses only this
key for history and balance requests, with no alternate-key or RPC-URL fallback.
The endpoint never returns the key to the client. History coverage depends on
the provider's parser and retained/indexed history.

Run checks with `node --test tests/grant-tracking.test.mjs tests/grant-provider.test.mjs tests/swap-threshold.test.mjs`.

If grant tracking fails on Vercel, check `REACT_APP_API_HELIUS` in the
**Production** environment and redeploy. A working local `.env` does not configure
a Vercel deployment. Error codes distinguish missing configuration, denied access,
rate limits, timeouts, and upstream failures; no credentials are included in errors.
Requests allow eight seconds; the Vercel function duration is set to 30 seconds.
