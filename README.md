# 🗳 Governance.so — The Fastest Interface for SPL Governance

**Governance.so**, built by Grape, is a blazing-fast, indexed, and developer-friendly platform designed to simplify and supercharge DAO operations on Solana. We transform governance from slow and opaque into intuitive, composable, and real-time.

> “DAO tooling should be as fast and easy as sending tokens from your wallet. That’s what we’ve built.”

---

## ⚡ Key Features

### 🔍 Blazing Fast & Indexed
Governance.so leverages **indexed RPCs and cached storage** to dramatically reduce load times — making governance feel like using a native wallet.

### 🛠 Rapid Proposal Builder
Create **multi-instruction proposals** with ease. Whether it's token transfers, DAO role assignments, or granting voting power, our UI generates structured summaries so users can confidently submit complex proposals.

### 👛 DAO Wallet Viewer
A familiar wallet-style interface for DAO treasuries:
- View tokens & NFTs held by the DAO
- Create transfer proposals with 1-click
- No complex form filling or guesswork

### 🧩 Extensible Proposal Integrations
Support for plugin-like **proposal extensions** — enabling integrations with external protocols, custom instruction builders, and DAO-specific workflows.

### 📊 DAO Metrics & Members
- Visualize participation trends
- Export proposal and vote data
- Member view with integrated identity (SNS/Cardinal)

### 👥 Voter Participation & Delegation
Empower governance:
- View real-time voting behavior
- Delegate your voting power to another wallet
- Clear, transparent voter records

### 🔴 Realtime Feed
Watch new proposals and vote activity unfold **live**. The Realtime tab gives an instant overview of all network-wide DAO activity.

### 👤 Profile Interface
View your governance footprint:
- DAOs you participate in
- Proposals you've created
- Delegations you’ve made or received

---

## 🔧 Admin Panel

[https://governance.so/admin](https://governance.so/admin)

Whitelisted wallets can:
- Fetch governance accounts
- Generate cached proposal files
- Upload to decentralized storage (Shadow Drive)

---

## 🧰 Tech Stack

- **Governance Engine:** [SPL Governance](https://github.com/solana-labs/solana-program-library/tree/master/governance)
- **Storage:** [GenesysGo Shadow Drive](https://github.com/GenesysGo/shadow-drive)
- **Wallets:** [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- **UI Framework:** [Material UI v5](https://mui.com)
- **Identity:** [Bonfida SNS](https://github.com/Bonfida), [Cardinal](https://github.com/cardinal-labs)

---

## 🛠 Build & Run Locally

```bash
yarn install
yarn start