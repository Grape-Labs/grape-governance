# Governance UI by Grape

Grape offers an incredibly fast DAO tooling infrastructure designed to enhance the SPL Governance experience. We introduce innovative ways to utilize SPL Governance through an easy-to-use interface, enabling users to view historical data and extract essential governance metrics—tasks that have been challenging to perform efficiently. Additionally, we provide an API that allows any developer to compose on SPL Governance with minimal RPC overhead. Our platform achieves Web2-like load speeds while leveraging the powerful Web3 DAO primitive (SPL Governance). This seamless and transparent experience paves the way for building tools that can onboard the next billion users to crypto.
                    
                    Our development doesn’t stop there. We showcase tools like "Realtime" and demonstrate real-world use cases for organizations through simulations using "Frictionless" proposal authors. DAOs require even more tools, and Governance.so delivers a comprehensive suite of plugins. Our full IntraDAO tooling enables existing DAOs to join and participate in voting processes within other DAOs. Moreover, our groundbreaking IntraDAO proposal creation leverages Grape and Integration Partners' extensive plugin suite to craft proposals, revolutionizing DAO tooling within the Solana ecosystem.
                    “Building the Web3 infrastructure at Web2 Native Speeds!”

**Getting Started**
- The Administration panel requires the connected wallet to be whitelisted (https://governance.so/admin), this provides a GUI for fetching single Governances, Generating cached files and Uploading the created files to a decentralized storage pool
- <img width="436" alt="Screenshot 2023-03-22 at 11 55 19 PM" src="https://user-images.githubusercontent.com/13381905/227047472-fb31afd1-079b-4b3d-836b-5b0f27d74183.png">
- <img width="428" alt="Screenshot 2023-03-22 at 11 55 57 PM" src="https://user-images.githubusercontent.com/13381905/227047565-037eb923-e341-4548-857e-80754137f65b.png">


- The simulation can be run for any Governance and a timer will show for the load time on the bottom https://governance.so/dao/HgcYAkXFT1ENpUCjBZWc1TjAAFacUwdGZRNhTHx9cuo

<img width="1682" alt="Screenshot 2023-03-22 at 11 53 50 PM" src="https://user-images.githubusercontent.com/13381905/227047342-0fd4d7a8-7638-44c2-8d63-1d0fab2a7e4b.png">


Time taken on Realms UI for SPL Governance https://realms.today/dao/DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE is roughly **25-35s**

Time taken for load via Cached Storage **<1s (38ms!)** (Governance: Mango https://governance.so/dao/DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE):
<img width="543" alt="Screenshot 2023-03-22 at 11 56 46 PM" src="https://user-images.githubusercontent.com/13381905/227047694-0d793e26-c49f-4ae3-87fa-c7767076555a.png">


Time taken to load via Indexed RPC calls **~10s** (Governance: Mango https://governance.so/rpcgovernance/DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE):
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
- GenesysGo Shadow Drive (https://github.com/GenesysGo/shadow-drive)

Identity:
- SNS (https://github.com/Bonfida)

UI:
- Interface: MUI 5 https://mui.com

BUILD/START:
- `yarn install`
- `yarn start`
