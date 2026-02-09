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
    Tab,
    Tabs,
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import CodeIcon from '@mui/icons-material/Code';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
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

// Tab panel helper component
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`stake-tabpanel-${index}`}
            aria-labelledby={`stake-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
        </div>
    );
}

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
    
    // Tab state: 0 = Stake, 1 = Unstake
    const [tabValue, setTabValue] = React.useState(0);

    // Staking state
    const [validatorVoteAddress, setValidatorVoteAddress] = React.useState('');
    const [stakeSeed, setStakeSeed] = React.useState<string | null>(null);
    const [amount, setAmount] = React.useState('');

    // Unstaking state
    const [unstakeAddress, setUnstakeAddress] = React.useState('');
    const [stakeAccounts, setStakeAccounts] = React.useState<any[]>([]);
    const [loadingStakeAccounts, setLoadingStakeAccounts] = React.useState(false);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const generateUniqueSeed = (): string => {
        const seed = `stake-${uuidv4().substring(0, 8)}`;
        return seed;
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

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
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

            for (const instructionChunk of chunkInstructions(transactionIxs, 10)) {
                const message = new TransactionMessage({
                    payerKey,
                    recentBlockhash: blockhash,
                    instructions: instructionChunk,
                }).compileToV0Message();
    
                const transaction = new VersionedTransaction(message);
    
                const simulationResult = await RPC_CONNECTION.simulateTransaction(transaction);
    
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

    // Fetch stake accounts owned by the governance native wallet
    const fetchStakeAccounts = async () => {
        try {
            setLoadingStakeAccounts(true);
            const nativeWalletPubkey = new PublicKey(governanceNativeWallet);

            // Get all stake accounts where the staker authority is the governance wallet
            const stakeAccountsResponse = await RPC_CONNECTION.getParsedProgramAccounts(
                StakeProgram.programId,
                {
                    filters: [
                        {
                            memcmp: {
                                offset: 12, // Offset for the staker authority in stake account data
                                bytes: nativeWalletPubkey.toBase58(),
                            },
                        },
                    ],
                }
            );

            const accounts = stakeAccountsResponse.map((account: any) => {
                const parsedData = account.account.data?.parsed?.info;
                const stakeInfo = parsedData?.stake;
                const meta = parsedData?.meta;
                
                return {
                    pubkey: account.pubkey.toBase58(),
                    lamports: account.account.lamports,
                    validatorVoteAccount: stakeInfo?.delegation?.voter || 'N/A',
                    activationEpoch: stakeInfo?.delegation?.activationEpoch || 'N/A',
                    deactivationEpoch: stakeInfo?.delegation?.deactivationEpoch || 'N/A',
                    staker: meta?.authorized?.staker || 'N/A',
                    withdrawer: meta?.authorized?.withdrawer || 'N/A',
                    state: parsedData?.type || 'unknown', // 'delegated', 'initialized', 'inactive', etc.
                };
            });

            setStakeAccounts(accounts);
        } catch (error) {
            console.error("Error fetching stake accounts:", error);
            enqueueSnackbar("Failed to fetch stake accounts", { variant: 'error' });
        } finally {
            setLoadingStakeAccounts(false);
        }
    };

    // Create staking instructions (with bug fixes)
    const createStakingInstructions = async (stakeAmountLamports: number): Promise<TransactionInstruction[]> => {
        try {
            const seed = stakeSeed;
            const nativeWalletPubkey = new PublicKey(governanceNativeWallet);
            
            const stakePubkey = await PublicKey.createWithSeed(
                nativeWalletPubkey,
                seed,
                StakeProgram.programId
            );

            const rentExemptLamports = await RPC_CONNECTION.getMinimumBalanceForRentExemption(StakeProgram.space);

            // BUG FIX: Include the actual stake amount + rent in the account creation
            const createStakeAccountIx = SystemProgram.createAccountWithSeed({
                fromPubkey: nativeWalletPubkey,
                newAccountPubkey: stakePubkey,
                basePubkey: nativeWalletPubkey,
                seed: seed,
                lamports: rentExemptLamports + stakeAmountLamports,
                space: StakeProgram.space,
                programId: StakeProgram.programId,
            });

            // StakeProgram methods may return Transaction or TransactionInstruction depending on version
            const initializeResult = StakeProgram.initialize({
                stakePubkey: stakePubkey,
                authorized: new Authorized(
                    nativeWalletPubkey,
                    nativeWalletPubkey
                ),
                lockup: new Lockup(0, 0, nativeWalletPubkey),
            });

            const initializeStakeIx = 'instructions' in (initializeResult as any)
                ? (initializeResult as any).instructions[0] as TransactionInstruction
                : initializeResult as unknown as TransactionInstruction;

            // Delegate the stake to the validator
            const delegateResult = StakeProgram.delegate({
                stakePubkey: stakePubkey,
                authorizedPubkey: nativeWalletPubkey,
                votePubkey: new PublicKey(validatorVoteAddress),
            });

            const delegateStakeIx = 'instructions' in (delegateResult as any)
                ? (delegateResult as any).instructions[0] as TransactionInstruction
                : delegateResult as unknown as TransactionInstruction;

            return [createStakeAccountIx, initializeStakeIx, delegateStakeIx];
        } catch (error) {
            console.error("Error creating staking instructions:", error);
            throw error;
        }
    }

    // Create deactivate (unstake) instructions
    const createDeactivateInstructions = (stakeAccountPubkey: PublicKey): TransactionInstruction[] => {
        try {
            const nativeWalletPubkey = new PublicKey(governanceNativeWallet);

            const deactivateResult = StakeProgram.deactivate({
                stakePubkey: stakeAccountPubkey,
                authorizedPubkey: nativeWalletPubkey,
            });

            const deactivateIx = 'instructions' in (deactivateResult as any)
                ? (deactivateResult as any).instructions[0] as TransactionInstruction
                : deactivateResult as unknown as TransactionInstruction;

            return [deactivateIx];
        } catch (error) {
            console.error("Error creating deactivate instructions:", error);
            throw error;
        }
    }

    // Create withdraw instructions (for fully deactivated stake accounts)
    const createWithdrawInstructions = (stakeAccountPubkey: PublicKey, lamports: number): TransactionInstruction[] => {
        try {
            const nativeWalletPubkey = new PublicKey(governanceNativeWallet);

            const withdrawResult = StakeProgram.withdraw({
                stakePubkey: stakeAccountPubkey,
                authorizedPubkey: nativeWalletPubkey,
                toPubkey: nativeWalletPubkey,
                lamports: lamports,
            });

            const withdrawIx = 'instructions' in (withdrawResult as any)
                ? (withdrawResult as any).instructions[0] as TransactionInstruction
                : withdrawResult as unknown as TransactionInstruction;

            return [withdrawIx];
        } catch (error) {
            console.error("Error creating withdraw instructions:", error);
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

            if (!validatorVoteAddress) {
                enqueueSnackbar("Please enter a validator vote address", { variant: 'error' });
                return;
            }

            if (!stakeSeed) {
                enqueueSnackbar("Please enter a seed for the stake account", { variant: 'error' });
                return;
            }

            // Convert SOL amount to lamports
            const stakeAmountLamports = Math.floor(web3.LAMPORTS_PER_SOL * stakeAmount);

            // Create staking instructions with the actual stake amount
            const stakingIxs = await createStakingInstructions(stakeAmountLamports);

            // Simulate transaction
            const status = await simulateIx(new Transaction().add(...stakingIxs));
            if (!status) {
                enqueueSnackbar("Transaction simulation failed", { variant: 'error' });
                return;
            }

            const propIx = {
                title: proposalTitle || "Stake to Validator",
                description: proposalDescription || `Staking ${stakeAmount} SOL to validator ${validatorVoteAddress}`,
                ix: stakingIxs,
                aix: [],
                nativeWallet: governanceNativeWallet,
                governingMint: governingMint,
                draft: isDraft,
            }

            console.log("propIx: ", JSON.stringify(propIx));

            setInstructions(propIx);
            setExpandedLoader(true);
        } catch (error) {
            enqueueSnackbar("Failed to create staking instructions", { variant: 'error' });
            console.error('Failed to create staking instructions:', error);
        }
    }

    // Handle deactivate (begin unstaking cooldown)
    const handleDeactivateIx = async (stakeAccountAddress: string) => {
        if (handleCloseExtMenu)
            handleCloseExtMenu();
        setPropOpen(false);

        try {
            const stakeAccountPubkey = new PublicKey(stakeAccountAddress);
            const deactivateIxs = createDeactivateInstructions(stakeAccountPubkey);

            // Simulate
            const status = await simulateIx(new Transaction().add(...deactivateIxs));
            if (!status) {
                enqueueSnackbar("Transaction simulation failed", { variant: 'error' });
                return;
            }

            const propIx = {
                title: proposalTitle || "Deactivate Stake",
                description: proposalDescription || `Deactivate stake account ${stakeAccountAddress}`,
                ix: deactivateIxs,
                aix: [],
                nativeWallet: governanceNativeWallet,
                governingMint: governingMint,
                draft: isDraft,
            }

            console.log("propIx (deactivate): ", JSON.stringify(propIx));

            setInstructions(propIx);
            setExpandedLoader(true);
        } catch (error) {
            enqueueSnackbar("Failed to create deactivate instructions", { variant: 'error' });
            console.error('Failed to create deactivate instructions:', error);
        }
    }

    // Handle withdraw (after cooldown is complete)
    const handleWithdrawIx = async (stakeAccountAddress: string, lamports: number) => {
        if (handleCloseExtMenu)
            handleCloseExtMenu();
        setPropOpen(false);

        try {
            const stakeAccountPubkey = new PublicKey(stakeAccountAddress);
            const withdrawIxs = createWithdrawInstructions(stakeAccountPubkey, lamports);

            // Simulate
            const status = await simulateIx(new Transaction().add(...withdrawIxs));
            if (!status) {
                enqueueSnackbar("Transaction simulation failed", { variant: 'error' });
                return;
            }

            const propIx = {
                title: proposalTitle || "Withdraw Stake",
                description: proposalDescription || `Withdraw ${(lamports / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL from stake account ${stakeAccountAddress}`,
                ix: withdrawIxs,
                aix: [],
                nativeWallet: governanceNativeWallet,
                governingMint: governingMint,
                draft: isDraft,
            }

            console.log("propIx (withdraw): ", JSON.stringify(propIx));

            setInstructions(propIx);
            setExpandedLoader(true);
        } catch (error) {
            enqueueSnackbar("Failed to create withdraw instructions", { variant: 'error' });
            console.error('Failed to create withdraw instructions:', error);
        }
    }

    // Handle unstake using a manually entered address
    const handleUnstakeManual = async () => {
        if (!unstakeAddress) {
            enqueueSnackbar("Please enter a stake account address", { variant: 'error' });
            return;
        }

        try {
            const stakeAccountPubkey = new PublicKey(unstakeAddress);
            
            // Fetch the account to determine its state
            const accountInfo = await RPC_CONNECTION.getParsedAccountInfo(stakeAccountPubkey);
            
            if (!accountInfo || !accountInfo.value) {
                enqueueSnackbar("Stake account not found", { variant: 'error' });
                return;
            }

            const parsedData = (accountInfo.value.data as any)?.parsed?.info;
            const stakeType = parsedData?.type; // 'delegated', 'initialized', 'inactive'
            const deactivationEpoch = parsedData?.stake?.delegation?.deactivationEpoch;
            const lamports = accountInfo.value.lamports;

            const currentEpoch = (await RPC_CONNECTION.getEpochInfo()).epoch;

            if (stakeType === 'delegated' && deactivationEpoch === '18446744073709551615') {
                // Active stake — needs deactivation first
                await handleDeactivateIx(unstakeAddress);
            } else if (stakeType === 'delegated' && Number(deactivationEpoch) <= currentEpoch) {
                // Deactivated and cooldown complete — withdraw
                await handleWithdrawIx(unstakeAddress, lamports);
            } else if (stakeType === 'initialized' || stakeType === 'inactive') {
                // Not delegated — can withdraw directly
                await handleWithdrawIx(unstakeAddress, lamports);
            } else {
                // Still in cooldown
                enqueueSnackbar(`Stake is deactivating. Cooldown ends after epoch ${deactivationEpoch}. Current epoch: ${currentEpoch}`, { variant: 'warning' });
            }
        } catch (error) {
            enqueueSnackbar("Failed to process unstake", { variant: 'error' });
            console.error('Failed to process unstake:', error);
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
        // BUG FIX: Actually set the seed state
        if (!stakeSeed){
            setStakeSeed(generateUniqueSeed());
        }
    }, []);

    // Fetch stake accounts when the unstake tab is opened
    React.useEffect(() => {
        if (tabValue === 1 && open && governanceNativeWallet) {
            fetchStakeAccounts();
        }
    }, [tabValue, open]);

    return (
        <>
            <Tooltip title="Stake / Unstake Validator" placement="right">
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
                                Stake / Unstake
                            </MenuItem>
                        </>
                    }
                </>}
            </Tooltip>
            
            <BootstrapDialog 
                fullWidth={true}
                maxWidth="sm"
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
                    Stake / Unstake Validator
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <Tabs 
                        value={tabValue} 
                        onChange={handleTabChange} 
                        centered
                        sx={{
                            '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)' },
                            '& .Mui-selected': { color: 'white' },
                            '& .MuiTabs-indicator': { backgroundColor: 'white' },
                        }}
                    >
                        <Tab icon={<LockIcon />} label="Stake" iconPosition="start" />
                        <Tab icon={<LockOpenIcon />} label="Unstake" iconPosition="start" />
                    </Tabs>

                    {/* ==================== STAKE TAB ==================== */}
                    <TabPanel value={tabValue} index={0}>
                        <DialogContentText sx={{textAlign:'center', mb: 2}}>
                            Stake SOL to a Solana Validator
                        </DialogContentText>
                        
                        <FormControl fullWidth>
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
                                <Grid item xs={12}>
                                    <TextField 
                                        fullWidth 
                                        label="Seed for Stake Address" 
                                        id="stakeSeed"
                                        type="text"
                                        value={stakeSeed || ''}
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
                    </TabPanel>

                    {/* ==================== UNSTAKE TAB ==================== */}
                    <TabPanel value={tabValue} index={1}>
                        <DialogContentText sx={{textAlign:'center', mb: 2}}>
                            Deactivate or withdraw from a stake account
                        </DialogContentText>

                        <FormControl fullWidth>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField 
                                        fullWidth 
                                        label="Stake Account Address" 
                                        id="unstakeAddress"
                                        type="text"
                                        value={unstakeAddress}
                                        onChange={(e) => setUnstakeAddress(e.target.value)}
                                        variant="filled"
                                        required
                                        helperText="Enter a stake account address to deactivate or withdraw."
                                        sx={{ m: 0.65 }}
                                    />
                                </Grid>
                            </Grid>
                        </FormControl>

                        {/* List of existing stake accounts */}
                        {loadingStakeAccounts ? (
                            <Box sx={{ mt: 2 }}>
                                <LinearProgress />
                                <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                                    Loading stake accounts...
                                </Typography>
                            </Box>
                        ) : stakeAccounts.length > 0 ? (
                            <Box sx={{ mt: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                        Governance Stake Accounts
                                    </Typography>
                                    <IconButton size="small" onClick={fetchStakeAccounts}>
                                        <RefreshIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                                <List dense sx={{ maxHeight: 250, overflow: 'auto' }}>
                                    {stakeAccounts.map((account, index) => {
                                        const isActive = account.state === 'delegated' && account.deactivationEpoch === '18446744073709551615';
                                        const isDeactivating = account.state === 'delegated' && account.deactivationEpoch !== '18446744073709551615';
                                        const isInactive = account.state === 'initialized' || account.state === 'inactive';

                                        let statusLabel = 'Unknown';
                                        let statusColor = 'rgba(255,255,255,0.5)';
                                        if (isActive) { statusLabel = 'Active'; statusColor = '#4caf50'; }
                                        else if (isDeactivating) { statusLabel = 'Deactivating'; statusColor = '#ff9800'; }
                                        else if (isInactive) { statusLabel = 'Inactive'; statusColor = '#f44336'; }

                                        return (
                                            <ListItem 
                                                key={index}
                                                sx={{ 
                                                    borderRadius: '10px', 
                                                    mb: 0.5, 
                                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                                    cursor: 'pointer',
                                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.07)' }
                                                }}
                                                onClick={() => setUnstakeAddress(account.pubkey)}
                                                secondaryAction={
                                                    <Chip 
                                                        label={statusLabel} 
                                                        size="small"
                                                        sx={{ 
                                                            color: statusColor, 
                                                            borderColor: statusColor,
                                                            fontSize: '0.7rem'
                                                        }} 
                                                        variant="outlined"
                                                    />
                                                }
                                            >
                                                <ListItemIcon>
                                                    <LockIcon fontSize="small" sx={{ color: statusColor }} />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                            {account.pubkey.substring(0, 8)}...{account.pubkey.substring(account.pubkey.length - 8)}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                                            {(account.lamports / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL
                                                            {account.validatorVoteAccount !== 'N/A' && 
                                                                ` • Validator: ${account.validatorVoteAccount.substring(0, 6)}...`
                                                            }
                                                        </Typography>
                                                    }
                                                />
                                            </ListItem>
                                        );
                                    })}
                                </List>
                            </Box>
                        ) : (
                            <Box sx={{ mt: 2, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                    No stake accounts found for this governance wallet.
                                </Typography>
                            </Box>
                        )}
                    </TabPanel>
                
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
                                <>
                                    {tabValue === 0 ? (
                                        <Button 
                                            autoFocus 
                                            onClick={handleStakeIx}
                                            sx={{
                                                p:1,
                                                borderRadius:'17px',
                                                '&:hover .MuiSvgIcon-root': {
                                                    color:'rgba(255,255,255,0.90)'
                                                }
                                            }}
                                            startIcon={<LockIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:"14px!important"}} />}
                                        >
                                            Create Stake Account
                                        </Button>
                                    ) : (
                                        <Button 
                                            autoFocus 
                                            onClick={handleUnstakeManual}
                                            sx={{
                                                p:1,
                                                borderRadius:'17px',
                                                '&:hover .MuiSvgIcon-root': {
                                                    color:'rgba(255,255,255,0.90)'
                                                }
                                            }}
                                            startIcon={<LockOpenIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:"14px!important"}} />}
                                        >
                                            Unstake
                                        </Button>
                                    )}
                                </>
                            : <></>
                            }
                        </Box>
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}