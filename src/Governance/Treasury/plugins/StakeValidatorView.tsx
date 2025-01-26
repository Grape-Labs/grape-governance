import { AnchorProvider, web3 } from '@coral-xyz/anchor';
import { v4 as uuidv4 } from 'uuid';
import { 
    Signer, 
    Connection, 
    PublicKey, 
    SystemProgram,
    TransactionMessage, 
    Transaction, 
    VersionedTransaction, 
    TransactionInstruction,
    StakeProgram,
    Authorized,
    Lockup
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
import moment from "moment";
import axios from "axios";

import {
    getInstructionDataFromBase64,
    serializeInstructionToBase64,
  } from '@solana/spl-governance'

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';

import {
    Avatar,
    Chip,
    Typography,
    Button,
    Grid,
    Box,
    Table,
    Tooltip,
    LinearProgress,
    DialogTitle,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogActions,
    MenuItem,
    TextField,
    Stack,
    Switch,
    FormControl,
    FormControlLabel,
    InputAdornment,
    InputLabel,
    Select,
    List,
    ListItem,
    ListItemIcon,
    ListItemAvatar,
    ListItemText,
    SelectChangeEvent,
    FormGroup,
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import CodeIcon from '@mui/icons-material/Code';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import GetAppIcon from '@mui/icons-material/GetApp';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';

import AdvancedProposalView from './AdvancedProposalView';

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

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

export default function StakeValidatorView(props: any){
    const setReload = props?.setReload;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const [editProposalAddress, setEditProposalAddress] = React.useState(props?.editProposalAddress);
    const governingTokenMint = props.governingTokenMint;
    
    const preSelectedTokenAta = props?.preSelectedTokenAta;
    const useButtonText = props?.useButtonText;
    const useButtonType = props?.useButtonType;

    const masterWallet = props?.masterWallet;
    const usdcValue = props?.usdcValue;
    const realm = props?.realm;
    const governanceAddress = props.governanceAddress || realm.pubkey.toBase58();
    const rulesWallet = props?.rulesWallet;
    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const instructions = props?.instructions;
    const setInstructions = props?.setInstructions;

    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey } = useWallet();
    const wallet = useWallet();

    const [loading, setLoading] = React.useState(false);
    const [open, setPropOpen] = React.useState(false);
    const [openAdvanced, setOpenAdvanced] = React.useState(false);
    const [proposalTitle, setProposalTitle] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [governingMint, setGoverningMint] = React.useState(null);
    const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
    const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
    const [isDraft, setIsDraft] = React.useState(false);
    
    // New state variables for staking
    const [validatorVoteAddress, setValidatorVoteAddress] = React.useState('');
    const [stakeSeed, setStakeSeed] = React.useState(null);
    const [amount, setAmount] = React.useState('');

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const generateUniqueSeed = () => {
        return `stake-${uuidv4()}`;
    }

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

    const handleCloseDialog = () => {
        setPropOpen(false);
        if (handleCloseExtMenu)
            handleCloseExtMenu();
    }

    const handleClickOpen = () => {
        setPropOpen(true);
    };

    const handleClose = () => {
        setPropOpen(false);
        if (handleCloseExtMenu)
            handleCloseExtMenu();
    };

    // Helper function to split instructions into chunks
    const chunkInstructions = (instructions: TransactionInstruction[], chunkSize: number) => {
        const chunks = [];
        for (let i = 0; i < instructions.length; i += chunkSize) {
            chunks.push(instructions.slice(i, i + chunkSize));
        }
        return chunks;
    };

    const simulateIx = async (transaction: Transaction): Promise<boolean> => {
        try {
            const { blockhash } = await RPC_CONNECTION.getLatestBlockhash();
            const payerKey = new PublicKey(governanceNativeWallet);
            const transactionIxs: TransactionInstruction[] = transaction.instructions;

            for (const instructionChunk of chunkInstructions(transactionIxs, 10)) { // Adjust chunk size as needed
                const message = new TransactionMessage({
                    payerKey,
                    recentBlockhash: blockhash,
                    instructions: instructionChunk,
                }).compileToV0Message();
    
                const transaction = new VersionedTransaction(message);
    
                // Simulate the chunk
                const simulationResult = await RPC_CONNECTION.simulateTransaction(transaction);
                //setSimulationResults(simulationResult.value.logs);
    
                if (simulationResult.value.err) {
                    console.error("Chunk simulation failed with error:", simulationResult.value.err);
                    return false;
                }
    
                console.log("Chunk simulation successful.");
            }
    
            return true;
        } catch (error) {
            console.error("Error simulating large transaction:", error);
            return false;
        }
    };

    // New function to create staking instructions
    const createStakingInstructions = async (): Promise<TransactionInstruction[]> => {
        try {
            // Generate stake account public key using seed
            const seed = stakeSeed;
            const stakePubkey = await PublicKey.createWithSeed(
                new PublicKey(governanceNativeWallet),
                seed,
                StakeProgram.programId
            );

            // Create stake account if it does not exist
            const createStakeAccountIx = SystemProgram.createAccountWithSeed({
                fromPubkey: new PublicKey(governanceNativeWallet),
                newAccountPubkey: stakePubkey,
                basePubkey: new PublicKey(governanceNativeWallet),
                seed: seed,
                lamports: await RPC_CONNECTION.getMinimumBalanceForRentExemption(StakeProgram.space),
                space: StakeProgram.space,
                programId: StakeProgram.programId,
            });

            // Initialize the stake account
            const initializeStakeIx = StakeProgram.initialize({
                stakePubkey: stakePubkey,
                authorized: new Authorized(
                    new PublicKey(governanceNativeWallet),
                    new PublicKey(governanceNativeWallet)
                ),
                lockup: new Lockup(0, 0, new PublicKey(governanceNativeWallet)),
            });

            // Delegate the stake to the validator
            const delegateStakeIx = StakeProgram.delegate({
                stakePubkey: stakePubkey,
                authorizedPubkey: new PublicKey(governanceNativeWallet),
                votePubkey: new PublicKey(validatorVoteAddress),
            });

            // Assuming delegateStakeIx is a Transaction with only one instruction
            const instructions = delegateStakeIx.instructions;

            if (instructions.length !== 1) {
                throw new Error("Transaction does not contain exactly one instruction.");
            }

            const delegateStakeInstruction = instructions[0];

            return [createStakeAccountIx, initializeStakeIx, delegateStakeInstruction];
        } catch (error) {
            console.error("Error creating staking instructions:", error);
            throw error;
        }
    }

    const handleStakeIx = async () => {
        if (handleCloseExtMenu)
            handleCloseExtMenu();
        setPropOpen(false);

        try {
            const stakeAmount = parseFloat(amount);
            if (isNaN(stakeAmount) || stakeAmount <= 0) {
                enqueueSnackbar("Invalid amount", { variant: 'error' });
                return;
            }

            // Convert SOL amount to lamports
            const lamports = web3.LAMPORTS_PER_SOL * stakeAmount;

            // Create staking instructions
            const stakingIxs = await createStakingInstructions();

            // Create Transaction object
            // Simulate transaction
            const status = await simulateIx(new Transaction().add(...stakingIxs));
            if (!status) {
                enqueueSnackbar("Transaction simulation failed", { variant: 'error' });
                return;
            }

            // Prepare proposal instruction
            const propIx = {
                title: "Stake to Validator",
                description: `Staking ${stakeAmount} SOL to validator ${validatorVoteAddress}`,
                ix: stakingIxs,
                aix: [], // Additional instructions if any
                nativeWallet: governanceNativeWallet,
                governingMint: governingMint,
                draft: isDraft,
            }

            console.log("propIx: ", JSON.stringify(propIx));

            // Set instructions and trigger loader
            setInstructions(propIx);
            setExpandedLoader(true);
        } catch (error) {
            enqueueSnackbar("Failed to create staking instructions", { variant: 'error' });
            console.error('Failed to create staking instructions:', error);
        }
    }

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
        if (!stakeSeed){
            generateUniqueSeed();
        }
    }, []);

    return (
        <>
            <Tooltip title="Stake to Validator" placement="right">
                {useButtonText && useButtonType === 1 ?
                <>
                    <Button onClick={publicKey && handleClickOpen} fullWidth color='primary' size="large" variant="contained" sx={{backgroundColor:'rgba(255,255,255,0.05)',pl:2,pr:2,ml:1,mr:1}}>
                        {useButtonText}
                    </Button>
                </>
                :
                <>
                    {useButtonText && (useButtonType === 2 || useButtonType === 3) ? 
                        <>  
                            <Button color={'inherit'} variant='text' 
                                onClick={publicKey && handleClickOpen} 
                                sx={{m:0,p:0,
                                    '&:hover .MuiSvgIcon-root': {
                                        opacity: 1,
                                    },
                                }}
                                startIcon={
                                    <LockIcon 
                                        fontSize={'small'} 
                                        sx={{
                                            color:'rgba(255,255,255,0.25)',
                                            opacity: 0,
                                            pl:1,
                                            fontSize:"10px"}} />
                                }>
                                <Typography variant={useButtonType === 2 ? `h5`:`subtitle1`} sx={{color:'white'}}>
                                    {useButtonText}
                                </Typography>
                            </Button>
                        </>
                    :
                        <>
                            <MenuItem onClick={publicKey && handleClickOpen}>
                                <ListItemIcon>
                                    <LockIcon fontSize="small" />
                                </ListItemIcon>
                                Stake to Validator
                            </MenuItem>
                        </>
                    }
                </>}
            </Tooltip>
            
            <BootstrapDialog 
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
                    id='staking-dialog'
                    onClose={handleCloseDialog}
                >
                    Stake to Validator
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText sx={{textAlign:'center'}}>
                        Stake SOL to a Solana Validator
                    </DialogContentText>
                    
                    <FormControl fullWidth sx={{mt:2, mb:2}}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField 
                                    fullWidth 
                                    label="Validator Vote Address" 
                                    id="validatorVoteAddress"
                                    type="text"
                                    value={validatorVoteAddress}
                                    onChange={(e) => setValidatorVoteAddress(e.target.value)}
                                    variant="filled"
                                    required
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>
                            {/*
                            <Grid item xs={12}>
                                <TextField 
                                    fullWidth 
                                    label="Seed for Stake Address" 
                                    id="stakeSeed"
                                    type="text"
                                    value={stakeSeed}
                                    onChange={(e) => setStakeSeed(e.target.value)}
                                    variant="filled"
                                    required
                                    helperText="A unique seed string to generate the stake account."
                                    sx}={{ m: 0.65 }}
                                />
                            </Grid>
                            */}
                            <Grid item xs={12}>
                                <TextField 
                                    fullWidth 
                                    label="Seed for Stake Address" 
                                    id="stakeSeed"
                                    type="text"
                                    value={stakeSeed}
                                    onChange={(e) => setStakeSeed(e.target.value)}
                                    variant="filled"
                                    required
                                    helperText="A unique seed string to generate the stake account."
                                    sx={{ m: 0.65 }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label="regenerate seed"
                                                    onClick={() => setStakeSeed(generateUniqueSeed())}
                                                    edge="end"
                                                    size="small"
                                                >
                                                    <RefreshIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField 
                                    fullWidth 
                                    label="Amount (SOL)" 
                                    id="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    variant="filled"
                                    required
                                    inputProps={{ min: "0", step: "0.0001" }}
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>
                        </Grid>
                    </FormControl>
                
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

                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                        <Typography variant="caption">Made with ❤️ by Grape</Typography>
                    </Box>

                    <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p:0, pb:1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', p:0 }}>
                        {(publicKey) ?
                                <Button
                                    //disabled={!loading}
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
                        : <></>
                        }
                        </Box>

                        <Box sx={{ display: 'flex', p:0 }}>
                            
                            {(publicKey) ?
                                <Button 
                                   //disabled={!loading}
                                    autoFocus 
                                    onClick={handleStakeIx}
                                    sx={{
                                        p:1,
                                        borderRadius:'17px',
                                        '&:hover .MuiSvgIcon-root.claimNowIcon': {
                                            color:'rgba(255,255,255,0.90)'
                                        }
                                    }}
                                    startIcon={
                                    <>
                                        <LockIcon 
                                            sx={{
                                                color:'rgba(255,255,255,0.25)',
                                                fontSize:"14px!important"}}
                                        />
                                    </>
                                    }
                                >
                                    Create Stake Account
                                </Button>
                            : <></>
                            }
                        </Box>
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}
