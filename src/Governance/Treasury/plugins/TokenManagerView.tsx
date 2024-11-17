import { 
    PublicKey, 
    Connection, 
    Keypair, 
    SystemProgram,
    Transaction,
    TransactionMessage,
    VersionedTransaction } from '@solana/web3.js';
import axios from "axios";
import { 
    TOKEN_PROGRAM_ID, 
    getMint, 
    createMint, 
    mintTo, 
    getOrCreateAssociatedTokenAccount,
    MintLayout,
    getMinimumBalanceForRentExemptMint,
    createInitializeMintInstruction,
} from "@solana/spl-token-v2";
import { Metadata, createCreateMetadataAccountV2Instruction } from '@metaplex-foundation/mpl-token-metadata';
import { Buffer } from 'buffer';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';
import React, { useCallback, useState, useEffect } from 'react';
import {
    Button,
    DialogTitle,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogActions,
    TextField,
    Box,
    Typography,
    Stack,
    MenuItem,
    ListItemIcon,
    Tooltip,
} from '@mui/material/';
import { useSnackbar } from 'notistack';
import { styled } from '@mui/material/styles';

import TollIcon from '@mui/icons-material/Toll';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuiDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

const TOKEN_DECIMALS = 9; // Adjust based on your token setup

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
    const { publicKey } = useWallet();
    const wallet = useWallet();
    
    const [governingMint, setGoverningMint] = React.useState(null);
    const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
    const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
    const [isDraft, setIsDraft] = React.useState(false);


    const { enqueueSnackbar } = useSnackbar();
    const [tokens, setTokens] = useState([]);
    const [mintAddress, setMintAddress] = useState('');
    const [amount, setAmount] = useState(0);
    const [proposalTitle, setProposalTitle] = useState('');
    const [proposalDescription, setProposalDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [open, setPropOpen] = React.useState(false);

    const connection = RPC_CONNECTION; // Change to your desired network

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

            const mintTokenIx = {
                title: `Mint More Tokens`,
                description: `Mint ${amount} tokens to the associated account`,
                instructions: [mintIx],
                mint: mintPubKey,
                amount: amount,
                destination: associatedTokenAccount.address,
            };

            setInstructions(mintTokenIx);
            setExpandedLoader(true);

            enqueueSnackbar("Mint instructions prepared", { variant: 'success' });
        } catch (error) {
            enqueueSnackbar(`Error preparing mint instructions: ${error?.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };


    React.useEffect(() => { 
        setIsGoverningMintSelectable(false);
        if (realm && realm?.account.config?.councilMint){
            setGoverningMint(realm?.account.config.councilMint);
            setIsGoverningMintCouncilSelected(true);
            if (realm && realm?.account?.communityMint){
                if (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) !== 18446744073709551615){
                    setGoverningMint(realm?.account.communityMint);
                    setIsGoverningMintSelectable(true);
                    setIsGoverningMintCouncilSelected(false);
                }
            }
        } else {
            if (realm && realm?.account?.communityMint){
                setGoverningMint(realm?.account.communityMint);
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
    

    const createTokenIx = async () => {
        setLoading(true);

        try {

            const withPublicKey = new PublicKey(governanceNativeWallet);
            const mintAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            const freezeAuthority = new PublicKey(governanceNativeWallet); //publicKey;
            const decimals = 6;

                // Create an empty account for the mint
                const mintKeypair = Keypair.generate();
                const mintPublicKey = mintKeypair.publicKey;
        
                // Calculate the rent-exempt balance needed
                const lamports = await getMinimumBalanceForRentExemptMint(connection);

                const pTransaction = new Transaction();
                // Create a transaction
                const transaction = new Transaction();
        
                // Instruction to create an account for the mint
                transaction.add(
                    SystemProgram.createAccount({
                        fromPubkey: withPublicKey, // Multi-sig wallet as the payer
                        newAccountPubkey: mintPublicKey,
                        space: MintLayout.span,
                        lamports: lamports,
                        programId: TOKEN_PROGRAM_ID,
                    })
                );

                // Instruction to initialize the mint
                transaction.add(
                    createInitializeMintInstruction(
                        mintPublicKey,   // Address of the new mint
                        decimals,        // Number of decimals for the token
                        mintAuthority,   // Mint authority
                        freezeAuthority, // Freeze authority (optional)
                        TOKEN_PROGRAM_ID // Program ID for the SPL Token program
                    )
                );
                

                // Set up metadata
                const metadataProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"); // Token Metadata Program ID
                const metadataSeeds = [
                    Buffer.from("metadata"),
                    metadataProgramId.toBuffer(),
                    mintPublicKey.toBuffer(),
                ];
                const [metadataPDA] = await PublicKey.findProgramAddress(metadataSeeds, metadataProgramId);

                // Define metadata fields
                const name = "My CollabX Token";
                const symbol = "MCXT";
                const uri = "https://arweave.net/lyeMvAF6kpccNhJ0XXPkrplbcT6A5UtgBiZI_fKff6I"; // Vine URI for now

                // Create the metadata instruction
                const metadataInstruction = createCreateMetadataAccountV2Instruction(
                    {
                        metadata: metadataPDA,
                        mint: mintPublicKey,
                        mintAuthority: mintAuthority,
                        payer: withPublicKey,
                        updateAuthority: mintAuthority,
                    },
                    {
                        createMetadataAccountArgsV2: {
                            data: {
                                name: name,
                                symbol: symbol,
                                uri: uri,
                                sellerFeeBasisPoints: 0, // Example: 5% royalty (500 basis points)
                                creators: [
                                    {
                                        address: mintAuthority,
                                        verified: true,
                                        share: 100,
                                    },
                                ],
                                collection: null, // Optional collection field
                                uses: null, // Optional uses field
                            },
                            isMutable: true,
                        },
                    }
                );

                // Add metadata instruction to the transaction
                //transaction.add(metadataInstruction);

                /*
                const mint = await createMint(
                    connection,
                    new PublicKey(governanceNativeWallet),
                    mintAuthority,
                    freezeAuthority,
                    TOKEN_DECIMALS
                );
                */
            
            console.log("mintPublicKey: "+mintPublicKey.toBase58());
            
            const aixs = pTransaction;

            const createTokenIx = {
                title: `Create New Token with Metadata`,
                description: `Create a new token with mint authority & metadata`,
                ix: transaction.instructions,
                aix:aixs?.instructions,
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
            setInstructions(createTokenIx);
            setExpandedLoader(true);

            enqueueSnackbar("Create token instructions prepared", { variant: 'success' });
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

            <BootstrapDialog 
                //maxWidth={"xl"}
                fullWidth={true}
                open={open} onClose={handleClose}
                PaperProps={{
                    style: {
                        background: '#13151C',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px'
                    }
                    }}
                >
                <BootstrapDialogTitle 
                    id='extensions-dialog'
                    onClose={handleCloseDialog}
                >Token Manager</BootstrapDialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Manage DAO tokens - fetch created tokens, mint more, and create new tokens.
                    </DialogContentText>
                    
                    <Stack spacing={2} sx={{ mt: 2 }}>
                        <Button
                            variant="contained"
                            onClick={fetchCreatedTokensIx}
                            disabled={loading}
                        >
                            Fetch Tokens for this DAO
                        </Button>
                        
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
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <Button
                            variant="contained"
                            onClick={mintMoreTokensIx}
                            disabled={loading || !mintAddress || !amount}
                        >
                            Prepare Mint Tokens Instructions
                        </Button>

                        <Button
                            variant="contained"
                            onClick={createTokenIx}
                            disabled={loading}
                        >
                            Prepare Create Token Instructions
                        </Button>
                    </Stack>

                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h6">Created Tokens:</Typography>
                        {tokens && tokens.map((token, index) => (
                            <Box key={index} sx={{ mt: 1 }}>
                                <Typography variant="body1">Mint Address: {token.address}</Typography>
                                <Typography variant="body2">Decimals: {Number(token.decimals)}</Typography>
                                <Typography variant="body2">Supply: {Number(token.supply)}</Typography>
                            </Box>
                        ))}
                        {tokens && tokens.length <= 0 && 
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="body1">no tokens found</Typography>
                            </Box>
                        }
                    </Box>
                </DialogContent>
            </BootstrapDialog>
        </>
    );
}
