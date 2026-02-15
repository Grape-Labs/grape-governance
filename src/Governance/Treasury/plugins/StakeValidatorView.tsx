// FIXED VERSION - Key changes for JITO MEV Harvest:
// 1. Use canonical field names (activeStakeLamports, rentLamports, inactiveLamports)
// 2. All lamports fields are already in lamports (not SOL), so don't multiply by LAMPORTS_PER_SOL
// 3. Calculate excess as: total - activeStake - rent

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
    Checkbox,
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
import WaterDropIcon from '@mui/icons-material/WaterDrop';
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

// ========== Jito MEV Harvest Constants ==========
const STAKE_RENT_EXEMPT_LAMPORTS = 2282880; // Rent-exempt minimum for a stake account

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

    const stakeAccountsPromiseRef = React.useRef<Promise<any[]> | null>(null);
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
    
    // Tab state: 0 = Stake, 1 = Unstake, 2 = Harvest
    const [tabValue, setTabValue] = React.useState(0);

    // Staking state
    const [validatorVoteAddress, setValidatorVoteAddress] = React.useState('');
    const [stakeSeed, setStakeSeed] = React.useState<string | null>(null);
    const [amount, setAmount] = React.useState('');

    // Unstaking state
    const [unstakeAddress, setUnstakeAddress] = React.useState('');
    const [unstakeAction, setUnstakeAction] = React.useState<'deactivate' | 'withdraw' | 'close'>('deactivate');
    const [unstakeAmount, setUnstakeAmount] = React.useState(''); // empty = full amount
    const [unstakeSeed, setUnstakeSeed] = React.useState<string | null>(null);
    const [stakeAccounts, setStakeAccounts] = React.useState<any[]>([]);
    const [loadingStakeAccounts, setLoadingStakeAccounts] = React.useState(false);

    // Jito liquid staking state
    const [harvestAccounts, setHarvestAccounts] = React.useState<any[]>([]);
    const [loadingHarvest, setLoadingHarvest] = React.useState(false);
    const [harvestSelectAll, setHarvestSelectAll] = React.useState(true);

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

    // Fetch stake accounts via Shyft API with RPC fallback
    const fetchStakeAccounts = React.useCallback(
       async (force = false) => {
            if (!governanceNativeWallet) return;

                if (!force && stakeAccountsPromiseRef.current) {
                    // Someone already kicked it off — await the same work
                    const accounts = await stakeAccountsPromiseRef.current;
                    setStakeAccounts(accounts);
                    return;
                }

            const walletKey = governanceNativeWallet;

            // 1) Serve from cache (unless forced)
            if (
                !force &&
                stakeAccountsCacheRef.current.wallet === walletKey &&
                Array.isArray(stakeAccountsCacheRef.current.accounts)
            ) {
                setStakeAccounts(stakeAccountsCacheRef.current.accounts || []);
                return;
            }

            // 2) Single-flight: if same wallet fetch already in-flight, do nothing
            if (
                fetchStakeAccountsInFlight.current &&
                fetchStakeAccountsKeyRef.current === walletKey
            ) {
                return;
            }

            // 3) Abort any previous request (wallet changed or forced refresh)
            if (fetchStakeAccountsAbortRef.current) {
                try { fetchStakeAccountsAbortRef.current.abort(); } catch {}
            }
            const controller = new AbortController();
            fetchStakeAccountsAbortRef.current = controller;

            fetchStakeAccountsInFlight.current = true;
            fetchStakeAccountsKeyRef.current = walletKey;

            setLoadingStakeAccounts(true);

            const U64_MAX = "18446744073709551615";

            try {
                let accounts: any[] = [];

                // -------- SHYFT --------
                try {
                    const { data } = await axios.get(
                        "https://api.shyft.to/sol/v1/wallet/stake_accounts",
                        {
                            params: {
                                network: "mainnet-beta",
                                wallet_address: walletKey,
                            },
                            headers: { "x-api-key": SHYFT_KEY },
                            timeout: 10_000,
                            signal: controller.signal as any,
                        }
                    );

                    const raw = data?.result;

                    const arr =
                    Array.isArray(raw) ? raw :
                    Array.isArray(raw?.stake_accounts) ? raw.stake_accounts :
                    Array.isArray(raw?.accounts) ? raw.accounts :
                    Array.isArray(raw?.data) ? raw.data :
                    [];

                    console.log("Shyft stake_accounts shape keys:", raw && typeof raw === "object" ? Object.keys(raw) : typeof raw);

                    if (arr.length > 0) {
                        accounts = arr
                            .map((a: any) => {
                                const pubkey = a?.pubkey || a?.address || a?.stake_account_address;
                                if (!pubkey) return null;

                                const d = a.stake?.delegation;
                                const deact = d?.deactivation_epoch ?? d?.deactivationEpoch ?? "N/A";

                                let derivedState = "inactive";
                                if (d && String(deact) === U64_MAX) derivedState = "active";
                                else if (d && String(deact) !== "N/A") derivedState = "deactivating";
                                else if (a.type === "initialized") derivedState = "initialized";

                                const totalSol = Number(a.total_amount ?? 0);
                                const rentSol  = Number(a.rent ?? 0);

                                // Shyft feed quirk: for ACTIVE accounts, delegated_amount matches Explorer "Active Stake".
                                // BUT sometimes delegated_amount is bogus (see your 2030 SOL example), so sanity-check it.
                                const delegatedSol = a.delegated_amount != null ? Number(a.delegated_amount) : null;
                                const activeSolRaw = a.active_amount != null ? Number(a.active_amount) : null;

                                // pick the best "active stake" candidate
                                const activeStakeSol =
                                delegatedSol != null && Number.isFinite(delegatedSol) && delegatedSol <= totalSol + 0.01
                                    ? delegatedSol
                                    : (activeSolRaw != null && Number.isFinite(activeSolRaw) && activeSolRaw <= totalSol + 0.01
                                        ? activeSolRaw
                                        : 0);

                                const inactiveSol = Math.max(0, totalSol - activeStakeSol - rentSol);

                                return {
                                pubkey,
                                stake_account_address: a.stake_account_address ?? pubkey,

                                // Canonical SOL fields
                                total_amount: totalSol,
                                active_stake_amount: activeStakeSol,   // <-- IMPORTANT (don't call this active_amount)
                                rent: rentSol,
                                inactive_amount: inactiveSol,

                                // Canonical lamports fields
                                lamports: Math.round(totalSol * web3.LAMPORTS_PER_SOL),
                                activeStakeLamports: Math.round(activeStakeSol * web3.LAMPORTS_PER_SOL),
                                rentLamports: Math.round(rentSol * web3.LAMPORTS_PER_SOL),
                                inactiveLamports: Math.round(inactiveSol * web3.LAMPORTS_PER_SOL),

                                vote_account_address: a.vote_account_address ?? d?.voter ?? "N/A",
                                status: a.status ?? a.state ?? "unknown",
                                state: a.state ?? derivedState,
                                };
                            })
                            .filter(Boolean) as any[];

                        // Cache and return early — NO RPC fallback needed
                        stakeAccountsCacheRef.current = { wallet: walletKey, accounts };
                        setStakeAccounts(accounts);
                        return;
                    }

                    // Shyft returned empty — fall through to RPC
                    throw new Error("Shyft returned empty stake array");
                } catch (shyftErr: any) {
                    if (controller.signal.aborted) return;

                    console.warn("Shyft stake_accounts failed; falling back to RPC:", shyftErr);

                    // -------- RPC FALLBACK --------
                    const walletPk = new PublicKey(walletKey);

                    const [stakerAccounts, withdrawerAccounts] = await Promise.all([
                        RPC_CONNECTION.getParsedProgramAccounts(
                            StakeProgram.programId,
                            {
                                filters: [{ memcmp: { offset: 12, bytes: walletPk.toBase58() } }],
                            }
                        ),
                        RPC_CONNECTION.getParsedProgramAccounts(
                            StakeProgram.programId,
                            {
                                filters: [{ memcmp: { offset: 44, bytes: walletPk.toBase58() } }],
                            }
                        ),
                    ]);

                    // Deduplicate
                    const seen = new Set<string>();
                    const allRpc = [...stakerAccounts, ...withdrawerAccounts].filter((acc: any) => {
                        const key = acc.pubkey.toBase58();
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });

                    accounts = allRpc.map((acc: any) => {
                    const info = acc.account.data?.parsed?.info;
                    const d = info?.stake?.delegation;

                    const deact = d?.deactivationEpoch ?? "N/A";

                    let state = info?.type ?? "unknown";
                    if (info?.type === "delegated" && String(deact) === U64_MAX) state = "active";
                    else if (info?.type === "delegated") state = "deactivating";
                    else if (info?.type === "initialized") state = "initialized";

                    const totalLamports = Number(acc.account.lamports || 0);
                    const rentLamports =
                        info?.meta?.rentExemptReserve != null ? Number(info.meta.rentExemptReserve) : STAKE_RENT_EXEMPT_LAMPORTS;

                    // IMPORTANT: on many RPCs, delegation.stake exists and is the active delegated stake in lamports
                    const activeStakeLamports = d?.stake != null ? Number(d.stake) : 0;

                    const inactiveLamports = Math.max(0, totalLamports - activeStakeLamports - rentLamports);

                    const totalSol = totalLamports / web3.LAMPORTS_PER_SOL;
                    const rentSol = rentLamports / web3.LAMPORTS_PER_SOL;
                    const inactiveSol = inactiveLamports / web3.LAMPORTS_PER_SOL;
                    const activeStakeSol = activeStakeLamports / web3.LAMPORTS_PER_SOL;

                    const pubkey = acc.pubkey.toBase58();

                    return {
                        pubkey,
                        stake_account_address: pubkey,
                        vote_account_address: d?.voter ?? "N/A",
                        status: info?.type ?? "unknown",
                        state,

                        // canonical
                        total_amount: totalSol,
                        active_stake_amount: activeStakeSol,
                        rent: rentSol,
                        inactive_amount: inactiveSol,

                        lamports: totalLamports,
                        activeStakeLamports,
                        rentLamports,
                        inactiveLamports,
                    };
                    });

                    stakeAccountsCacheRef.current = { wallet: walletKey, accounts };
                    setStakeAccounts(accounts);
                }
            } catch (e) {
                if (controller.signal.aborted) return;
                console.error(e);
                enqueueSnackbar("Failed to fetch stake accounts", { variant: "error" });
                setStakeAccounts([]);
            } finally {
                if (fetchStakeAccountsKeyRef.current === walletKey) {
                    fetchStakeAccountsInFlight.current = false;
                }
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

    // Create split + deactivate instructions for partial unstaking
    // Splits off `lamports` into a new stake account (via seed), then deactivates it
    const createSplitDeactivateInstructions = async (
        stakeAccountPubkey: PublicKey, 
        lamports: number,
        seed: string
    ): Promise<TransactionInstruction[]> => {
        try {
            const nativeWalletPubkey = new PublicKey(governanceNativeWallet);

            // Derive split stake account from seed
            const splitStakePubkey = await PublicKey.createWithSeed(
                nativeWalletPubkey,
                seed,
                StakeProgram.programId
            );

            const rentExemptLamports = await RPC_CONNECTION.getMinimumBalanceForRentExemption(StakeProgram.space);

            // Create the split destination account (empty, rent-exempt)
            const createSplitAccountIx = SystemProgram.createAccountWithSeed({
                fromPubkey: nativeWalletPubkey,
                newAccountPubkey: splitStakePubkey,
                basePubkey: nativeWalletPubkey,
                seed: seed,
                lamports: rentExemptLamports,
                space: StakeProgram.space,
                programId: StakeProgram.programId,
            });

            // Split the stake
            const splitIx = extractInstruction(
                StakeProgram.split({
                    stakePubkey: stakeAccountPubkey,
                    authorizedPubkey: nativeWalletPubkey,
                    splitStakePubkey: splitStakePubkey,
                    lamports: lamports,
                })
            );

            // Deactivate the split-off account
            const deactivateIx = extractInstruction(
                StakeProgram.deactivate({
                    stakePubkey: splitStakePubkey,
                    authorizedPubkey: nativeWalletPubkey,
                })
            );

            return [createSplitAccountIx, splitIx, deactivateIx];
        } catch (error) {
            console.error("Error creating split+deactivate instructions:", error);
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

    // ========== Jito MEV Harvest Functions ==========
    
    // FIXED: Calculate harvestable (excess) lamports for each active stake account
    // Harvestable = total_balance - active_stake - rent_exempt_reserve
    // Use canonical field names that are already in lamports
    const computeHarvestableAccounts = React.useCallback((accounts: any[]) => {
        return accounts
            .filter((a: any) => a.state === 'active' || a.state === 'deactivating')
            .map((a: any) => {
                const totalLamports = a.lamports || 0;
                
                // Use the canonical activeStakeLamports field that was set in fetchStakeAccounts
                // This field is already in lamports, not SOL
                const activeLamports = a.activeStakeLamports != null
                    ? a.activeStakeLamports
                    : 0;
                
                // Use the canonical rentLamports field
                const rent = a.rentLamports != null
                    ? a.rentLamports
                    : STAKE_RENT_EXEMPT_LAMPORTS;
                
                const excess = totalLamports - activeLamports - rent;
                
                console.log(`Account ${a.pubkey?.slice(0,8)}: total=${totalLamports}, active=${activeLamports}, rent=${rent}, excess=${excess}`);
                
                return {
                    ...a,
                    activeLamports,
                    rentLamports: rent,
                    excessLamports: Math.max(0, excess),
                    selected: excess > 0,
                };
            })
            .filter((a: any) => a.excessLamports > 0);
    }, []);

    // Update harvest accounts when stakeAccounts changes and harvest tab is active
    React.useEffect(() => {
        if (tabValue === 2 && stakeAccounts && stakeAccounts.length > 0) {
            setHarvestAccounts(computeHarvestableAccounts(stakeAccounts));
            setLoadingHarvest(false);
        }
    }, [stakeAccounts, tabValue, computeHarvestableAccounts]);

    // Fetch stake accounts for harvest tab if not already loaded
    const fetchHarvestAccounts = React.useCallback(async () => {
        if (!governanceNativeWallet) return;
        setLoadingHarvest(true);
        try {
            if (stakeAccounts && stakeAccounts.length > 0) {
                setHarvestAccounts(computeHarvestableAccounts(stakeAccounts));
                setLoadingHarvest(false);
                return;
            }
            await fetchStakeAccounts();
        } catch (e) {
            console.error("Failed to fetch harvest accounts:", e);
            enqueueSnackbar("Failed to fetch stake accounts for harvest", { variant: 'error' });
            setLoadingHarvest(false);
        }
    }, [governanceNativeWallet, stakeAccounts, fetchStakeAccounts, computeHarvestableAccounts, enqueueSnackbar]);

    const totalHarvestable = React.useMemo(() => {
        return harvestAccounts
            .filter((a: any) => a.selected)
            .reduce((sum: number, a: any) => sum + a.excessLamports, 0);
    }, [harvestAccounts]);

    const toggleHarvestAccount = (pubkey: string) => {
        setHarvestAccounts((prev: any[]) =>
            prev.map((a: any) => a.pubkey === pubkey ? { ...a, selected: !a.selected } : a)
        );
    };

    const toggleHarvestSelectAll = () => {
        const newVal = !harvestSelectAll;
        setHarvestSelectAll(newVal);
        setHarvestAccounts((prev: any[]) => prev.map((a: any) => ({ ...a, selected: newVal })));
    };

    // Build harvest instructions: StakeProgram.withdraw for excess lamports from each selected account
    const handleHarvestAction = async () => {
        const selected = harvestAccounts.filter((a: any) => a.selected && a.excessLamports > 0);
        if (selected.length === 0) {
            enqueueSnackbar("No accounts selected for harvest", { variant: 'error' });
            return;
        }

        try {
            const govWallet = new PublicKey(governanceNativeWallet);
            const ixs: TransactionInstruction[] = [];

            for (const account of selected) {
                const stakeAccountPubkey = new PublicKey(account.pubkey);
                const withdrawIx = extractInstruction(
                    StakeProgram.withdraw({
                        stakePubkey: stakeAccountPubkey,
                        authorizedPubkey: govWallet,
                        toPubkey: govWallet,
                        lamports: account.excessLamports,
                    })
                );
                ixs.push(withdrawIx);
            }

            const totalSol = (selected.reduce((s: number, a: any) => s + a.excessLamports, 0) / web3.LAMPORTS_PER_SOL);
            
            const status = await simulateIx(new Transaction().add(...ixs));
            if (!status) {
                enqueueSnackbar("Transaction simulation failed. Some accounts may not have withdrawable excess yet.", { variant: 'error' });
                return;
            }

            if (handleCloseExtMenu) handleCloseExtMenu();
            setPropOpen(false);

            const propIx = {
                title: proposalTitle || "Harvest Jito MEV Rewards",
                description: proposalDescription || `Withdraw ${totalSol.toFixed(4)} SOL of excess MEV rewards from ${selected.length} stake account(s) to the governance treasury.`,
                ix: ixs,
                aix: [],
                nativeWallet: governanceNativeWallet,
                governingMint: governingMint,
                draft: isDraft,
                editProposalAddress: editProposalAddress,
            };

            console.log("propIx (harvest): ", JSON.stringify(propIx));
            setInstructions(propIx);
            setExpandedLoader(true);
        } catch (error) {
            enqueueSnackbar("Failed to create harvest instructions", { variant: 'error' });
            console.error("Failed to create harvest instructions:", error);
        }
    };

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
                editProposalAddress: editProposalAddress,
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
                editProposalAddress: editProposalAddress,
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
    const handleWithdrawIx = async (stakeAccountAddress: string, lamports: number, isCloseAction = false) => {
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
                title: proposalTitle || (isCloseAction ? "Close Stake Account" : "Withdraw Stake"),
                description:
                    proposalDescription ||
                    (
                        isCloseAction
                            ? `Close stake account ${stakeAccountAddress} and withdraw ${(lamports / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL to treasury`
                            : `Withdraw ${(lamports / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL from stake account ${stakeAccountAddress}`
                    ),
                ix: withdrawIxs,
                aix: [],
                nativeWallet: governanceNativeWallet,
                governingMint: governingMint,
                draft: isDraft,
                editProposalAddress: editProposalAddress,
            }

            console.log(`propIx (${isCloseAction ? "close" : "withdraw"}): `, JSON.stringify(propIx));
            setInstructions(propIx);
            setExpandedLoader(true);
        } catch (error) {
            enqueueSnackbar(isCloseAction ? "Failed to create close instructions" : "Failed to create withdraw instructions", { variant: 'error' });
            console.error(`Failed to create ${isCloseAction ? "close" : "withdraw"} instructions:`, error);
        }
    }

    const getCloseStakeValidation = async (stakeAccountAddress: string) => {
        const stakeAccountPubkey = new PublicKey(stakeAccountAddress);
        const accountInfo = await RPC_CONNECTION.getParsedAccountInfo(stakeAccountPubkey);

        if (!accountInfo || !accountInfo.value) {
            return { ok: false, reason: "Stake account not found", lamports: 0 };
        }

        const totalLamports = Number(accountInfo.value.lamports || 0);
        if (totalLamports <= 0) {
            return { ok: false, reason: "Stake account has no balance to close", lamports: 0 };
        }

        const parsedData: any = (accountInfo.value as any)?.data?.parsed;
        const parsedInfo: any = parsedData?.info;
        const epochInfo = await RPC_CONNECTION.getEpochInfo();

        // Prefer runtime activation state over raw delegation.stake.
        // Delegation stake can stay non-zero even after deactivation has fully cooled down.
        let activationState: string | null = null;
        let activationActiveLamports = 0;
        try {
            const getStakeActivation = (RPC_CONNECTION as any)?.getStakeActivation;
            if (typeof getStakeActivation === "function") {
                const activation = await getStakeActivation.call(
                    RPC_CONNECTION,
                    stakeAccountPubkey,
                    epochInfo.epoch
                );
                if (activation?.state) {
                    activationState = String(activation.state);
                    activationActiveLamports = Number(activation.active || 0);
                }
            }
        } catch (e) {
            console.warn("getStakeActivation check failed, falling back to parsed delegation checks:", e);
        }

        if (activationState && activationState !== "inactive") {
            return {
                ok: false,
                reason: `Stake is ${activationState}. Wait for cooldown to finish, then close.`,
                lamports: totalLamports,
            };
        }

        if (!activationState) {
            const delegation = parsedInfo?.stake?.delegation;
            const deactivationEpochRaw = delegation?.deactivationEpoch;
            const deactivationEpoch = Number(deactivationEpochRaw ?? 0);
            const delegatedLamports = delegation?.stake != null ? Number(delegation.stake) : 0;
            const U64_MAX_EPOCH = 18446744073709551615;

            const appearsActive =
                delegatedLamports > 0 &&
                (deactivationEpochRaw == null ||
                    deactivationEpoch >= U64_MAX_EPOCH ||
                    deactivationEpoch > epochInfo.epoch);

            if (appearsActive) {
                return {
                    ok: false,
                    reason: "Stake appears active/deactivating. Wait for cooldown to finish, then close.",
                    lamports: totalLamports,
                };
            }
        }

        const authorizedWithdrawer = parsedInfo?.meta?.authorized?.withdrawer;
        if (
            authorizedWithdrawer &&
            new PublicKey(authorizedWithdrawer).toBase58() !== new PublicKey(governanceNativeWallet).toBase58()
        ) {
            return {
                ok: false,
                reason: "Governance treasury is not the withdraw authority for this stake account",
                lamports: totalLamports,
            };
        }

        const lockup = parsedInfo?.meta?.lockup;
        const nowTs = Math.floor(Date.now() / 1000);
        const lockupUnix = lockup?.unixTimestamp != null ? Number(lockup.unixTimestamp) : 0;
        const lockupEpoch = lockup?.epoch != null ? Number(lockup.epoch) : 0;
        const U64_MAX = Number.MAX_SAFE_INTEGER; // treat absurdly large values as "no lockup"

        if (lockupUnix > nowTs && lockupUnix < U64_MAX) {
            return {
                ok: false,
                reason: `Lockup active until ${moment.unix(lockupUnix).format("YYYY-MM-DD HH:mm:ss")} UTC`,
                lamports: totalLamports,
            };
        }

        if (lockupEpoch > 0 && lockupEpoch < U64_MAX) {
            if (lockupEpoch > epochInfo.epoch) {
                return {
                    ok: false,
                    reason: `Lockup active until epoch ${lockupEpoch}`,
                    lamports: totalLamports,
                };
            }
        }

        return { ok: true, reason: null, lamports: totalLamports };
    };

    const handleCloseStakeIx = async (stakeAccountAddress: string) => {
        const closeValidation = await getCloseStakeValidation(stakeAccountAddress);
        if (!closeValidation.ok) {
            enqueueSnackbar(closeValidation.reason || "Stake account is not closable yet", { variant: 'warning' });
            return;
        }
        await handleWithdrawIx(stakeAccountAddress, closeValidation.lamports, true);
    };

    // Handle unstake action based on dropdown selection
    const handleUnstakeAction = async () => {
        if (!unstakeAddress) {
            enqueueSnackbar("Please enter a stake account address", { variant: 'error' });
            return;
        }

        const parsedUnstakeAmount = unstakeAmount ? parseFloat(unstakeAmount) : 0;
        const isPartial = parsedUnstakeAmount > 0;

        try {
            if (unstakeAction === 'deactivate') {
                if (isPartial) {
                    // Partial deactivate: split + deactivate
                    const seed = unstakeSeed || generateUniqueSeed();
                    const lamports = Math.floor(parsedUnstakeAmount * web3.LAMPORTS_PER_SOL);

                    const stakeAccountPubkey = new PublicKey(unstakeAddress);
                    const splitDeactivateIxs = await createSplitDeactivateInstructions(stakeAccountPubkey, lamports, seed);

                    const status = await simulateIx(new Transaction().add(...splitDeactivateIxs));
                    if (!status) {
                        enqueueSnackbar("Transaction simulation failed", { variant: 'error' });
                        return;
                    }

                    if (handleCloseExtMenu) handleCloseExtMenu();
                    setPropOpen(false);

                    const propIx = {
                        title: proposalTitle || "Partial Deactivate Stake",
                        description: proposalDescription || `Split ${parsedUnstakeAmount} SOL from stake account ${unstakeAddress} and deactivate`,
                        ix: splitDeactivateIxs,
                        aix: [],
                        nativeWallet: governanceNativeWallet,
                        governingMint: governingMint,  
                        draft: isDraft,
                        editProposalAddress: editProposalAddress,
                    };

                    console.log("propIx (split+deactivate): ", JSON.stringify(propIx));
                    setInstructions(propIx);
                    setExpandedLoader(true);
                } else {
                    // Full deactivate
                    await handleDeactivateIx(unstakeAddress);
                }
            } else if (unstakeAction === 'withdraw') {
                const stakeAccountPubkey = new PublicKey(unstakeAddress);
                const accountInfo = await RPC_CONNECTION.getParsedAccountInfo(stakeAccountPubkey);
                
                if (!accountInfo || !accountInfo.value) {
                    enqueueSnackbar("Stake account not found", { variant: 'error' });
                    return;
                }

                const totalLamports = accountInfo.value.lamports;

                if (isPartial) {
                    const withdrawLamports = Math.floor(parsedUnstakeAmount * web3.LAMPORTS_PER_SOL);
                    
                    // Validate: can't withdraw more than total, and remaining must cover rent
                    const rentExempt = await RPC_CONNECTION.getMinimumBalanceForRentExemption(StakeProgram.space);
                    const remaining = totalLamports - withdrawLamports;
                    
                    if (withdrawLamports > totalLamports) {
                        enqueueSnackbar("Withdraw amount exceeds account balance", { variant: 'error' });
                        return;
                    }
                    
                    if (remaining > 0 && remaining < rentExempt) {
                        enqueueSnackbar(`Remaining balance (${(remaining / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL) would be below rent-exempt minimum. Withdraw full amount or leave at least ${(rentExempt / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL.`, { variant: 'warning' });
                        return;
                    }

                    await handleWithdrawIx(unstakeAddress, withdrawLamports);
                } else {
                    // Full withdrawal
                    await handleWithdrawIx(unstakeAddress, totalLamports);
                }
            } else if (unstakeAction === 'close') {
                if (isPartial) {
                    enqueueSnackbar("Close always withdraws full account balance. Leave amount empty.", { variant: 'warning' });
                    return;
                }
                await handleCloseStakeIx(unstakeAddress);
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
        if (!unstakeSeed){
            setUnstakeSeed(generateUniqueSeed());
        }
    }, []);

    // Fetch stake accounts when dialog opens
    React.useEffect(() => {
    if (!open) return;
        fetchStakeAccounts(); // no force
    }, [open, fetchStakeAccounts]);

    // Fetch harvest data when the Jito MEV tab is opened
    React.useEffect(() => {
        if (open && tabValue === 2 && governanceNativeWallet) {
            fetchHarvestAccounts();
        }
    }, [open, tabValue, fetchHarvestAccounts]);

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
                        <Tab icon={<WaterDropIcon />} label="Harvest" iconPosition="start" />
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
                            Deactivate, withdraw, or close a stake account
                        </DialogContentText>

                        <FormControl fullWidth>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        select
                                        fullWidth
                                        label="Action"
                                        value={unstakeAction}
                                        onChange={(e) => {
                                            const nextAction = e.target.value as 'deactivate' | 'withdraw' | 'close';
                                            setUnstakeAction(nextAction);
                                            if (nextAction === 'close') {
                                                setUnstakeAmount('');
                                            }
                                        }}
                                        variant="filled"
                                        sx={{ m: 0.65 }}
                                        helperText={
                                            unstakeAction === 'deactivate' 
                                                ? "Deactivate begins the cooldown period (~2-3 days). Stake remains locked until the epoch ends."
                                                : unstakeAction === 'withdraw'
                                                ? "Withdraw returns SOL to the governance wallet. Works when inactive/deactivated."
                                                : "Close withdraws the full balance and removes the stake account once fully inactive and unlocked."
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
                                        <MenuItem value="close">
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CloseIcon fontSize="small" />
                                                Close Stake Account
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
                                {unstakeAction !== 'close' && (
                                <Grid item xs={12}>
                                    <TextField 
                                        fullWidth 
                                        label="Amount (SOL) — leave empty for full amount" 
                                        id="unstakeAmount"
                                        type="number"
                                        value={unstakeAmount}
                                        onChange={(e) => setUnstakeAmount(e.target.value)}
                                        variant="filled"
                                        inputProps={{ min: "0", step: "0.0001" }}
                                        helperText={
                                            unstakeAction === 'deactivate' && unstakeAmount
                                                ? "Partial deactivate will split the stake account first, then deactivate the split portion."
                                                : unstakeAction === 'withdraw' && unstakeAmount
                                                ? "Partial withdraw. Remaining balance must stay above rent-exempt minimum."
                                                : "Leave empty to deactivate/withdraw the full stake account balance."
                                        }
                                        sx={{ m: 0.65 }}
                                    />
                                </Grid>
                                )}
                                {unstakeAction === 'deactivate' && unstakeAmount && (
                                    <Grid item xs={12}>
                                        <TextField 
                                            fullWidth 
                                            label="Seed for Split Stake Account" 
                                            id="unstakeSeed"
                                            type="text"
                                            value={unstakeSeed || ''}
                                            onChange={(e) => setUnstakeSeed(e.target.value)}
                                            variant="filled"
                                            required
                                            helperText="A unique seed for the new split stake account."
                                            sx={{ m: 0.65 }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            aria-label="regenerate seed"
                                                            onClick={() => setUnstakeSeed(generateUniqueSeed())}
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
                                )}
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
                                    <IconButton size="small" onClick={() => fetchStakeAccounts(true)}>
                                        <RefreshIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                                <List dense sx={{ maxHeight: 250, overflow: 'auto' }}>
                                    {stakeAccounts.map((account, index) => {
                                        const isActive = account.state === 'active';
                                        const isDeactivating = account.state === 'deactivating';
                                        const isInactive = account.state === 'initialized' || account.state === 'inactive';

                                        let statusLabel = 'Unknown';
                                        let statusColor = 'rgba(255,255,255,0.5)';
                                        if (isActive) { statusLabel = 'Active'; statusColor = '#4caf50'; }
                                        else if (isDeactivating) { statusLabel = 'Deactivating'; statusColor = '#ff9800'; }
                                        else if (isInactive) { statusLabel = 'Inactive'; statusColor = '#f44336'; }

                                        const vote =
                                            account?.vote_account_address ||
                                            account?.validatorVoteAccount ||
                                            account?.voteAccount ||
                                            "N/A";
                                        const totalSol =
                                            account.total_amount != null
                                                ? Number(account.total_amount)
                                                : account.total_amount_sol != null
                                                ? Number(account.total_amount_sol)
                                                : null;

                                            const rentSol  = Number(account.rent ?? 0);

                                            const withdrawableSol =
                                                account.inactive_amount != null
                                                    ? Number(account.inactive_amount)
                                                    : (account.inactiveLamports != null
                                                        ? Number(account.inactiveLamports) / web3.LAMPORTS_PER_SOL
                                                        : 0);
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
                                                    } else if (isInactive || isDeactivating) {
                                                        setUnstakeAction(isInactive ? 'close' : 'withdraw');
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
                                                            {account.pubkey.substring(0, 8)}...{account.pubkey.substring(account.pubkey.length - 8)}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                                                        {totalSol && totalSol?.toFixed(4)} SOL
                                                        {" • "}Withdrawable: {withdrawableSol && withdrawableSol?.toFixed(4)} SOL
                                                        {" • "}Rent: {rentSol && rentSol?.toFixed(4)} SOL
                                                        {vote !== "N/A" ? ` • Validator: ${vote.slice(0, 6)}...` : ""}
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

                    {/* ==================== JITO MEV HARVEST TAB ==================== */}
                    <TabPanel value={tabValue} index={2}>
                        <DialogContentText sx={{textAlign:'center', mb: 2}}>
                            Harvest MEV Rewards — Withdraw excess SOL from active stake accounts
                        </DialogContentText>

                        {loadingHarvest ? (
                            <Box sx={{ mt: 1, mb: 2 }}>
                                <LinearProgress />
                                <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                                    Loading stake accounts...
                                </Typography>
                            </Box>
                        ) : harvestAccounts.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                    No harvestable MEV rewards found in active stake accounts.
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mt: 1 }}>
                                    MEV rewards accumulate as excess lamports when validators run the Jito client.
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={() => fetchStakeAccounts(true)}
                                    sx={{ mt: 1, fontSize: '0.7rem' }}
                                >
                                    Refresh
                                </Button>
                            </Box>
                        ) : (
                            <>
                                {/* Summary */}
                                <Box sx={{ 
                                    mb: 2, p: 1.5, 
                                    borderRadius: '12px', 
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                            Total Harvestable MEV
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 700 }}>
                                            {(totalHarvestable / web3.LAMPORTS_PER_SOL).toFixed(6)} SOL
                                        </Typography>
                                        {usdcValue > 0 && (
                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                                ≈ ${((totalHarvestable / web3.LAMPORTS_PER_SOL) * usdcValue).toFixed(2)} USD
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip
                                            label={`${harvestAccounts.filter((a: any) => a.selected).length}/${harvestAccounts.length} accounts`}
                                            size="small"
                                            sx={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                                        />
                                        <IconButton size="small" onClick={() => fetchStakeAccounts(true)}>
                                            <RefreshIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} />
                                        </IconButton>
                                    </Box>
                                </Box>

                                {/* Select All toggle */}
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={harvestSelectAll}
                                                onChange={toggleHarvestSelectAll}
                                                size="small"
                                                sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#4caf50' } }}
                                            />
                                        }
                                        label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Select All</Typography>}
                                    />
                                </Box>

                                {/* Account list */}
                                <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {harvestAccounts.map((account: any, idx: number) => (
                                        <Box
                                            key={account.pubkey}
                                            onClick={() => toggleHarvestAccount(account.pubkey)}
                                            sx={{
                                                p: 1.5, mb: 1,
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                border: account.selected
                                                    ? '1px solid rgba(76, 175, 80, 0.4)'
                                                    : '1px solid rgba(255,255,255,0.06)',
                                                backgroundColor: account.selected
                                                    ? 'rgba(76, 175, 80, 0.06)'
                                                    : 'rgba(255,255,255,0.02)',
                                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Checkbox
                                                    checked={account.selected}
                                                    size="small"
                                                    sx={{ p: 0, color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: '#4caf50' } }}
                                                />
                                                <Box>
                                                    <Typography variant="body2" sx={{ color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                        {account.pubkey.slice(0, 8)}...{account.pubkey.slice(-6)}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                                        Validator: {(account.vote_account_address || account.validatorVoteAccount || 'N/A').slice(0, 8)}...
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 600 }}>
                                                    +{(account.excessLamports / web3.LAMPORTS_PER_SOL).toFixed(6)} SOL
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                                                    Staked: {(account.activeLamports / web3.LAMPORTS_PER_SOL).toFixed(2)} SOL
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>

                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mt: 1, textAlign: 'center' }}>
                                    MEV rewards are airdropped as excess SOL to stake accounts by Jito validators. 
                                    Harvesting withdraws this excess without affecting your active stake.
                                </Typography>
                            </>
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
                                    ) : tabValue === 1 ? (
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
                                                    : unstakeAction === 'withdraw'
                                                    ? <GetAppIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:"14px!important"}} />
                                                    : <CloseIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:"14px!important"}} />
                                            }
                                        >
                                            {unstakeAction === 'deactivate' ? 'Deactivate' : unstakeAction === 'withdraw' ? 'Withdraw' : 'Close Account'}
                                        </Button>
                                    ) : (
                                        <Button 
                                            autoFocus 
                                            onClick={handleHarvestAction}
                                            disabled={totalHarvestable === 0}
                                            sx={{
                                                p:1,
                                                borderRadius:'17px',
                                                '&:hover .MuiSvgIcon-root': {
                                                    color:'rgba(255,255,255,0.90)'
                                                }
                                            }}
                                            startIcon={<WaterDropIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:"14px!important"}} />}
                                        >
                                            Harvest MEV ({(totalHarvestable / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL)
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
