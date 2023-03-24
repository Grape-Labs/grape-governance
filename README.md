# SPL Governance Decentralized Caching


An increbibly fast DAO Tooling infrastrastructure to improve the experience of SPL Governance via decentralized cached storage, second to introduce new ways to view historical data and to extract important governance metrics which was is currently difficult to achieve efficiently, and finally to provide an API where composing on SPL Governance will be accessible to any developer (even a new developer) with a minimum RPC burden. Ultimately we have achieved web2 load speeds, with an incredible web3 primitive, and this is the path to build for the next billion users that will board and make the experience of crypto seamless & transparent.
"Building the Web3 infrustructure at Web2 Native Speeds!"

What we built:
- UI Interfaces for simulating RPC/Cached experience for realms (created)
- Administrator UI for for fetching historical and up to date SPL Governance proposals along with participation (created)
- Proof of speed improvements in the respective UIs (cached storage can be fetched in less than 1 second)


Why did we build it:
- SPL Governance is slow for the average governance user (30+ seconds to load a governance), this results to a diminished user experience and potentially drives away participation
- Most importantly the delay also reduces the ability to onboard traditional web2 businesses to web3
- Historical data is by nature historic on the blockchain and as a result via traditional fetching methods are expensive, significantly slow, RPC heavy, and redundant


Next Steps...
- Phase 1
-- Continue to focus on building a unique, and incredibly fast SPL Governance experience
-- Create unique metrics to add an understanding on SPL Governance participation, trends, activity
-- Provide metrics solutions run by the unique cached storage
-- Automate the caching process with smart webhooks (upon proposal creation, completion and participation)
- Phase 2
-- Improve NFT Governance, reliability & speed
-- Create an improved NFT SPL Governance Experience for mass adoption
-- Create SPL Governance plugins and begin working to capture true web2 companies to convert and use SPL Governance in the most transparent possible way
-- API Access for improved composability over SPL Governance
-- Add more decentralized storage pools

**Getting Started**
- The Administration panel requires the connected wallet to be whitelisted, this provides the fetching tools for fetching and uploading the created files to a decentralized storage pool
- <img width="436" alt="Screenshot 2023-03-22 at 11 55 19 PM" src="https://user-images.githubusercontent.com/13381905/227047472-fb31afd1-079b-4b3d-836b-5b0f27d74183.png">
- <img width="428" alt="Screenshot 2023-03-22 at 11 55 57 PM" src="https://user-images.githubusercontent.com/13381905/227047565-037eb923-e341-4548-857e-80754137f65b.png">


- The simulation can be run for any Governance and a timer will show for the load time on the bottom https://spl-governance-caching.vercel.app/cachedgovernance/HgcYAkXFT1ENpUCjBZWc1TjAAFacUwdGZRNhTHx9cuo

<img width="1682" alt="Screenshot 2023-03-22 at 11 53 50 PM" src="https://user-images.githubusercontent.com/13381905/227047342-0fd4d7a8-7638-44c2-8d63-1d0fab2a7e4b.png">


Time taken on Realms UI for SPL Governance https://realms.today/dao/DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE is roughly 25-35s

Time taken for load via Cache ~35ms (Governance: Mango https://spl-governance-caching.vercel.app/cachedgovernance/DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE):
<img width="543" alt="Screenshot 2023-03-22 at 11 56 46 PM" src="https://user-images.githubusercontent.com/13381905/227047694-0d793e26-c49f-4ae3-87fa-c7767076555a.png">


Time taken to load via Indexed RPC calls ~10s (Governance: Mango https://spl-governance-caching.vercel.app/rpcgovernance/DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE):
<img width="861" alt="Screenshot 2023-03-15 at 2 46 11 PM" src="https://user-images.githubusercontent.com/13381905/225312925-7557e495-859e-46ac-9b85-86dd481893f2.png">

Featuring a full active DAO (cached) Directory:
<img width="1776" alt="Screenshot 2023-03-24 at 11 05 03 PM" src="https://user-images.githubusercontent.com/13381905/227641140-b5763868-0a00-49a4-b018-53d544a30067.png">

Cached Metrics & exportable data:
<img width="1773" alt="Screenshot 2023-03-24 at 11 06 18 PM" src="https://user-images.githubusercontent.com/13381905/227641408-e541cd2b-f98e-4c5a-8b5f-af2fbe9d63d6.png">

Governance (cached) Member Details (with Solana identity integration composed with Cardinal & Bonfida):
<img width="1768" alt="Screenshot 2023-03-24 at 11 06 58 PM" src="https://user-images.githubusercontent.com/13381905/227641591-da0fbbaf-a8d9-4cc6-829f-b06ccf04aa4b.png">



References:

Solana Governance:
- SPL Governance (https://github.com/solana-labs/solana-program-library/tree/master/governance)

Wallet Adapter:
- Solana Wallet Adapter (https://github.com/solana-labs/wallet-adapter)

Storage Pools:
- Genesysgo Shadow Drive (https://github.com/GenesysGo/shadow-drive)

Identity:
- Cardinal (https://github.com/cardinal-labs)
- Bonfida (https://github.com/Bonfida)

UI:
- Interface: MUI 5 https://mui.com

BUILD/START:
- `yarn install`
- `yarn start`
