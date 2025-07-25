import { 
    PublicKey, 
    Connection, 
    Keypair, 
    SystemProgram,
    Transaction,
    TransactionMessage,
    TransactionInstruction,
    VersionedMessage,
    VersionedTransaction,
    ComputeBudgetProgram,
    sendAndConfirmTransaction,
    SendTransactionError } from '@solana/web3.js';
import axios from "axios";
import { 
    createMint,
    TOKEN_PROGRAM_ID, 
    mintTo, 
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getOrCreateAssociatedTokenAccount,
    MintLayout,
    getMinimumBalanceForRentExemptMint,
    createInitializeMintInstruction,
    createMintToCheckedInstruction,
    mintToChecked,
    createAccount,
    createSetAuthorityInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getMint,
} from "@solana/spl-token-v2";
//import * as token from '@solana/spl-token';
import {
    //createInitializeMetadataPointerInstruction
} from "@solana/spl-token";
import {
    TokenMetadata,
    createInitializeInstruction,
    createUpdateFieldInstruction,
  } from "@solana/spl-token-metadata";
import { 
    generateSigner, 
    percentAmount, 
    publicKey as UmiPK, 
    Instruction, 
    createNoopSigner,
    none } from '@metaplex-foundation/umi'
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults";
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { 
    Metadata, 
    createV1, 
    createMetadataAccountV3, 
    updateMetadataAccountV2,
    CreateMetadataAccountV3InstructionDataArgs,
    CreateMetadataAccountV3InstructionAccounts,
    mplTokenMetadata,
    fetchDigitalAsset,
    mintV1, 
    TokenStandard, 
    MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { Metaplex, TransactionBuilder } from '@metaplex-foundation/js';
import { Buffer } from 'buffer';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
    RPC_DEVNET_CONNECTION,
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';
import React, { useCallback, useState, useEffect } from 'react';
import {
    AppBar,
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
    ListItemIcon,
    CircularProgress,
} from '@mui/material/';
import { useSnackbar } from 'notistack';
import { styled } from '@mui/material/styles';

import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import TollIcon from '@mui/icons-material/Toll';
import CloseIcon from '@mui/icons-material/Close';
import { TOKEN_METADATA_PROGRAM_ID } from '@onsol/tldparser';

import AdvancedProposalView from './AdvancedProposalView';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuiDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

// Extend the SendTransactionError to include 'signature'
interface SendTransactionErrorWithSignature extends SendTransactionError {
    signature?: string;
}

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
}
  
