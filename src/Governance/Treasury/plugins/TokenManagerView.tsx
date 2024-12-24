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
    getOrCreateAssociatedTokenAccount,
    MintLayout,
    getMinimumBalanceForRentExemptMint,
    createInitializeMintInstruction,
    createMintToCheckedInstruction,
    mintToChecked,
    createAccount,
    createSetAuthorityInstruction,
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
import { generateSigner, percentAmount } from '@metaplex-foundation/umi'
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults";
import { Metadata, createV1, createMetadataAccountV3, mintV1, TokenStandard, MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
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
    const editProposalAddress = props?.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const governanceAddress = props.governanceAddress;
    
    const realm = props?.realm;
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
    const [proposalTitle, setProposalTitle] = useState(`Create New Token with Metadata`);
    const [proposalDescription, setProposalDescription] = useState(`Create a new token with mint authority & metadata`);
    const [loading, setLoading] = useState(false);
    const [open, setPropOpen] = React.useState(false);

    const [name, setName] = useState("CollabX Test Token");
    const [symbol, setSymbol] = useState("MCXT");
    const [uri, setUri] = useState("https://arweave.net/lyeMvAF6kpccNhJ0XXPkrplbcT6A5UtgBiZI_fKff6I");
    const [decimals, setDecimals] = useState(8);

    const [tabIndex, setTabIndex] = useState(0); // Tab index to toggle between Create and Manage tabs

    const connection = RPC_CONNECTION; // Change to your desired network

    const handleTabChange = (_event, newIndex) => setTabIndex(newIndex);

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

    const mintMoreTokensIx = async () => {
        if (!mintAddress || !amount) return;
        setLoading(true);

        try {
            const mintPubKey = new PublicKey(mintAddress);
            const withPublicKey = new PublicKey(governanceNativeWallet);
            const mintAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            const freezeAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            
            setProposalTitle(`Mint More Tokens`);
            setProposalDescription(`Mint ${amount} ${mintPubKey.toBase58()} to the associated account`);

            const amountToMint = 1_000_000 * Math.pow(10, decimals);
            
            const transaction = new Transaction();
            transaction.add(
                createMintToCheckedInstruction(
                    mintPubKey, // mint
                    mintAuthority, // receiver (should be a token account)
                    mintAuthority, // mint authority
                    amountToMint, // amount. if your decimals is 8, you mint 10^8 for 1 token.
                    decimals, // decimals
                    // [signer1, signer2 ...], // only multisig account will use
                ),
            );
                
            /*
            const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                new PublicKey(governanceNativeWallet),
                mintPubKey,
                new PublicKey(governanceNativeWallet)
            );

            const mintIx = await mintTo(
                connection,
                new PublicKey(governanceNativeWallet),
                mintPubKey,
                associatedTokenAccount.address,
                publicKey,
                amount * 10 ** TOKEN_DECIMALS
            );
            */

            const mintTokenIx = {
                title: proposalTitle,
                description: proposalDescription,
                ix: transaction.instructions,
                nativeWallet:governanceNativeWallet,
                governingMint:governingMint,
                draft: isDraft,
            };
            
            const isSimulationSuccessful = await simulateCreateTokenIx(transaction);

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

            setProposalDescription(`Create a new token ${mintPublicKey.toBase58()} with DAO mint authority & metadata`);            

            // Set up metadata
            const metadataProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"); // Token Metadata Program ID
            const metadataSeeds = [
                Buffer.from("metadata"),
                metadataProgramId.toBuffer(),
                mintPublicKey.toBuffer(),
            ];
            const [metadataPDA] = await PublicKey.findProgramAddress(metadataSeeds, metadataProgramId);
            const ixSigners = new Array();
            // Metadata to store in Mint Account
            const metaData: TokenMetadata = {
                updateAuthority: withPublicKey,
                mint: mintKeypair.publicKey,
                name: name,
                symbol: symbol,
                uri: uri,
                additionalMetadata: [["description", "The Vine Token by the Grape DAO"]],
            };

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
                    publicKey,              // No freeze authority
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

            console.log("4. Mint 1 Token");
            const amountToMint = 1 * Math.pow(10, decimals); // Adjust for decimals

            transaction.add(
                createMintToCheckedInstruction(
                    mintPublicKey,            // Mint account
                    withPublicKey,    // Destination token account
                    withPublicKey,            // Mint authority (new owner)
                    amountToMint,             // Amount to mint
                    decimals,                 // Token decimals
                    //[withPublicKey],          // Signer (governance wallet as new authority)
                    //TOKEN_PROGRAM_ID          // SPL Token program
                )
            );

            /*
            // Create token account for governance wallet
            console.log("3. Create Token Account for Governance");
            const tokenAccount = await createAccount(
                connection, 
                wallet,        // Fee payer
                mintPublicKey,    // Mint associated with the token account
                withPublicKey     // Owner of the new token account (governance)
            );

            
            */
            

            // Send the transaction
            // await connection.sendTransaction(transaction, [publicKey, mintKeypair]);

            /*
            const isSimulationSuccessful = await simulateCreateTokenIx(authTransaction);

            if (!isSimulationSuccessful) {
                enqueueSnackbar("Transaction simulation failed. Please check the logs for details.", { variant: 'error' });
                handleCloseDialog();
                return; // Exit the function as simulation failed
            } else*/{

                const txid = await createAndSendV0TxInline(walletTransaction.instructions, [mintKeypair]);
                console.log("txid: ",txid);

                const ixs = transaction;
                const aixs = authTransaction;
                
                if (ixs || aixs){
                    const createTokenIx = {
                        title: proposalTitle,
                        description: proposalDescription,
                        ix: ixs?.instructions,
                        aix:aixs?.instructions,
                        signers: ixSigners,
                        nativeWallet:governanceNativeWallet,
                        governingMint:governingMint,
                        draft: isDraft,
                    };

                    console.log("Passing signer: "+JSON.stringify(ixSigners));

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


    const createTokenGovIx = async () => {
        setLoading(true);

        try {

            const withPublicKey = new PublicKey(governanceNativeWallet);
            const mintAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            const freezeAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            
            // Define metadata fields
            
            // Create an empty account for the mint
            const mintKeypair = Keypair.generate();
            const mintPublicKey = mintKeypair.publicKey;

            setProposalDescription(`Create a new token ${mintPublicKey.toBase58()} with DAO mint authority & metadata`);            

            // Set up metadata
            const metadataProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"); // Token Metadata Program ID
            const metadataSeeds = [
                Buffer.from("metadata"),
                metadataProgramId.toBuffer(),
                mintPublicKey.toBuffer(),
            ];
            const [metadataPDA] = await PublicKey.findProgramAddress(metadataSeeds, metadataProgramId);
            const ixSigners = new Array();
            // Metadata to store in Mint Account
            const metaData: TokenMetadata = {
                updateAuthority: withPublicKey,
                mint: mintKeypair.publicKey,
                name: name,
                symbol: symbol,
                uri: uri,
                additionalMetadata: [["description", "The Vine Token by the Grape DAO"]],
            };

                // Calculate the rent-exempt balance needed
                const lamports = await getMinimumBalanceForRentExemptMint(connection);

                const pTransaction = new Transaction();
                // Create a transaction
                const transaction = new Transaction();

                // Instruction to create an account for the mint
                
                // we are using the keypair above
                /*
                const mint = await createMint(
                    connection,
                    withPublicKey,
                    mintAuthority,
                    freezeAuthority,
                    TOKEN_DECIMALS
                );
                */
                
                console.log("1. Create Sys Account");
                transaction.add(
                    SystemProgram.createAccount({
                        fromPubkey: withPublicKey, // Multi-sig wallet as the payer
                        newAccountPubkey: mintPublicKey,
                        space: MintLayout.span,
                        lamports: lamports,
                        programId: TOKEN_PROGRAM_ID,
                    })
                );
                ixSigners.push(mintKeypair);

                console.log("1. Create Token Mint Ix Account");
                /*
                const amountToMint = 1 * Math.pow(10, decimals);
                transaction.add(
                    createMintToCheckedInstruction(
                        mintPublicKey,
                        withPublicKey,
                        withPublicKey,
                        amountToMint,
                        decimals
                    )
                  );
                */
                  console.log("2. Init Mint");
                  // Instruction to initialize the mint
                  transaction.add(
                      createInitializeMintInstruction(
                          mintPublicKey,   // Address of the new mint
                          decimals,        // Number of decimals for the token
                          mintAuthority,   // Mint authority
                          null//freezeAuthority, // Freeze authority (optional)
                          //TOKEN_PROGRAM_ID // Program ID for the SPL Token program
                      )
                  );
                  //ixSigners.push([]);

                const block = await connection.getLatestBlockhash();
                transaction.recentBlockhash = block.blockhash;
                transaction.feePayer = publicKey;
                transaction.partialSign(mintKeypair);
                
                // Create metadata instruction
                /*
                const metadataBuilder = createMetadataAccountV3(
                    {
                    eddsa: null,
                    identity: {
                        publicKey: (withPublicKey.toBase58()),
                        signTransaction: async () => {
                        throw new Error("Direct signing is not supported in this example.");
                        },
                        signAllTransactions: async () => {
                        throw new Error("Direct signing is not supported in this example.");
                        },
                        signMessage: async () => {
                        throw new Error("Direct signing is not supported in this example.");
                        },
                    },
                    payer: {
                        publicKey: withPublicKey.toBase58(),
                        signTransaction: async () => {
                        throw new Error("Direct signing is not supported in this example.");
                        },
                        signAllTransactions: async () => {
                        throw new Error("Direct signing is not supported in this example.");
                        },
                        signMessage: async () => {
                        throw new Error("Direct signing is not supported in this example.");
                        },
                    },
                    },
                    {
                    metadata: metadataPDA.toBase58(),
                    mint: mintKeypair.publicKey.toBase58(),
                    mintAuthority: withPublicKey.toBase58(),
                    payer: withPublicKey.toBase58(),
                    updateAuthority: withPublicKey.toBase58(),
                    data: {
                        name: name,
                        symbol: symbol,
                        uri: uri,
                        sellerFeeBasisPoints: 500, // 5% royalties
                        creators: [
                        {
                            address: withPublicKey.toBase58(),
                            verified: true,
                            share: 100,
                        },
                        ],
                    },
                    }
                );
                // Convert Metaplex Instructions to Solana TransactionInstructions
                const metadataInstructions = metadataBuilder.getInstructions().map((ix) => {
                    return new TransactionInstruction({
                    keys: ix.keys.map((key) => ({
                        pubkey: new PublicKey(key.pubkey),
                        isSigner: key.isSigner,
                        isWritable: key.isWritable,
                    })),
                    programId: new PublicKey(ix.programId),
                    data: Buffer.from(ix.data),
                    });
                });

                // Add each converted instruction to the transaction
                metadataInstructions.forEach((instruction) => transaction.add(instruction));


                //metadataInstructions.forEach((instruction) => transaction.add(instruction));

                //transaction.add(metadataInstruction);
                */
                
                console.log("3. Mint Tokens Ix")
                
                /*
                
                transaction.add(
                    createMintToCheckedInstruction(
                        mintPublicKey, // mint
                        mintAuthority, // receiver (should be a token account)
                        mintAuthority, // mint authority
                        amountToMint, // amount. if your decimals is 8, you mint 10^8 for 1 token.
                        decimals, // decimals
                        // [signer1, signer2 ...], // only multisig account will use
                    ),
                );
                */

                /*
                transaction.add(
                    createInitializeInstruction({
                        programId: TOKEN_PROGRAM_ID, // Token Extension Program as Metadata Program
                        metadata: mintKeypair.publicKey, // Account address that holds the metadata
                        updateAuthority: mintAuthority, // Authority that can update the metadata
                        mint: mintKeypair.publicKey, // Mint Account address
                        mintAuthority: mintAuthority, // Designated Mint Authority
                        name: name,
                        symbol: symbol,
                        uri: uri,
                    })
                );
                */

                /*
                const updateFieldInstruction = createUpdateFieldInstruction({
                    programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
                    metadata: mint, // Account address that holds the metadata
                    updateAuthority: updateAuthority, // Authority that can update the metadata
                    field: metaData.additionalMetadata[0][0], // key
                    value: metaData.additionalMetadata[0][1], // value
                  });
                */

                
                
                // Add metadata instruction to the transaction
                //transaction.add(metadataInstruction);

            console.log("mintPublicKey: "+mintPublicKey.toBase58());
            
            // Sign and simulate
            //const latestBlockhash = await connection.getLatestBlockhash();
            //transaction.recentBlockhash = latestBlockhash.blockhash;
            //transaction.feePayer = withPublicKey;
            

            //console.log("4: To Sign");
            // Add the mint keypair as a signer
            //transaction.sign(mintKeypair);
            
            //console.log("5: serializing");

            //const signedTransaction = transaction.serialize();

            //console.log("6: serialized");

            const ixs = transaction;
            const aixs = pTransaction;
            
            if (ixs || aixs){
                const createTokenIx = {
                    title: proposalTitle,
                    description: proposalDescription,
                    ix: ixs?.instructions,
                    aix:aixs?.instructions,
                    signers: ixSigners,
                    nativeWallet:governanceNativeWallet,
                    governingMint:governingMint,
                    draft: isDraft,
                };

                console.log("passing siogner: "+JSON.stringify(ixSigners));

                const isSimulationSuccessful = await simulateCreateTokenIx(transaction);

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
        } catch (error) {
            enqueueSnackbar(`Error preparing create token instructions: ${error?.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

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
                        <Tab label="Create New Token" />
                        <Tab label="Manage/Mint Tokens" />
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
    
                            <Button
                                variant="contained"
                                onClick={() => createTokenIx()}
                                disabled={loading}
                            >
                                Prepare Create Token Instructions
                            </Button>
                        </Stack>
                    )}
    
                    {tabIndex === 1 && (
                        <Stack spacing={2} sx={{ pt: 2, pb: 2 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="h6">Manage/Mint Tokens</Typography>
                                <Tooltip title="Fetch Tokens for this DAO">
                                    <IconButton onClick={fetchCreatedTokensIx} disabled={loading}>
                                        <RefreshIcon />
                                    </IconButton>
                                </Tooltip>
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
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                placeholder="Enter amount to mint"
                            />
                            <Button
                                variant="contained"
                                onClick={() => mintMoreTokensIx()}
                                disabled={loading || !mintAddress || !amount}
                            >
                                Prepare Mint Tokens Instructions
                            </Button>
    
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
                                    proposalTitle={proposalTitle}
                                    setProposalTitle={setProposalTitle}
                                    proposalDescription={proposalDescription}
                                    setProposalDescription={setProposalDescription}
                                    toggleGoverningMintSelected={toggleGoverningMintSelected}
                                    isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
                                    isGoverningMintSelectable={isGoverningMintSelectable}
                                    isDraft={isDraft}
                                    setIsDraft={setIsDraft}
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
