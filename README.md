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