const BootstrapDialogTitle = (props: DialogTitleProps) => {
    const { children, onClose, ...other } = props;
    
    return (
      <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
};

export default function TokenManagerView(props) {
    const setReload = props?.setReload;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const governingTokenMint = props.governingTokenMint;
    
    const realm = props?.realm;
    const governanceAddress = props.governanceAddress || realm.pubkey.toBase58();
    
    const rulesWallet = props?.rulesWallet;
    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const instructions = props?.instructions;
    const setInstructions = props?.setInstructions;
    
    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey, wallet, sendTransaction } = useWallet();
    
    const [governingMint, setGoverningMint] = React.useState(null);
    const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
    const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
    const [isDraft, setIsDraft] = React.useState(false);
    const [openAdvanced, setOpenAdvanced] = React.useState(false);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const [tokens, setTokens] = useState([]);
    const [mintAddress, setMintAddress] = useState('');
    const [amount, setAmount] = useState(0);
    const [proposalTitle, setProposalTitle] = useState(`Create a New Token`);
    const [proposalDescription, setProposalDescription] = useState(`Initialize a new token with the specified name, symbol, and metadata URI.`);
    const [editProposalAddress, setEditProposalAddress] = useState(props?.editProposalAddress);
    
    const [loading, setLoading] = useState(false);
    const [open, setPropOpen] = React.useState(false);

    const [fetchedName, setFetchedName] = useState(null);
    const [fetchedSymbol, setFetchedSymbol] = useState(null);
    const [fetchedUri, setFetchedUri] = useState(null);

    const [name, setName] = useState("DAO Token");
    const [symbol, setSymbol] = useState("TKN");
    //const [uri, setUri] = useState("https://arweave.net/lyeMvAF6kpccNhJ0XXPkrplbcT6A5UtgBiZI_fKff6I");
    const [uri, setUri] = useState("");
    const [decimals, setDecimals] = useState(null);
    const [amountToMint, setAmountToMint] = useState('');
    const [destinationAddress, setDestinationAddress] = useState(null);
    const [isGistDescription, setIsGistDescription] = useState(false);
    const [tabIndex, setTabIndex] = useState(0); // Tab index to toggle between Create and Manage tabs

    // Define default titles and descriptions corresponding to each tab index
    const defaultTitles = [
        "Create a New Token",        // Tab Index 0: Create
        "Mint Additional Tokens",    // Tab Index 1: Mint
        "Transfer Mint Authority",    // Tab Index 2: Transfer
        "Update Token Metadata"    // Tab Index 3: Update
    ];

    const defaultDescriptions = [
        "Initialize a new token with the specified name, symbol, and metadata URI.", // Create
        "Mint more tokens to the associated token account of the specified mint address.", // Mint
        "Transfer the mint authority of the specified token to another wallet address.", // Transfer
        "Update token metadata with the specified name, symbol, and metadata URI." // Update
    ];
    const [customTitles, setCustomTitles] = useState<string[]>(["", "", ""]);
    const [customDescriptions, setCustomDescriptions] = useState<string[]>(["", "", ""]);

    const connection = RPC_CONNECTION; // Change to your desired network

    const handleTabChange = (_event: React.ChangeEvent<{}>, newIndex: number) => {
        setTabIndex(newIndex);
    
        // Determine the title based on custom input or default
        //if (customTitles[newIndex].trim().length > 0) {
        //    setProposalTitle(customTitles[newIndex]);
        //} else {
            setProposalTitle(defaultTitles[newIndex]);
        //}
    
        // Determine the description based on custom input or default
        //if (customDescriptions[newIndex].trim().length > 0) {
        //    setProposalDescription(customDescriptions[newIndex]);
        //} else {
            setProposalDescription(defaultDescriptions[newIndex]);
        //}
    };

    const handleCloseDialog = () => {
        setPropOpen(false);
        handleCloseExtMenu();
    }

    const handleClickOpen = () => {
        setPropOpen(true);
    };

    const handleClose = () => {
        setPropOpen(false);
        handleCloseExtMenu();
    };

    const getWalletAllTokenBalance = async(tokenOwnerRecord: PublicKey) => {
    
        const uri = `https://api.shyft.to/sol/v1/wallet/all_tokens?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
    
        return axios.get(uri, {
            headers: {
                'x-api-key': SHYFT_KEY,
                'Accept-Encoding': 'gzip, deflate, br'
            }
            })
            .then(response => {
                if (response.data?.result){
                    return response.data.result;
                }
                return null
            })
            .catch(error => 
                {   
                    // revert to RPC
                    console.error(error);
                    return null;
            });
    }

    const fetchCreatedTokensIx = async () => {
        //if (!publicKey) return;
        //setLoading(true);

        try {
            console.log("governanceNativeWallet "+new PublicKey(governanceNativeWallet)?.toBase58());
            const accounts = await getWalletAllTokenBalance(new PublicKey(governanceNativeWallet));

            //console.log("accounts: "+JSON.stringify(accounts));

            const createdTokens = [];
            for (const tokenAccount of accounts) { // for rpc use accounts.value
                console.log("tokenAccount: "+JSON.stringify(tokenAccount));
                //const mintPubKey = new PublicKey(tokenAccount.account.data.parsed.info.mint);
                const mintPubKey = new PublicKey(tokenAccount.address);

                //const accountInfo = await getMint(connection, mintPubKey);
                const accountInfo = await connection.getAccountInfo(mintPubKey);

                if (accountInfo === null) continue; // Skip if no account info

                /// Check if data is already a Buffer
                const data = new Uint8Array(accountInfo.data);
                
                const mintInfo = MintLayout.decode(data);

                // Extract fields from the mint info
                const decimals = mintInfo.decimals;

                const supply = Number(mintInfo.supply); // Reading 64-bit integer as BigInt


                console.log("mintInfo?.mintAuthority: "+JSON.stringify(mintInfo?.mintAuthority));

                //if (mintInfo && mintInfo?.mintAuthority){ //&& mintInfo.mintAuthority.toBase58() === (new PublicKey(governanceNativeWallet).toBase58())) {
                if (mintInfo && mintInfo?.mintAuthority && mintInfo.mintAuthority.toBase58() === (new PublicKey(governanceNativeWallet).toBase58())) {
                    createdTokens.push({
                        address: mintPubKey.toBase58(), //mintPubKey.toString(),
                        decimals: decimals,
                        supply: supply,
                    });
                }
            }

            //console.log("created tokens: "+JSON.stringify(createdTokens));

            setTokens(createdTokens);

            //setInstructions(fetchTokensIx);
            //setExpandedLoader(true);

            enqueueSnackbar("Fetched tokens", { variant: 'success' });
        } catch (error) {
            enqueueSnackbar(`Error fetching tokens: ${error?.message}`, { variant: 'error' });
        } finally {
            //setLoading(false);
        }
    };

    const updateTokenIx = async () => {
        if (!mintAddress) return;
        setLoading(true);

        try {
            const mintPubKey = new PublicKey(mintAddress);
            const withPublicKey = new PublicKey(governanceNativeWallet);
            const mintAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            const freezeAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            
            let title = proposalTitle;
            
            const currentTabDefaultDescription = defaultDescriptions[tabIndex];
            let isDefaultDescription = proposalDescription === currentTabDefaultDescription;
            // Set the description based on whether it's default or custom
            let description = (isDefaultDescription || proposalDescription.length <= 0)
                ? `Update token Metadata`
                : proposalDescription;

            // Set up metadata
            const metadataProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"); // Token Metadata Program ID
            const metadataSeeds = [
                Buffer.from("metadata"),
                metadataProgramId.toBuffer(),
                mintPubKey.toBuffer(),
            ];
            const [metadataPDA] = await PublicKey.findProgramAddress(metadataSeeds, metadataProgramId);
            const ixSigners = new Array();
            
            // Calculate the rent-exempt balance needed
            
            const authTransaction = new Transaction();
            // Create a transaction
            const transaction = new Transaction();
            const walletTransaction = new Transaction();

            try{
                if (name.length > 0 && symbol.length > 0  && uri.length > 0){
                    const umi = createUmi(connection).use(mplTokenMetadata());

                    
                    // Metadata to store in Mint Account
                    
                    let createUpdateMetadata = null;
                    let update = false;
                    if (fetchedName != name || fetchedSymbol != symbol || fetchedUri != uri){
                        update = true;
                    } else{
                        if (fetchedName && fetchedName.length > 0 && fetchedSymbol && fetchedSymbol.length > 0 && fetchedUri && fetchedUri.length > 0){
                            enqueueSnackbar("Nothing to change.", { variant: 'error' });
                            return;
                        }
                    }

                    if (update){
                        console.log("1. Updating v1 Metadata");
                        //updateMetadataAccountV2
                        createUpdateMetadata = updateMetadataAccountV2(
                            umi, {
                                metadata: UmiPK(metadataPDA.toBase58()),
                                //mint: UmiPK(mintPubKey.toBase58()),
                                //mintAuthority: createNoopSigner(UmiPK(withPublicKey.toBase58())), // Use createNoopSigner for mintAuthority
                                //payer: createNoopSigner(UmiPK(withPublicKey.toBase58())),
                                updateAuthority: createNoopSigner(UmiPK(withPublicKey.toBase58())), //UmiPK(withPublicKey.toBase58()),
                                //isMutable: true,
                                //collectionDetails: none(),
                                data: {
                                    name: name,
                                    symbol: symbol,
                                    uri: uri,
                                    sellerFeeBasisPoints: 0,
                                    creators: none(),
                                    collection: none(),
                                    uses: none(),
                                },
                            }
                        ).getInstructions()


                    } else{
                        console.log("1. Creating v1 Metadata");
                        createUpdateMetadata = createMetadataAccountV3(
                            umi, {
                                metadata: UmiPK(metadataPDA.toBase58()),
                                mint: UmiPK(mintPubKey.toBase58()),
                                mintAuthority: createNoopSigner(UmiPK(withPublicKey.toBase58())), // Use createNoopSigner for mintAuthority
                                payer: createNoopSigner(UmiPK(withPublicKey.toBase58())),
                                updateAuthority: UmiPK(withPublicKey.toBase58()),
                                isMutable: true,
                                collectionDetails: none(),
                                data: {
                                    name: name,
                                    symbol: symbol,
                                    uri: uri,
                                    sellerFeeBasisPoints: 0,
                                    creators: none(),
                                    collection: none(),
                                    uses: none(),
                                },
                            }
                        ).getInstructions()
                    }
                    
                    const currentTabDefaultTitle = defaultTitles[tabIndex];
                    const isDefaultTitle = proposalTitle === currentTabDefaultTitle;
                    // Set the description based on whether it's default or custom
                    title = isDefaultTitle
                        ? `Update ${name} Metadata`
                        : proposalTitle;
                    
                    // Set the description based on whether it's default or custom
                    description = (isDefaultDescription || proposalDescription.length <= 0)
                        ? `Update token ${name} ${symbol} ${mintPubKey.toBase58()} Metadata`
                        : proposalDescription;
                        
                    console.log("4. a. Getting IX for Metadata");

                    //transaction.add(toWeb3JsInstruction(createUpdateMetadata));
                    createUpdateMetadata && createUpdateMetadata?.length > 0 && createUpdateMetadata.forEach((umiInstruction) => {
                        const solanaInstruction = toWeb3JsInstruction(umiInstruction);
                        if (solanaInstruction)
                            transaction.add(solanaInstruction);
                    });
                }
            }catch(metaErr){
                console.error("❌ Error in MetaErr:", metaErr);
            }

            setProposalTitle(title);
            setProposalDescription(description);

            //ixSigners.push(mintKeypair)
            if (transaction?.instructions)
                enqueueSnackbar("Updating token metadata", { variant: 'success' });
            
            const ixs = transaction;
            const aixs = walletTransaction;//authTransaction;
            
            if ((ixs && ixs?.instructions) || (aixs && aixs?.instructions)){
                const createTokenIx = {
                    title: title || proposalTitle,
                    description: description || proposalDescription,
                    ix: ixs?.instructions,
                    aix: null,//aixs?.instructions,
                    signers: null,
                    nativeWallet:governanceNativeWallet,
                    governingMint:governingMint,
                    draft: isDraft,
                    editProposalAddress: editProposalAddress,
                };

                //console.log("Passing signer: "+JSON.stringify(ixSigners));

                const isSimulationSuccessful = true; // dont sim //await simulateCreateTokenIx(transaction);
                if (!isSimulationSuccessful) {
                    enqueueSnackbar("Transaction simulation failed. Please check the logs for details.", { variant: 'error' });
                    handleCloseDialog();
                    return; // Exit the function as simulation failed
                }

                console.log("Simulation was successful. Proceeding with the transaction.");
                
                handleCloseDialog();
                setInstructions(createTokenIx);
                setExpandedLoader(true);

                enqueueSnackbar("Update token instructions prepared", { variant: 'success' });
            } else{
                enqueueSnackbar(`Error no transaction instructions`, { variant: 'error' });
            }
        

        //console.log("Token mint created and authority transferred to governance wallet.");
    

        } catch (error) {

            if (error instanceof SendTransactionError) {
                const extendedError = error as SendTransactionErrorWithSignature;
                const signature = extendedError.signature;
                console.error(`❌ SendTransactionError: ${extendedError.message}`);
    
                if (signature) {
                    try {
                        const logs = await connection.getTransaction(signature, { commitment: 'finalized' });
                        console.error("📜 Transaction Logs:", logs);
                        enqueueSnackbar(`Transaction failed: ${JSON.stringify(logs)}`, { variant: 'error' });
                    } catch (logError) {
                        console.error("❌ Failed to retrieve transaction logs:", logError);
                    }
                }
            } else {
                console.error("❌ Error in updateTokenIx:", error);
                enqueueSnackbar(`Error preparing update token instructions: ${JSON.stringify(error)}`, { variant: 'error' });
            }


            
        } finally {
            setLoading(false);
        }

    }

    const transferMintIx = async () => {
        if (!mintAddress || !destinationAddress) return;
        setLoading(true);

        try {
            const mintPubKey = new PublicKey(mintAddress);
            const withPublicKey = new PublicKey(governanceNativeWallet);
            //const mintAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            //const freezeAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            
            
            const transaction = new Transaction();
            
            // TODO:
            // check the mint authority, and automatically get the current one, if the current is not the governance wallet i.e. withPublicKey but publicKey then it needs to be done in the wallet level
            const mintInfo = await getMint(connection, mintPubKey);
            const mintAuthority = mintInfo.mintAuthority;

            //let title = `Transfer Mint Authority`;
            // check if we are using the default description otherwise use the text as is
            const currentTabDefaultDescription = defaultDescriptions[tabIndex];
            const isDefaultDescription = proposalDescription === currentTabDefaultDescription;
            // Set the description based on whether it's default or custom
            const description = (isDefaultDescription || proposalDescription.length <= 0)
                ? `Transfer mint authority of ${mintPubKey.toBase58()} from ${mintAuthority.toBase58()} to ${destinationAddress}.`
                : proposalDescription;

            //let description = `Transfer ${mintPubKey.toBase58()} mint authority from ${mintAuthority.toBase58()} to ${destinationAddress}`;

            transaction.add(
                createSetAuthorityInstruction(
                    mintPubKey,           // Mint account
                    mintAuthority,        // Current authority
                    0,                    // Authority type: Mint Tokens
                    new PublicKey(destinationAddress),           // New mint authority
                )
            );

            console.log("Simulating");
                
            const isSimulationSuccessful = await simulateCreateTokenIx(transaction);

            console.log("Simulate complete");

            if (!isSimulationSuccessful) {
                enqueueSnackbar("Transaction simulation failed. Please check the logs for details.", { variant: 'error' });
                handleCloseDialog();
                return; // Exit the function as simulation failed
            }

            console.log("Simulation was successful. Proceeding with the transaction.");
            
            console.log("mintAuthority: " + mintAuthority.toBase58());

            if (mintAuthority.toBase58() === withPublicKey.toBase58()){
                

                //setProposalTitle(title);
                // ask if we should change the description
                setProposalDescription(description);

                const transferMintIx = {
                    title: proposalTitle,
                    description: description || proposalDescription,
                    ix: transaction.instructions,
                    nativeWallet:governanceNativeWallet,
                    governingMint:governingMint,
                    draft: isDraft,
                    editProposalAddress: editProposalAddress,
                };
                
                handleCloseDialog();
                setInstructions(transferMintIx);
                setExpandedLoader(true);
                enqueueSnackbar("Mint instructions prepared", { variant: 'success' });
            } else if (mintAuthority.toBase58() === publicKey.toBase58()){
                // do this on the wallet level
                enqueueSnackbar("Creating & transferring token on the wallet "+mintPubKey.toBase58()+", you will be prompted to then create a mint as a proposal", { variant: 'success' });
                const txid = await createAndSendV0TxInline(transaction.instructions, null);
                console.log("txid: ",txid);

                if (txid){
                    enqueueSnackbar("Transaction sent to network with txid: "+txid, { variant: 'success' });
                }
            } else{ // neither the governance or the publicKey have the mint authority of this mint
                enqueueSnackbar(`Error preparing mint instructions: Mint Authority is not the governance or the connected wallet ${mintAuthority.toBase58()}`, { variant: 'error' });
            }
        } catch (error) {
            enqueueSnackbar(`Error preparing mint instructions: ${error?.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const mintMoreTokensIx = async () => {
        if (!mintAddress || !amountToMint) return;
        setLoading(true);

        try {
            const mintPubKey = new PublicKey(mintAddress);
            const withPublicKey = new PublicKey(governanceNativeWallet);
            const mintAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            const freezeAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            
            const adjustedAmount = +amountToMint * Math.pow(10, decimals);
            
            // Step 1: Get or Create the Associated Token Account
            const associatedTokenAccount = await getAssociatedTokenAddress(
                mintPubKey,
                mintAuthority,
                true
            );

            const transaction = new Transaction();
            
            // Step 2: Check if the ATA already exists
            const ataAccountInfo = await connection.getAccountInfo(associatedTokenAccount);

            const currentTabDefaultDescription = defaultDescriptions[tabIndex];
            const isDefaultDescription = proposalDescription === currentTabDefaultDescription;
            // Set the description based on whether it's default or custom
            const description = (isDefaultDescription || proposalDescription.length <= 0)
                ? `Mint ${amountToMint} ${mintPubKey.toBase58()} to ATA: ${associatedTokenAccount.toBase58()}`
                : proposalDescription;

            // Initialize an array to hold transaction instructions
            const instructions = [];

            if (!ataAccountInfo) {
                // ATA does not exist, add instruction to create it
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        mintAuthority, // payer
                        associatedTokenAccount, // ATA address
                        mintAuthority, // owner of the ATA
                        mintPubKey, // mint
                        TOKEN_PROGRAM_ID,
                        ASSOCIATED_TOKEN_PROGRAM_ID
                    )
                );
            } else {
                // Optionally, you can perform additional checks to ensure the ATA is valid
                // For example, verify that the ATA is indeed associated with the correct mint and owner
                // Uncomment the following lines if you want to perform these checks

                /*
                try {
                    const tokenAccount = await getAccount(connection, associatedTokenAddress);
                    if (!tokenAccount.mint.equals(mintPubKey) || !tokenAccount.owner.equals(mintAuthority)) {
                        throw new Error("Existing ATA has mismatched mint or owner.");
                    }
                } catch (error) {
                    enqueueSnackbar(`Error verifying ATA: ${error.message}`, { variant: 'error' });
                    return;
                }
                */
            }

            transaction.add(
                createMintToCheckedInstruction(
                    mintPubKey, // mint
                    associatedTokenAccount, // receiver (should be a token account)
                    mintAuthority, // mint authority
                    adjustedAmount, // amount. if your decimals is 8, you mint 10^8 for 1 token.
                    decimals, // decimals
                    // [signer1, signer2 ...], // only multisig account will use
                ),
            );

            //setProposalTitle(title);
            setProposalDescription(description);
                
            const mintTokenIx = {
                title: proposalTitle,
                description: description || proposalDescription,
                ix: transaction.instructions,
                nativeWallet:governanceNativeWallet,
                governingMint:governingMint,
                draft: isDraft,
                editProposalAddress: editProposalAddress,
            };

            console.log("Simulating");
            
            const isSimulationSuccessful = await simulateCreateTokenIx(transaction);
            
            console.log("Simulate complete");

            if (!isSimulationSuccessful) {
                enqueueSnackbar("Transaction simulation failed. Please check the logs for details.", { variant: 'error' });
                handleCloseDialog();
                return; // Exit the function as simulation failed
            }

            console.log("Simulation was successful. Proceeding with the transaction.");
            
            handleCloseDialog();
            setInstructions(mintTokenIx);
            setExpandedLoader(true);

            enqueueSnackbar("Mint instructions prepared", { variant: 'success' });
        } catch (error) {
            enqueueSnackbar(`Error preparing mint instructions: ${error?.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const toggleGoverningMintSelected = (council: boolean) => {
        if (council){
            setIsGoverningMintCouncilSelected(true);
            setGoverningMint(realm?.account.config.councilMint);
        } else{
            setIsGoverningMintCouncilSelected(false);
            setGoverningMint(realm?.communityMint);
        }
    }

    const handleAdvancedToggle = () => {
        setOpenAdvanced(!openAdvanced);
    }

    React.useEffect(() => { 
        setIsGoverningMintSelectable(false);
        if (realm?.account.config?.councilMint){
            setGoverningMint(realm?.account.config.councilMint);
            setIsGoverningMintCouncilSelected(true);
            if (realm.account?.communityMint){
                if (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) !== 18446744073709551615){
                    setGoverningMint(realm?.account.communityMint);
                    setIsGoverningMintSelectable(true);
                    setIsGoverningMintCouncilSelected(false);
                }
            }
        } else {
            if (realm?.account?.communityMint){
                setGoverningMint(realm.account.communityMint);
                setIsGoverningMintCouncilSelected(false);
            }
        }

    }, []);

    const simulateCreateTokenIx = async (createTokenIx: Transaction): Promise<boolean> => {
        try {
            // Fetch the latest blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            
            // Create a VersionedTransaction using the prepared instructions
            const message = new TransactionMessage({
                payerKey: new PublicKey(governanceNativeWallet),
                recentBlockhash: blockhash,
                instructions: createTokenIx.instructions,
            }).compileToV0Message();
            
            const transaction = new VersionedTransaction(message);
    
            // Simulate the transaction
            const simulationResult = await connection.simulateTransaction(transaction);
    
            // Analyze the result
            if (simulationResult.value.err) {
                console.error("Simulation failed with error:", simulationResult.value.err);
                console.log("Logs:", simulationResult.value.logs);
                return false; // Indicate failure
            }
    
            console.log("Simulation successful. Logs:", simulationResult.value.logs);
            return true; // Indicate success
        } catch (error) {
            console.error("Error simulating transaction:", error);
            return false; // Indicate failure due to error
        }
    };

    const estimateComputeUnits = (instructionsLength: number) => {
        // Estimate compute units based on the number of instructions. You can adjust this calculation.
        const baseUnits = 200_000; // Minimum compute units for a simple transaction
        const perInstructionUnits = 500_000; // Additional units for each instruction
        return baseUnits + perInstructionUnits * instructionsLength;
    };
    
    const calculateBasePriorityFee = (computeUnits: number, baseMicroLamportsPerUnit: number) => {
        // Calculate the total priority fee based on compute units and price per compute unit
        return computeUnits * baseMicroLamportsPerUnit;
    };

    async function calculatePriorityFee(messageV0: VersionedMessage): Promise<number> {
        try {
            const response = await connection.getFeeForMessage(
                messageV0,
                'finalized'
            );
    
            if (response && response.value !== null) {
                console.log("✅ Estimated Fee:", response.value);
                return response.value; // Fee in lamports
            } else {
                console.error("❌ Failed to estimate fee from RPC");
                throw new Error("Failed to estimate fee");
            }
        } catch (error) {
            console.error("❌ Error calculating priority fee:", error);
            throw error;
        }
    }
    
    async function createAndSendV0TxInline(
        txInstructions: TransactionInstruction[],
        signers: Keypair[] | null
    ): Promise<string> {
        try {
            // Fetch latest blockhash
            const latestBlockhash = await connection.getLatestBlockhash('finalized');
            console.log("✅ Fetched latest blockhash. Last valid height:", latestBlockhash.lastValidBlockHeight);
    
            // Compute budget instructions
            const estimatedComputeUnits = await estimateComputeUnits(txInstructions.length);
            const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
                units: estimatedComputeUnits,
            });
    
            // Calculate Priority Fee
            // Temporary: create a message with only computeUnitLimitInstruction and txInstructions
            let allInstructions = [
                computeUnitLimitInstruction,
                ...txInstructions,
            ];
            
            let messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: allInstructions,
            }).compileToV0Message();
    
            // Calculate the fee based on the current instructions
            const estimatedFee = await calculatePriorityFee(messageV0);
            console.log(`✅ Estimated Priority Fee: ${estimatedFee} lamports`);
    
            // Convert lamports to microLamports
            const microLamportsFee = estimatedFee * 1000;
            console.log(`✅ Converted Priority Fee: ${microLamportsFee} microLamports`);
    
            // Add priority fee instruction
            const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: microLamportsFee,
            });
    
            // Recompile the transaction with updated instructions
            allInstructions = [
                computeUnitLimitInstruction,
                priorityFeeInstruction,
                ...txInstructions,
            ];
    
            messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: allInstructions,
            }).compileToV0Message();
    
            const transaction = new VersionedTransaction(messageV0);
    
            // Sign the transaction with all required signers
            if (signers && signers.length > 0) {
                transaction.sign(signers); // Spread the signers array
                console.log("✅ Transaction Signed with provided signer(s) "+signers[0].publicKey.toBase58());
            } else {
                console.warn("⚠️ No signers provided. Transaction may fail if signatures are required.");
            }
    
            // Simulate Transaction
            const simulationResult = await connection.simulateTransaction(transaction);
            console.log("🔍 Simulation result:", simulationResult);
    
            if (simulationResult.value.err) {
                console.error("❌ Simulation failed with error:", simulationResult.value.err);
                throw new Error(`Simulation error: ${simulationResult.value.err}`);
            }

            const txid = await sendTransaction(transaction, connection, {
                skipPreflight: false,
                preflightCommitment: "confirmed",
                maxRetries: 5,
            });
            /*
            // Serialize the transaction
            const rawTransaction = transaction.serialize();
            // Send the raw transaction
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                preflightCommitment: "confirmed",
                maxRetries: 5,
            });
            */
            console.log("✅ Transaction sent to network with txid:", txid);
    
            // Confirm Transaction
            try {
                const snackprogress = (key: any) => (
                    <CircularProgress sx={{ padding: '10px' }} />
                );
                const cnfrmkey = enqueueSnackbar(`Confirming Transaction`, { 
                    variant: 'info', 
                    action: snackprogress, 
                    persist: true 
                });
    
                const confirmation = await connection.confirmTransaction(
                    {
                        signature: txid,
                        blockhash: latestBlockhash.blockhash,
                        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                    },
                    'finalized' // Add commitment level
                );
                closeSnackbar(cnfrmkey);
    
                if (confirmation.value.err) {
                    console.error("❌ Transaction not confirmed:", confirmation.value.err);
                    throw new Error("Transaction not confirmed.");
                }
    
                console.log(`🎉 Transaction successfully confirmed: https://explorer.solana.com/tx/${txid}`);
                return txid;
            } catch (e) {
                console.error("❌ Transaction confirmation failed:", e);
                throw new Error("Transaction not confirmed.");
            }
        } catch (error) {
            // Enhanced error handling
            if (error instanceof SendTransactionError) {
                const extendedError = error as SendTransactionErrorWithSignature;
                const signature = extendedError.signature;
                console.error(`❌ SendTransactionError: ${extendedError.message}`);
    
                if (signature) {
                    try {
                        const logs = await connection.getTransaction(signature, { commitment: 'finalized' });
                        console.error("📜 Transaction Logs:", logs);
                        enqueueSnackbar(`Transaction failed: ${JSON.stringify(logs)}`, { variant: 'error' });
                    } catch (logError) {
                        console.error("❌ Failed to retrieve transaction logs:", logError);
                    }
                }
            } else {
                console.error("❌ Error in createAndSendV0TxInline:", error);
            }
            throw error; // Rethrow to handle upstream
        }
    }

    /**
     * Pauses execution for the specified number of milliseconds.
     * @param ms Number of milliseconds to wait.
     */
    const sleep = (ms: number): Promise<void> => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };  

    /**
     * Converts a Umi Instruction to a Solana TransactionInstruction.
     * @param umiInstruction - The Umi Instruction to convert.
     * @returns A Solana TransactionInstruction.
     */
    const convertUmiInstructionToSolana = (umiInstruction: Instruction): TransactionInstruction => {
        const { programId, keys, data } = umiInstruction;

        // Convert programId from string to PublicKey
        const solanaProgramId = new PublicKey(programId);

        // Convert each key's pubkey from string to PublicKey
        const solanaKeys = keys.map((key) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
        }));

        // Create and return the Solana TransactionInstruction
        return new TransactionInstruction({
            keys: solanaKeys,
            programId: solanaProgramId,
            data: Buffer.from(data) //data,
        });
    };

    const createTokenIx = async () => {
        setLoading(true);

        try {

            const withPublicKey = new PublicKey(governanceNativeWallet);
            const mintAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            const freezeAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            
            // Define metadata fields
            
            // Create an empty account for the mint
            const mintKeypair = Keypair.generate();
            const mintPublicKey = mintKeypair.publicKey;

            let title = proposalTitle;
            
            const currentTabDefaultDescription = defaultDescriptions[tabIndex];
            let isDefaultDescription = proposalDescription === currentTabDefaultDescription;
            // Set the description based on whether it's default or custom
            let description = (isDefaultDescription || proposalDescription.length <= 0)
                ? `Create a new token ${mintPublicKey.toBase58()} with DAO mint authority${+amountToMint > 0 ? ` and mint ${amountToMint} tokens` : ``}`
                : proposalDescription;

            // Set up metadata
            const metadataProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"); // Token Metadata Program ID
            const metadataSeeds = [
                Buffer.from("metadata"),
                metadataProgramId.toBuffer(),
                mintPublicKey.toBuffer(),
            ];
            const [metadataPDA] = await PublicKey.findProgramAddress(metadataSeeds, metadataProgramId);
            const ixSigners = new Array();
            
            // Calculate the rent-exempt balance needed
            const lamports = await getMinimumBalanceForRentExemptMint(connection);

            const authTransaction = new Transaction();
            // Create a transaction
            const transaction = new Transaction();
            const walletTransaction = new Transaction();

            console.log("1. Create Sys Account");
            // Create the token mint using your wallet as the payer
            walletTransaction.add(
                SystemProgram.createAccount({
                    fromPubkey: publicKey, // Your wallet as the payer
                    newAccountPubkey: mintPublicKey, // Mint account public key
                    space: MintLayout.span,
                    lamports: lamports, // Minimum balance for rent exemption
                    programId: TOKEN_PROGRAM_ID, // SPL Token program
                })
            );

            console.log("2. Init Mint");
            // Initialize the mint
            walletTransaction.add(
                createInitializeMintInstruction(
                    mintPublicKey,    // Mint account public key
                    decimals,         // Number of decimals
                    publicKey,        // Mint authority (your wallet)
                    withPublicKey,              // No freeze authority
                    TOKEN_PROGRAM_ID,
                )
            );

            // Transfer mint authority to governance-controlled wallet
            console.log("3. Transfer Mint Authority");
            // Use a custom instruction or SPL Token program's set authority instruction
            walletTransaction.add(
                createSetAuthorityInstruction(
                    mintPublicKey,           // Mint account
                    publicKey,               // Current authority
                    0,                       // Authority type: Mint Tokens
                    withPublicKey,           // New mint authority
                )
            );

            try{
                if (name.length > 0 && symbol.length > 0  && uri.length > 0){
                    const umi = createUmi(connection).use(mplTokenMetadata());

                    console.log("4. Creating v1 Metadata");
                    // Metadata to store in Mint Account
                    
                    const createMetadataAccountV3Ix = createMetadataAccountV3(
                        umi, {
                            metadata: UmiPK(metadataPDA.toBase58()),
                            mint: UmiPK(mintPublicKey.toBase58()),
                            mintAuthority: createNoopSigner(UmiPK(withPublicKey.toBase58())), // Use createNoopSigner for mintAuthority
                            payer: createNoopSigner(UmiPK(withPublicKey.toBase58())),
                            updateAuthority: UmiPK(withPublicKey.toBase58()),
                            isMutable: true,
                            collectionDetails: none(),
                            data: {
                                name: name,
                                symbol: symbol,
                                uri: uri,
                                sellerFeeBasisPoints: 0,
                                creators: none(),
                                collection: none(),
                                uses: none(),
                            },
                        }
                    ).getInstructions()
                    
                    const currentTabDefaultTitle = defaultTitles[tabIndex];
                    const isDefaultTitle = proposalTitle === currentTabDefaultTitle;
                    // Set the description based on whether it's default or custom
                    title = isDefaultTitle
                        ? `Create ${name} Token w/Metadata`
                        : proposalTitle;
                    
                    // Set the description based on whether it's default or custom
                    description = (isDefaultDescription || proposalDescription.length <= 0)
                        ? `Create a ${name} ${symbol} ${mintPublicKey.toBase58()} with DAO mint authority (w/Metadata)${+amountToMint > 0 ? ` and mint ${amountToMint} tokens` : ``}`
                        : proposalDescription;
                        
                    console.log("4. a. Getting IX for Metadata");
                    /*
                    const createV1Ix = createV1(
                        umi, {
                            mint: UmiPK(mintPublicKey.toBase58()),
                            authority: umi.identity,
                            name: name,
                            uri: uri,
                            symbol: symbol,
                            sellerFeeBasisPoints: percentAmount(0),
                            tokenStandard: TokenStandard.Fungible,
                        }
                    ).getInstructions()
                    */
                    createMetadataAccountV3Ix.forEach((umiInstruction) => {
                        const solanaInstruction = toWeb3JsInstruction(umiInstruction);
                        transaction.add(solanaInstruction);
                    });
                }
            }catch(metaErr){
                console.error("❌ Error in MetaErr:", metaErr);
            }
        
            console.log("5. Mint 1 Token");
            if (+amountToMint > 0){
                const adjustedAmount = +amountToMint * Math.pow(10, decimals); // Adjust for decimals
                // Step 1: Get or Create the Associated Token Account
                const associatedTokenAccount = await getAssociatedTokenAddress(
                    mintPublicKey,
                    mintAuthority,
                    true
                );

                if (!associatedTokenAccount) {
                    // ATA does not exist, add instruction to create it
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            mintAuthority, // payer
                            associatedTokenAccount, // ATA address
                            mintAuthority, // owner of the ATA
                            mintPublicKey, // mint
                            TOKEN_PROGRAM_ID,
                            ASSOCIATED_TOKEN_PROGRAM_ID
                        )
                    );
                } else {
                    // Optionally, you can perform additional checks to ensure the ATA is valid
                    // For example, verify that the ATA is indeed associated with the correct mint and owner
                    // Uncomment the following lines if you want to perform these checks

                    /*
                    try {
                        const tokenAccount = await getAccount(connection, associatedTokenAddress);
                        if (!tokenAccount.mint.equals(mintPubKey) || !tokenAccount.owner.equals(mintAuthority)) {
                            throw new Error("Existing ATA has mismatched mint or owner.");
                        }
                    } catch (error) {
                        enqueueSnackbar(`Error verifying ATA: ${error.message}`, { variant: 'error' });
                        return;
                    }
                    */
                }

                transaction.add(
                    createMintToCheckedInstruction(
                        mintPublicKey,            // Mint account
                        associatedTokenAccount,    // Destination token account
                        withPublicKey,            // Mint authority (new owner)
                        adjustedAmount,             // Amount to mint
                        decimals,                 // Token decimals
                        //[withPublicKey],          // Signer (governance wallet as new authority)
                        //TOKEN_PROGRAM_ID          // SPL Token program
                    )
                );
            }


            setProposalTitle(title);
            setProposalDescription(description);

            {

                enqueueSnackbar("Creating & transferring token on the wallet "+mintPublicKey.toBase58()+"", { variant: 'success' });
                const txid = await createAndSendV0TxInline(walletTransaction.instructions, [mintKeypair]);
                console.log("txid: ",txid);

                if (txid){
                    //ixSigners.push(mintKeypair)
                    if (transaction?.instructions)
                        enqueueSnackbar("Creating Metadata & Initial Mint", { variant: 'success' });
                    // we should wait a few seconds to proceed so that we can make sure that this tx can simulate
                    
                    // Introduce a delay of 2 seconds (2000 milliseconds)
                    await sleep(2000);
                    console.log("✅ Waited for 2 seconds before proceeding.");

                    const ixs = transaction;
                    const aixs = walletTransaction;//authTransaction;
                    
                    if (ixs || aixs){
                        const createTokenIx = {
                            title: title || proposalTitle,
                            description: description || proposalDescription,
                            ix: ixs?.instructions,
                            aix: null,//aixs?.instructions,
                            signers: null,
                            nativeWallet:governanceNativeWallet,
                            governingMint:governingMint,
                            draft: isDraft,
                            editProposalAddress: editProposalAddress,
                        };

                        //console.log("Passing signer: "+JSON.stringify(ixSigners));

                        const isSimulationSuccessful = true; // dont sim //await simulateCreateTokenIx(transaction);
                        if (!isSimulationSuccessful) {
                            enqueueSnackbar("Transaction simulation failed. Please check the logs for details.", { variant: 'error' });
                            handleCloseDialog();
                            return; // Exit the function as simulation failed
                        }

                        console.log("Simulation was successful. Proceeding with the transaction.");
                        
                        handleCloseDialog();
                        setInstructions(createTokenIx);
                        setExpandedLoader(true);

                        enqueueSnackbar("Create token instructions prepared", { variant: 'success' });
                    } else{
                        enqueueSnackbar(`Error no transaction instructions`, { variant: 'error' });
                    }
                } else{
                    enqueueSnackbar(`Mint has not been created`, { variant: 'error' });
                }

                //console.log("Token mint created and authority transferred to governance wallet.");
            }

        } catch (error) {

            if (error instanceof SendTransactionError) {
                const extendedError = error as SendTransactionErrorWithSignature;
                const signature = extendedError.signature;
                console.error(`❌ SendTransactionError: ${extendedError.message}`);
    
                if (signature) {
                    try {
                        const logs = await connection.getTransaction(signature, { commitment: 'finalized' });
                        console.error("📜 Transaction Logs:", logs);
                        enqueueSnackbar(`Transaction failed: ${JSON.stringify(logs)}`, { variant: 'error' });
                    } catch (logError) {
                        console.error("❌ Failed to retrieve transaction logs:", logError);
                    }
                }
            } else {
                console.error("❌ Error in createTokenIx:", error);
                enqueueSnackbar(`Error preparing create token instructions: ${JSON.stringify(error)}`, { variant: 'error' });
            }


            
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchMetadata = async () => {
            setFetchedName('');
            setFetchedSymbol('');
            setFetchedUri('');
            
            // fetch token information
            // setDecimals
            
            if (!mintAddress) {
                setName('');
                setSymbol('');
                setUri('');
                return;
            }

            let mintPubKey;
            try {
                mintPubKey = new PublicKey(mintAddress);
            } catch (error) {
                console.error('Invalid mint address:', error);
                enqueueSnackbar('Invalid mint address', { variant: 'error' });
                setName('');
                setSymbol('');
                setUri('');
                return;
            }

            if (mintPubKey){
                try {
                    const mintInfo = await getMint(connection, mintPubKey);
                    console.log("mintInfo: ",mintInfo);
                    enqueueSnackbar(`Mint is valid ${mintAddress} with ${mintInfo.decimals} decimals & supply ${mintInfo.supply}`, { variant: 'success' });
                    setDecimals(mintInfo.decimals);
                } catch(error){
                    console.error('Failed to fetch mint info:', error);
                }
            }

            try {
                
                const umi = createUmi(RPC_CONNECTION);
                const asset = await fetchDigitalAsset(umi, UmiPK(mintPubKey.toBase58()));
                
                if (!asset) {
                    enqueueSnackbar(`Metadata not found for ${mintAddress}`, { variant: 'warning' });
                    setName('');
                    setSymbol('');
                    setUri('');
                    return;
                }

                // Deserialize the metadata using Metaplex's library
                //const metadata = Metadata.deserialize(metadataAccount.data)[0];

                setFetchedName(asset?.metadata?.name.trim());
                setFetchedSymbol(asset?.metadata?.symbol);
                setFetchedUri(asset?.metadata?.uri);

                // Extract and set the metadata fields
                setName(asset?.metadata?.name.trim());
                setSymbol(asset?.metadata?.symbol);
                setUri(asset?.metadata?.uri);
            } catch (error) {
                console.error('Error fetching metadata:', error);
                enqueueSnackbar(`No Metadata found for ${mintAddress}`, { variant: 'error' });
                setName('');
                setSymbol('');
                setUri('');
            }
        };

        // Call the fetchMetadata function
        fetchMetadata();
    }, [mintAddress]);

    return (
        <>
            <Tooltip title="Token Manager (Create, Manage Tokens)" placement="right">
                <MenuItem onClick={publicKey && handleClickOpen}>
                    <ListItemIcon>
                        <TollIcon fontSize="small" />
                    </ListItemIcon>
                    Token
                </MenuItem>
            </Tooltip>
    
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
                PaperProps={{
                    style: {
                        background: '#13151C',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px',
                        paddingBottom: 1,
                        marginBottom: 1,
                    },
                }}
            >
                <AppBar position="static" color="default">
                    <Tabs
                        value={tabIndex}
                        onChange={handleTabChange}
                        indicatorColor="primary"
                        textColor="primary"
                        variant="fullWidth"
                    >
                        <Tab label="Create" />
                        <Tab label="Mint" />
                        <Tab label="Transfer" />
                        <Tab label="Update" />
                    </Tabs>
                </AppBar>
    
                <DialogContent>
                    {tabIndex === 0 && (
                        <Stack spacing={2} sx={{ pt: 2, pb: 2 }}>
                            <Typography variant="h6">Create a New Token</Typography>
    
                            <TextField
                                label="Token Name"
                                fullWidth
                                variant="outlined"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter token name"
                            />
                            <TextField
                                label="Token Symbol"
                                fullWidth
                                variant="outlined"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                placeholder="Enter token symbol"
                            />
                            <TextField
                                label="Metadata URI"
                                fullWidth
                                variant="outlined"
                                value={uri}
                                onChange={(e) => setUri(e.target.value)}
                                placeholder="Enter metadata URI"
                            />
                            <TextField
                                label="Decimals"
                                fullWidth
                                type="number"
                                variant="outlined"
                                value={decimals}
                                onChange={(e) => setDecimals(Number(e.target.value))}
                                placeholder="Enter token decimals"
                            />
                            <TextField
                                label="Amount To Mint"
                                fullWidth
                                type="number"
                                variant="outlined"
                                value={amountToMint}
                                onChange={(e) => {
                                    let value = e.target.value;
                                    
                                    // Remove leading zeros except when the value is exactly '0'
                                    if (value.length > 1) {
                                        value = value.replace(/^0+/, '');
                                    }
                            
                                    // Optionally, enforce a minimum value (e.g., 1)
                                    if (Number(value) < 0) {
                                        value = "0";
                                    }
                            
                                    setAmountToMint(value);
                                }}
                                placeholder="Enter token amount to mint"
                                inputProps={{
                                    min: "0", // Prevent negative numbers
                                }}
                            />
    
                            <Button
                                variant="contained"
                                onClick={() => createTokenIx()}//createTokenGovIx()}//createTokenIx()}
                                disabled={loading}
                            >
                                Create Token
                            </Button>
                        </Stack>
                    )}
    
                    {tabIndex === 1 && (
                        <Stack spacing={2} sx={{ pt: 2, pb: 2 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="h6">Mint Tokens</Typography>
                                {/*
                                <Tooltip title="Fetch Tokens for this DAO">
                                    <IconButton onClick={fetchCreatedTokensIx} disabled={loading}>
                                        <RefreshIcon />
                                    </IconButton>
                                </Tooltip>
                                */}
                            </Box>
    
                            <TextField
                                label="Mint Address"
                                fullWidth
                                variant="outlined"
                                value={mintAddress}
                                onChange={(e) => setMintAddress(e.target.value)}
                                placeholder="Enter mint address to mint more tokens"
                            />
                            <TextField
                                label="Amount to Mint"
                                fullWidth
                                type="number"
                                variant="outlined"
                                value={amountToMint}
                                onChange={(e) => {
                                    let value = e.target.value;
                                    
                                    // Remove leading zeros except when the value is exactly '0'
                                    if (value.length > 1) {
                                        value = value.replace(/^0+/, '');
                                    }
                            
                                    // Optionally, enforce a minimum value (e.g., 1)
                                    if (Number(value) < 0) {
                                        value = "0";
                                    }
                            
                                    setAmountToMint(value);
                                }}
                                placeholder="Enter amount to mint"
                                inputProps={{
                                    min: "0", // Prevent negative numbers
                                }}
                            />
                            <Button
                                variant="contained"
                                onClick={() => mintMoreTokensIx()}
                                disabled={loading || !mintAddress || !amountToMint}
                            >
                                Mint Tokens
                            </Button>
                            {/*
                            <Box>
                                <Typography variant="h6">Created Tokens:</Typography>
                                {tokens.length > 0 ? (
                                    tokens.map((token, index) => (
                                        <Box key={index} sx={{ mt: 1 }}>
                                            <Typography variant="body1">
                                                Mint Address: {token.address}
                                            </Typography>
                                            <Typography variant="body2">
                                                Decimals: {Number(token.decimals)}
                                            </Typography>
                                            <Typography variant="body2">
                                                Supply: {Number(token.supply)}
                                            </Typography>
                                        </Box>
                                    ))
                                ) : (
                                    <Typography variant="body2">No tokens found</Typography>
                                )}
                            </Box>
                            */}
                        </Stack>
                    )}
                    {tabIndex === 2 && (
                        <Stack spacing={2} sx={{ pt: 2, pb: 2 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="h6">Transfer</Typography>
                            </Box>
    
                            <TextField
                                label="Mint Address"
                                fullWidth
                                variant="outlined"
                                value={mintAddress}
                                onChange={(e) => setMintAddress(e.target.value)}
                                placeholder="Enter mint address to mint more tokens"
                            />
                            <TextField
                                label="Destination Address"
                                fullWidth
                                variant="outlined"
                                value={destinationAddress}
                                onChange={(e) => setDestinationAddress(e.target.value)}
                                placeholder="Enter address to transfer the mint authority to"
                            />

                            <Button
                                variant="contained"
                                onClick={() => transferMintIx()}
                                disabled={loading || !mintAddress || !destinationAddress}
                            >
                                Transfer Mint Authority
                            </Button>
                            
                        </Stack>
                    )}

                    {tabIndex === 3 && (
                        <Stack spacing={2} sx={{ pt: 2, pb: 2 }}>
                            <Typography variant="h6">Update Token Metadata</Typography>
    
                            <TextField
                                label="Mint Address"
                                fullWidth
                                variant="outlined"
                                value={mintAddress}
                                onChange={(e) => setMintAddress(e.target.value)}
                                placeholder="Enter mint address to update"
                            />
                            <TextField
                                label="Token Name"
                                fullWidth
                                variant="outlined"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter token name"
                            />
                            <TextField
                                label="Token Symbol"
                                fullWidth
                                variant="outlined"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                placeholder="Enter token symbol"
                            />
                            <TextField
                                label="Metadata URI"
                                fullWidth
                                variant="outlined"
                                value={uri}
                                onChange={(e) => setUri(e.target.value)}
                                placeholder="Enter metadata URI"
                            />
                            
                            <Button
                                variant="contained"
                                onClick={() => updateTokenIx()}
                                disabled={loading}
                            >
                                Update Token
                            </Button>
                        </Stack>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', p:0 }}>
                        {(publicKey) &&
                                <Button
                                    //disabled={name && symbol}
                                    size='small'
                                    onClick={handleAdvancedToggle}
                                    sx={{
                                        p:1,
                                        borderRadius:'17px',
                                        justifyContent: 'flex-start',
                                        '&:hover .MuiSvgIcon-root.claimIcon': {
                                            color:'rgba(255,255,255,0.90)'
                                        }
                                    }}
                                    startIcon={
                                        <>
                                            <SettingsIcon 
                                                className="claimIcon"
                                                sx={{
                                                    color:'rgba(255,255,255,0.25)',
                                                    fontSize:"14px!important"}} />
                                        </>
                                    }
                                >
                                    Advanced
                                </Button>
                        }

                        </Box>

                        
                        {openAdvanced ? 
                            <>
                                <AdvancedProposalView 
                                    governanceAddress={governanceAddress}
                                    proposalTitle={proposalTitle}
                                    setProposalTitle={setProposalTitle}
                                    proposalDescription={proposalDescription}
                                    setProposalDescription={setProposalDescription}
                                    toggleGoverningMintSelected={toggleGoverningMintSelected}
                                    isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
                                    isGoverningMintSelectable={isGoverningMintSelectable}
                                    isDraft={isDraft}
                                    setIsDraft={setIsDraft}
                                    setEditProposalAddress={setEditProposalAddress}
                                    editProposalAddress={editProposalAddress}
                                />
                            </>
                        :
                            <></>
                        }
                    

                    
                </DialogContent>
            </Dialog>
        </>
    );
    
}
