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

// Helper to extract instruction from StakeProgram methods
// (some @solana/web3.js versions return Transaction, others return TransactionInstruction)
const extractInstruction = (result: any): TransactionInstruction => {
    if ('instructions' in result) {
        return result.instructions[0] as TransactionInstruction;
    }
    return result as TransactionInstruction;
};

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

    const fetchStakeAccountsInFlight = React.useRef(false);
    const fetchStakeAccountsKeyRef = React.useRef<string>("");
    const fetchStakeAccountsAbortRef = React.useRef<AbortController | null>(null);
    const stakeAccountsCacheRef = React.useRef<{
    wallet: string | null;
    accounts: any[] | null;
    }>({ wallet: null, accounts: null });

    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey } = useWallet();
    const fetchedOnOpenRef = React.useRef(false);

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
    const [unstakeAction, setUnstakeAction] = React.useState<'deactivate' | 'withdraw'>('deactivate');
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

const fetchStakeAccounts = React.useCallback(
  async (force = false) => {
    if (!governanceNativeWallet) return;

    // ✅ Serve from cache
    if (
      !force &&
      stakeAccountsCacheRef.current.wallet === governanceNativeWallet &&
      stakeAccountsCacheRef.current.accounts
    ) {
      setStakeAccounts(stakeAccountsCacheRef.current.accounts);
      return;
    }

    setLoadingStakeAccounts(true);

    const U64_MAX = "18446744073709551615";

    // Helper to find an array anywhere reasonable in Shyft response
    const extractStakeArray = (data: any): any[] => {
      if (!data) return [];

      // most common patterns
      if (Array.isArray(data.result)) return data.result;
      if (Array.isArray(data.result?.data)) return data.result.data;
      if (Array.isArray(data.result?.stake_accounts)) return data.result.stake_accounts;
      if (Array.isArray(data.result?.accounts)) return data.result.accounts;

      // sometimes it’s nested differently
      if (Array.isArray(data.data)) return data.data;

      return [];
    };

    const normalizePubkey = (a: any): string | null => {
      const k =
        a?.pubkey ??
        a?.address ??
        a?.stake_account ??
        a?.stakeAccount ??
        a?.account;
      return typeof k === "string" && k.length >= 32 ? k : null;
    };

    try {
      let accounts: any[] = [];

      // -------- SHYFT --------
      try {
        const { data } = await axios.get(
          "https://api.shyft.to/sol/v1/wallet/stake_accounts",
          {
            params: {
              network: "mainnet-beta",
              wallet_address: governanceNativeWallet,
            },
            headers: { "x-api-key": SHYFT_KEY },
            timeout: 10_000,
          }
        );

        const arr = extractStakeArray(data);

        // ✅ If Shyft returned stake accounts, we STOP here (no RPC)
        if (arr.length > 0) {
          accounts = arr
            .map((a: any) => {
              const pubkey = normalizePubkey(a);
              if (!pubkey) return null;

              const d = a.stake?.delegation;
              const deact =
                d?.deactivation_epoch ??
                d?.deactivationEpoch ??
                "N/A";

              let state = "inactive";
              if (d && String(deact) === U64_MAX) state = "active";
              else if (d && String(deact) !== "N/A") state = "deactivating";
              else if (a.type === "initialized") state = "initialized";

              return {
                pubkey,
                lamports: a.lamports ?? 0,
                balance: a.balance ?? null,
                validatorVoteAccount: d?.voter || "N/A",
                activationEpoch:
                  d?.activation_epoch ??
                  d?.activationEpoch ??
                  "N/A",
                deactivationEpoch: deact,
                state,
              };
            })
            .filter(Boolean) as any[];

          // ✅ Cache + set + return early (prevents RPC fallback)
          stakeAccountsCacheRef.current = {
            wallet: governanceNativeWallet,
            accounts,
          };
          setStakeAccounts(accounts);
          return;
        }

        // If Shyft returned *no array*, treat as failure to trigger fallback
        throw new Error("Shyft: no stake accounts array found in response shape");
      } catch (shyftErr) {
        // -------- RPC FALLBACK --------
        console.warn("Shyft stake_accounts failed; falling back to RPC:", shyftErr);

        const walletPk = new PublicKey(governanceNativeWallet);
        const programAccounts =
          await RPC_CONNECTION.getParsedProgramAccounts(StakeProgram.programId);

        accounts = programAccounts
          .filter((acc) => {
            const auth = acc.account.data?.parsed?.info?.meta?.authorized;
            return (
              auth?.staker === walletPk.toBase58() ||
              auth?.withdrawer === walletPk.toBase58()
            );
          })
          .map((acc) => {
            const info = acc.account.data.parsed.info;
            const d = info.stake?.delegation;
            const deact = d?.deactivationEpoch ?? "N/A";

            let state = info.type;
            if (info.type === "delegated" && String(deact) === U64_MAX) state = "active";
            else if (info.type === "delegated") state = "deactivating";

            return {
              pubkey: acc.pubkey.toBase58(),
              lamports: acc.account.lamports,
              balance: null,
              validatorVoteAccount: d?.voter || "N/A",
              activationEpoch: d?.activationEpoch || "N/A",
              deactivationEpoch: deact,
              state,
            };
          });
      }

      // ✅ Cache result (RPC or Shyft)
      stakeAccountsCacheRef.current = {
        wallet: governanceNativeWallet,
        accounts,
      };
      setStakeAccounts(accounts);
    } catch (e) {
      console.error(e);
      enqueueSnackbar("Failed to fetch stake accounts", { variant: "error" });
      setStakeAccounts([]);
    } finally {
      setLoadingStakeAccounts(false);
    }
  },
  [governanceNativeWallet, enqueueSnackbar]
);

    // Create staking instructions
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

            const createStakeAccountIx = SystemProgram.createAccountWithSeed({
                fromPubkey: nativeWalletPubkey,
                newAccountPubkey: stakePubkey,
                basePubkey: nativeWalletPubkey,
                seed: seed,
                lamports: rentExemptLamports + stakeAmountLamports,
                space: StakeProgram.space,
                programId: StakeProgram.programId,
            });

            const initializeStakeIx = extractInstruction(
                StakeProgram.initialize({
                    stakePubkey: stakePubkey,
                    authorized: new Authorized(
                        nativeWalletPubkey,
                        nativeWalletPubkey
                    ),
                    lockup: new Lockup(0, 0, nativeWalletPubkey),
                })
            );

            const delegateStakeIx = extractInstruction(
                StakeProgram.delegate({
                    stakePubkey: stakePubkey,
                    authorizedPubkey: nativeWalletPubkey,
                    votePubkey: new PublicKey(validatorVoteAddress),
                })
            );

            return [createStakeAccountIx, initializeStakeIx, delegateStakeIx];
        } catch (error) {
            console.error("Error creating staking instructions:", error);
            throw error;
        }
    }

    // Create deactivate instructions
    const createDeactivateInstructions = (stakeAccountPubkey: PublicKey): TransactionInstruction[] => {
        try {
            const nativeWalletPubkey = new PublicKey(governanceNativeWallet);

            const deactivateIx = extractInstruction(
                StakeProgram.deactivate({
                    stakePubkey: stakeAccountPubkey,
                    authorizedPubkey: nativeWalletPubkey,
                })
            );

            return [deactivateIx];
        } catch (error) {
            console.error("Error creating deactivate instructions:", error);
            throw error;
        }
    }

    // Create withdraw instructions
    const createWithdrawInstructions = (stakeAccountPubkey: PublicKey, lamports: number): TransactionInstruction[] => {
        try {
            const nativeWalletPubkey = new PublicKey(governanceNativeWallet);

            const withdrawIx = extractInstruction(
                StakeProgram.withdraw({
                    stakePubkey: stakeAccountPubkey,
                    authorizedPubkey: nativeWalletPubkey,
                    toPubkey: nativeWalletPubkey,
                    lamports: lamports,
                })
            );

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

            const stakeAmountLamports = Math.floor(web3.LAMPORTS_PER_SOL * stakeAmount);
            const stakingIxs = await createStakingInstructions(stakeAmountLamports);

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

    // Handle unstake action based on dropdown selection
    const handleUnstakeAction = async () => {
        if (!unstakeAddress) {
            enqueueSnackbar("Please enter a stake account address", { variant: 'error' });
            return;
        }

        try {
            if (unstakeAction === 'deactivate') {
                await handleDeactivateIx(unstakeAddress);
            } else if (unstakeAction === 'withdraw') {
                // Fetch account to get lamports for full withdrawal
                const stakeAccountPubkey = new PublicKey(unstakeAddress);
                const accountInfo = await RPC_CONNECTION.getParsedAccountInfo(stakeAccountPubkey);
                
                if (!accountInfo || !accountInfo.value) {
                    enqueueSnackbar("Stake account not found", { variant: 'error' });
                    return;
                }

                const lamports = accountInfo.value.lamports;
                await handleWithdrawIx(unstakeAddress, lamports);
            }
        } catch (error) {
            enqueueSnackbar("Failed to process unstake action", { variant: 'error' });
            console.error('Failed to process unstake action:', error);
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
            setStakeSeed(generateUniqueSeed());
        }
    }, []);

    // Fetch stake accounts when the unstake tab is opened
    React.useEffect(() => {
    if (!open) fetchedOnOpenRef.current = false;

    if (open && tabValue === 1 && !fetchedOnOpenRef.current) {
        fetchedOnOpenRef.current = true;
        fetchStakeAccounts();
    }
    }, [open, tabValue, fetchStakeAccounts]);

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
                                        select
                                        fullWidth
                                        label="Action"
                                        value={unstakeAction}
                                        onChange={(e) => setUnstakeAction(e.target.value as 'deactivate' | 'withdraw')}
                                        variant="filled"
                                        sx={{ m: 0.65 }}
                                        helperText={
                                            unstakeAction === 'deactivate' 
                                                ? "Deactivate begins the cooldown period (~2-3 days). Stake remains locked until the epoch ends."
                                                : "Withdraw returns SOL to the governance wallet. Only works on inactive/deactivated accounts."
                                        }
                                    >
                                        <MenuItem value="deactivate">
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <LockOpenIcon fontSize="small" />
                                                Deactivate Stake
                                            </Box>
                                        </MenuItem>
                                        <MenuItem value="withdraw">
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <GetAppIcon fontSize="small" />
                                                Withdraw Stake
                                            </Box>
                                        </MenuItem>
                                    </TextField>
                                </Grid>
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
                                        helperText="Enter a stake account address or select one from the list below."
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
                                        const isActive = account.state === 'active';
                                        const isDeactivating = account.state === 'deactivating';
                                        const isInactive = account.state === 'initialized' || account.state === 'inactive';
                                        const canDeactivate = isActive;          // only active needs deactivate
                                        const canWithdraw = isInactive;          // only initialized/inactive can withdraw now

                                        let statusLabel = 'Unknown';
                                        let statusColor = 'rgba(255,255,255,0.5)';
                                        if (isActive) { statusLabel = 'Active'; statusColor = '#4caf50'; }
                                        else if (isDeactivating) { statusLabel = 'Cooldown'; statusColor = '#ff9800'; }
                                        else if (isInactive) { statusLabel = 'Withdrawable'; statusColor = '#f44336'; }

                                        const displayBalance = account.balance 
                                            ? `${parseFloat(account.balance).toFixed(4)} SOL`
                                            : `${(account.lamports / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL`;

                                        return (
                                            <ListItem 
                                                key={index}
                                                sx={{ 
                                                    borderRadius: '10px', 
                                                    mb: 0.5, 
                                                    backgroundColor: unstakeAddress === account.pubkey 
                                                        ? 'rgba(255,255,255,0.1)' 
                                                        : 'rgba(255,255,255,0.03)',
                                                    cursor: 'pointer',
                                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.07)' }
                                                }}
                                                onClick={() => {
                                                    setUnstakeAddress(account.pubkey);
                                                    // Auto-select appropriate action based on state
                                                    if (isActive) {
                                                        setUnstakeAction('deactivate');
                                                    } else if (isInactive) {
                                                    // initialized OR inactive => withdrawable now
                                                        setUnstakeAction('withdraw');
                                                    } else if (isDeactivating) {
                                                    // cooling down: NOT withdrawable yet
                                                        setUnstakeAction('deactivate'); // or keep current selection; just don't force withdraw
                                                    }
                                                }}
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
                                                            {typeof account.pubkey === "string"
                                                                ? `${account.pubkey.slice(0, 8)}...${account.pubkey.slice(-8)}`
                                                                : "Unknown stake"}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                                            {displayBalance}
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
                                            onClick={handleUnstakeAction}
                                            sx={{
                                                p:1,
                                                borderRadius:'17px',
                                                '&:hover .MuiSvgIcon-root': {
                                                    color:'rgba(255,255,255,0.90)'
                                                }
                                            }}
                                            startIcon={
                                                unstakeAction === 'deactivate' 
                                                    ? <LockOpenIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:"14px!important"}} />
                                                    : <GetAppIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:"14px!important"}} />
                                            }
                                        >
                                            {unstakeAction === 'deactivate' ? 'Deactivate' : 'Withdraw'}
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