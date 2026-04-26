# Governance.so UI Documentation

## Overview

`Governance.so` is a Solana governance interface focused on:

- DAO discovery and monitoring
- proposal review and voting
- treasury operations
- governance automation via extensions
- member and participation analytics

Current app version in `package.json`: `1.2.11`.

---

## What We Have Built

### Core product capabilities

- Governance directory with verified DAO metadata support (GSPL + GraphQL merge).
- Full DAO view with proposal list, search, and state filters.
- Rich proposal detail view with voting actions, proposal metadata, and instruction management.
- Treasury wallet views with value aggregation, per-wallet drill-down, and execution tooling.
- Member analytics and participation tables.
- Realtime proposal/event feed.
- Wallet profile view (participation, created proposals, vote history, SNS domains).
- Extension framework for governance, treasury, DeFi, identity, and IntraDAO actions.

### Platform capabilities

- Solana wallet adapter integration (`Phantom`, `Solflare`, `Ledger`).
- Dynamic RPC/cluster switching from UI (Mainnet/Devnet + custom endpoint).
- PWA install support and service worker update strategy.
- Push notification registration + foreground/background handling.
- Embed routes for governance and proposal widgets.

---

## UI Architecture

### Global app shell

- Main shell is rendered in [`src/App.tsx`](/Users/kirk/Development/grape-governance/src/App.tsx).
- Top navigation + drawer lives in [`src/Header/Header.tsx`](/Users/kirk/Development/grape-governance/src/Header/Header.tsx).
- Main content is route-driven with React Router v6.

### Header and drawer

Header provides:

- app branding
- wallet connect button
- RPC settings dialog
- PWA install button (when browser supports install prompt)

Left drawer provides:

- `Directory` (`/`)
- `Profile` (`/profile`) when wallet connected
- `Realtime` (`/realtime`)
- external docs link
- governance quick search/autocomplete

---

## Route Map (Current UI)

| Route | Screen | Purpose |
|---|---|---|
| `/` | Directory | DAO discovery and filtering |
| `/dao/:handlekey` | Governance | DAO proposals and summary |
| `/dao/:handlekey/:proposal` | Governance | Deep-link into DAO + proposal context |
| `/governance/:handlekey` | Governance | Alias route for DAO page |
| `/proposal/:governance/:proposal` | Proposal wrapper | Dedicated proposal page |
| `/members/:handlekey` | Members | Token-owner/member analytics |
| `/stats/:handlekey` | Stats | Participation and proposal analytics |
| `/treasury/:address` | Treasury | DAO treasury wallets and tools |
| `/treasury/:address/:rules` | Treasury | Scoped treasury view per rules wallet |
| `/profile/:walletAddress` | My Governance | Wallet-centric governance activity |
| `/realtime/:handlekey?` | Realtime | Live proposal feed |
| `/metrics/:handlekey` | Premium gate | Token-gated metrics access |
| `/newproposal/:handlekey` | Legacy proposal builder | Create proposal with plugin-type selector |
| `/embedgovernance/:handlekey` | Embed governance | Embedded DAO view |
| `/embedproposal/:governance/:proposal` | Embed proposal | Embedded proposal view |
| `/daowallet/:governance/:wallet` | Wallet detail | Single treasury wallet wrapper |
| `/api/:handlekey/:querytype/:queryvar1/:queryvar2/:queryvar3` | API output | Participant address extraction endpoint |

`NotFound` behavior currently routes back to Directory view.

---

## Screen-by-Screen UX

### 1) Directory (`/`)

Implemented in [`src/Governance/GovernanceDirectory.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceDirectory.tsx).

Key UI elements:

- Search by governance name/address/metadata
- Toggle filters:
  - Verified only
  - Active voting only
  - 100+ proposals only
- Grid/List layout switch
- Live summary chips (`live votes`, total proposals, etc.)
- `Create DAO` entry point
- Latest activity panel

Card UI implemented in [`src/Governance/GovernanceDirectoryCardView.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceDirectoryCardView.tsx) with:

- metadata avatar + verification badge
- live voting indicator
- member/proposal stats
- recent proposal freshness

### 2) Governance DAO view (`/dao/:handlekey`)

Implemented in [`src/Governance/Governance.tsx`](/Users/kirk/Development/grape-governance/src/Governance/Governance.tsx).

Primary features:

- proposal table with pagination
- search proposals
- state filters (`Voting`, `Draft`, `Passed`, `Defeated`, `With Instructions`)
- optional cancelled/veto filtering toggle
- vote weight + unique voter counts
- proposal risk highlighting for repeated vetoed-author patterns
- quick metrics cards (casted vote weight, pass rate, resolved coverage)
- DAO-level live activity widget

Navigation cluster in [`src/Governance/GovernanceNavigation.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceNavigation.tsx):

- Proposals
- Members
- Treasury
- Metrics

### 3) Proposal detail (`/proposal/:governance/:proposal`)

Implemented in [`src/Governance/GovernanceProposalV2.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceProposalV2.tsx) via wrapper [`src/Governance/GovernanceProposalWrapper.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceProposalWrapper.tsx).

Key sections:

- Proposal Overview
- Proposal Details (markdown/rendered content)
- voting actions (`for/against` flows)
- execution/instruction management (`Edit Proposal`, `Add Instructions`)
- voter participation CSV export
- realtime feed block
- external link to Realms

### 4) Treasury (`/treasury/:address`)

Implemented in [`src/Governance/GovernanceTreasury.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceTreasury.tsx).

Top-level treasury metrics:

- Total treasury value
- Stablecoin treasury value
- SOL treasury value
- largest wallet concentration/share

Wallet card detail in [`src/Governance/Treasury/WalletCardView.tsx`](/Users/kirk/Development/grape-governance/src/Governance/Treasury/WalletCardView.tsx) includes:

- token + SOL balances
- NFT and staking visibility
- domain discovery
- governance proposal relationships

### 5) Extensions menu (Treasury + Governance actions)

Implemented in [`src/Governance/Treasury/plugins/ExtensionsMenu.tsx`](/Users/kirk/Development/grape-governance/src/Governance/Treasury/plugins/ExtensionsMenu.tsx).

Categories:

- Governance Tools
- Proposal Builder
- Treasury Operations
- DeFi & Automation
- Identity & Claims
- IntraDAO
- Info

Operational options:

- `Queue Instructions Only` mode
- pending instruction set count
- info panel with voting/threshold/mint/rules-wallet context

### 6) Legacy proposal builder (`/newproposal/:handlekey`)

Implemented in [`src/Governance/GovernanceCreateProposal.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceCreateProposal.tsx).

Available instruction/plugin choices include:

- Token transfer / SOL transfer
- Close token account
- SNS transfer
- IntraDAO join/vote/propose/grant flows
- DCA / swap-related flows (DAO-gated)
- marketplace actions (DAO-gated)
- speed-dial flow (DAO-gated)

### 7) Members (`/members/:handlekey`)

Implemented in [`src/Governance/GovernanceMembers.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceMembers.tsx).

Features:

- member leaderboard (DataGrid)
- staked vs unstaked governance balance insights
- participation indicators
- CSV export

### 8) Stats (`/stats/:handlekey`)

Implemented in [`src/Governance/GovernanceStats.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceStats.tsx).

Includes:

- governance KPI summaries via [`src/Governance/GovernanceStatsSummary.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceStatsSummary.tsx)
- participation distribution and proposal engagement
- top participants and concentration metrics
- flagged author analytics (cancelled/vetoed behavior)
- CSV export for downstream analysis

### 9) Wallet profile (`/profile/:walletAddress`)

Implemented in [`src/Governance/MyGovernance.tsx`](/Users/kirk/Development/grape-governance/src/Governance/MyGovernance.tsx).

Tabs:

- Participation
- Created Proposals
- Votes Casted

Additional capabilities:

- SNS domain lookup (including subdomains)
- `Relinquish All Votes` workflow for unrelinquished vote records

### 10) Realtime (`/realtime`)

Implemented in [`src/Admin/Realtime/Realtime.tsx`](/Users/kirk/Development/grape-governance/src/Admin/Realtime/Realtime.tsx).

Features:

- realtime proposal list
- search/filter support
- cancelled proposal toggle
- direct navigation to proposal detail

Live event component for DAO/proposal cards uses [`src/Governance/GovernanceRealtimeInfo.tsx`](/Users/kirk/Development/grape-governance/src/Governance/GovernanceRealtimeInfo.tsx).

---

## Wallet, RPC, and Cluster UX

RPC/cluster UX is centralized in:

- [`src/Header/Header.tsx`](/Users/kirk/Development/grape-governance/src/Header/Header.tsx)
- [`src/utils/grapeTools/constants.ts`](/Users/kirk/Development/grape-governance/src/utils/grapeTools/constants.ts)

Supported behavior:

- cluster switch (`mainnet`/`devnet`) with persisted preference
- predefined RPC provider selection
- custom HTTPS RPC input with validation
- wallet disconnect action from settings modal

---

## Notifications, PWA, and Reliability

### Push notifications

- foreground messaging: [`src/firebaseNotifications/firebase.js`](/Users/kirk/Development/grape-governance/src/firebaseNotifications/firebase.js)
- realm registration flow: [`src/firebaseNotifications/realmPush.ts`](/Users/kirk/Development/grape-governance/src/firebaseNotifications/realmPush.ts)
- service worker background notifications: [`src/serviceWorker.js`](/Users/kirk/Development/grape-governance/src/serviceWorker.js)

### PWA

- install prompt hook: [`src/Header/useAddToHomeScreen.tsx`](/Users/kirk/Development/grape-governance/src/Header/useAddToHomeScreen.tsx)
- service worker auto-update and cache strategy in [`src/index.tsx`](/Users/kirk/Development/grape-governance/src/index.tsx) + [`src/serviceWorker.js`](/Users/kirk/Development/grape-governance/src/serviceWorker.js)

### Network safety guard

- blocked-host request interception in [`src/utils/networkGuards.ts`](/Users/kirk/Development/grape-governance/src/utils/networkGuards.ts)

---

## Configuration and Feature Gating

Key runtime/config gates in the current UI:

- `REACT_APP_SOLANA_CLUSTER`: default network cluster
- `APP_SANCTUM_API_KEY`: shows Sanctum swap extension in menu
- `REACT_APP_API_METRICS_TOKEN` (`METRICS_TOKEN`): enables gated metrics access flow
- Firebase env variables + VAPID key: required for push registration and delivery

---

## Suggested GitBook Information Architecture

Recommended page split:

1. `Product Overview`
2. `UI Navigation`
3. `Directory and Discovery`
4. `DAO Governance View`
5. `Proposal Lifecycle UI`
6. `Treasury and Extensions`
7. `Members and Analytics`
8. `Wallet Profile`
9. `Realtime and Notifications`
10. `Configuration and Feature Flags`

Related spec:

- [`API v1 + CLI Command Map (Draft)`](/Users/kirk/Development/grape-governance/docs/gitbook/api-v1-spec-cli-map.md)
