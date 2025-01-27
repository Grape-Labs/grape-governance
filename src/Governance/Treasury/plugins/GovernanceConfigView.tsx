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
    GoverningTokenConfigAccountArgs,
    MintMaxVoteWeightSource,
} from '@solana/spl-governance'

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback, useEffect } from 'react';
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
import SettingsIcon from '@mui/icons-material/Settings';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import GetAppIcon from '@mui/icons-material/GetApp';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';

import AdvancedProposalView from './AdvancedProposalView';
import { createSetRealmConfig } from '@solana/spl-governance'; // Adjust the import path as needed

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
    '& .MuiDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuiDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

export default function GovernanceSettingsView(props: any) {
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
    const [proposalTitle, setProposalTitle] = React.useState<string | null>(null);
    const [proposalDescription, setProposalDescription] = React.useState<string | null>(null);
    const [governingMint, setGoverningMint] = React.useState<string | null>(null);
    const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
    const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
    const [isDraft, setIsDraft] = React.useState(false);
    
    // Governance Settings State Variables
    const [minCommunityTokensEnabled, setMinCommunityTokensEnabled] = React.useState<boolean>(false);
    const [communityMintSupplyFactor, setCommunityMintSupplyFactor] = React.useState<number | null>(null);
    const [communityTokenType, setCommunityTokenType] = React.useState<string | null>(null); // Disabled
    const [communityVoterWeightAddIn, setCommunityVoterWeightAddIn] = React.useState<number | null>(null);
    const [communityMaxVoterWeightAddIn, setCommunityMaxVoterWeightAddIn] = React.useState<number | null>(null);
    const [councilTokenType, setCouncilTokenType] = React.useState<string | null>(null); // Membership
    const [councilVoterWeightAddIn, setCouncilVoterWeightAddIn] = React.useState<number | null>(null);
    const [councilMaxVoterWeightAddIn, setCouncilMaxVoterWeightAddIn] = React.useState<number | null>(null);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

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
        const chunks: TransactionInstruction[][] = [];
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

                const versionedTx = new VersionedTransaction(message);

                // Simulate the chunk
                const simulationResult = await RPC_CONNECTION.simulateTransaction(versionedTx);

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

    // Function to create Governance Configuration Instructions
    const createGovernanceConfigInstructions = async (): Promise<TransactionInstruction[]> => {
        try {
            // Define the realm public key
            const realmPubkey = new PublicKey(governanceAddress);

            // Define the realm authority public key (the authority that can configure the realm)
            const realmAuthority = new PublicKey("REALM_AUTHORITY_PUBKEY"); // Replace with the actual realm authority public key

            // Define the council mint public key (if applicable)
            const councilMint = new PublicKey("COUNCIL_MINT_PUBKEY"); // Replace with the actual council mint public key or undefined if not applicable

            // Define the community mint max vote weight source
            const communityMintMaxVoteWeightSource = MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION; // Example value, adjust as needed

            // Define the minimum community tokens to create governance
            const minCommunityTokensToCreateGovernance = minCommunityTokensEnabled ? new BN(1_000_000) : null; // Example value, adjust as needed

            // Define the community token config
            const communityTokenConfig: GoverningTokenConfigAccountArgs = {
                voterWeightAddin: communityVoterWeightAddIn,
                maxVoterWeightAddin: communityMaxVoterWeightAddIn,
                tokenType: communityTokenType, // Assuming communityTokenType is defined
            };

            // Define the council token config (if applicable)
            const councilTokenConfig: GoverningTokenConfigAccountArgs = {
                voterWeightAddin: councilVoterWeightAddIn,
                maxVoterWeightAddin: councilMaxVoterWeightAddIn,
                tokenType: councilTokenType, // Assuming councilTokenType is defined
            };

            // Define the payer public key (the account that will pay for the transaction)
            const payer = new PublicKey("PAYER_PUBKEY"); // Replace with the actual payer public key

            // Create the set realm config instruction
            const setRealmConfigIx = await createSetRealmConfig(
                new PublicKey("GOVERNANCE_PROGRAM_ID"), // Replace with the actual governance program ID
                1, // Program version
                realmPubkey,
                realmAuthority,
                councilMint,
                communityMintMaxVoteWeightSource,
                minCommunityTokensToCreateGovernance,
                communityTokenConfig,
                councilTokenConfig,
                payer
            );

            return [setRealmConfigIx];
        } catch (error) {
            console.error("Error creating governance config instructions:", error);
            throw error;
        }
    };

    const handleSetGovernanceConfig = async () => {
        if (handleCloseExtMenu)
            handleCloseExtMenu();
        setPropOpen(false);

        try {
            // Validate required fields
            if (
                communityMintSupplyFactor === null ||
                communityVoterWeightAddIn === null ||
                communityMaxVoterWeightAddIn === null ||
                councilTokenType === null ||
                councilVoterWeightAddIn === null ||
                councilMaxVoterWeightAddIn === null
            ) {
                enqueueSnackbar("Please fill in all required fields.", { variant: 'error' });
                return;
            }

            // Create governance configuration instructions
            const governanceIxs = await createGovernanceConfigInstructions();

            // Create Transaction object
            const transaction = new Transaction().add(...governanceIxs);

            // Simulate transaction
            const status = await simulateIx(transaction);
            if (!status) {
                enqueueSnackbar("Transaction simulation failed", { variant: 'error' });
                return;
            }

            // Prepare proposal instruction
            const propIx = {
                title: "Update Settings",
                description: `Updating governance settings with the provided configurations.`,
                ix: governanceIxs,
                aix: [], // Additional instructions if any
                nativeWallet: governanceNativeWallet,
                governingMint: governingMint,
                draft: isDraft,
            };

            console.log("propIx: ", JSON.stringify(propIx));

            // Set instructions and trigger loader
            setInstructions(propIx);
            setExpandedLoader(true);
        } catch (error) {
            enqueueSnackbar("Failed to create governance configuration instructions.", { variant: 'error' });
            console.error('Failed to create governance configuration instructions:', error);
        }
    };

    useEffect(() => { 
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

    return (
        <>
            <Tooltip title="Manage Governance Settings" placement="right">
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
                                    <SettingsIcon 
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
                            <MenuItem disabled onClick={publicKey && handleClickOpen}>
                                <ListItemIcon>
                                    <SettingsIcon fontSize="small" />
                                </ListItemIcon>
                                Settings
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
                    id='governance-settings-dialog'
                    onClose={handleCloseDialog}
                >
                    Manage Governance Settings
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText sx={{textAlign:'center'}}>
                        Update Wallet Settings
                    </DialogContentText>
                    
                    <FormControl fullWidth sx={{mt:2, mb:2}}>
                        <Grid container spacing={2}>
                            {/* 1. Toggle for "Min community tokens to create governance" */}
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={minCommunityTokensEnabled}
                                            onChange={(e) => setMinCommunityTokensEnabled(e.target.checked)}
                                            name="minCommunityTokensEnabled"
                                            color="primary"
                                        />
                                    }
                                    label="Enable Minimum Community Tokens to Create Governance"
                                />
                            </Grid>

                            {/* 2. Community mint supply factor (max vote weight) */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Community Mint Supply Factor (Max Vote Weight)"
                                    id="communityMintSupplyFactor"
                                    type="number"
                                    value={communityMintSupplyFactor ?? ''}
                                    onChange={(e) => setCommunityMintSupplyFactor(parseFloat(e.target.value))}
                                    variant="filled"
                                    required
                                    helperText="Set the maximum vote weight factor for the community mint."
                                    inputProps={{ min: "0", step: "0.1" }}
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>

                            {/* 3. Community token type (disabled) */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Community Token Type"
                                    id="communityTokenType"
                                    type="text"
                                    value={communityTokenType ?? 'Standard'}
                                    variant="filled"
                                    disabled
                                    helperText="The type of community token. This field is disabled."
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>

                            {/* 4. Community voter weight add-in */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Community Voter Weight Add-In"
                                    id="communityVoterWeightAddIn"
                                    type="number"
                                    value={communityVoterWeightAddIn ?? ''}
                                    onChange={(e) => setCommunityVoterWeightAddIn(parseFloat(e.target.value))}
                                    variant="filled"
                                    required
                                    helperText="Add-in value to adjust community voter weight."
                                    inputProps={{ min: "0", step: "0.1" }}
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>

                            {/* 5. Community max voter weight add-in */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Community Max Voter Weight Add-In"
                                    id="communityMaxVoterWeightAddIn"
                                    type="number"
                                    value={communityMaxVoterWeightAddIn ?? ''}
                                    onChange={(e) => setCommunityMaxVoterWeightAddIn(parseFloat(e.target.value))}
                                    variant="filled"
                                    required
                                    helperText="Maximum add-in value for community voter weight."
                                    inputProps={{ min: "0", step: "0.1" }}
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>

                            {/* 6. Council token type (membership) */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Council Token Type (Membership)"
                                    id="councilTokenType"
                                    type="text"
                                    value={councilTokenType ?? 'Membership'}
                                    onChange={(e) => setCouncilTokenType(e.target.value)}
                                    variant="filled"
                                    required
                                    helperText="The type of council token."
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>

                            {/* 7. Council voter weight add-in */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Council Voter Weight Add-In"
                                    id="councilVoterWeightAddIn"
                                    type="number"
                                    value={councilVoterWeightAddIn ?? ''}
                                    onChange={(e) => setCouncilVoterWeightAddIn(parseFloat(e.target.value))}
                                    variant="filled"
                                    required
                                    helperText="Add-in value to adjust council voter weight."
                                    inputProps={{ min: "0", step: "0.1" }}
                                    sx={{ m: 0.65 }}
                                />
                            </Grid>

                            {/* 8. Council max voter weight add-in */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Council Max Voter Weight Add-In"
                                    id="councilMaxVoterWeightAddIn"
                                    type="number"
                                    value={councilMaxVoterWeightAddIn ?? ''}
                                    onChange={(e) => setCouncilMaxVoterWeightAddIn(parseFloat(e.target.value))}
                                    variant="filled"
                                    required
                                    helperText="Maximum add-in value for council voter weight."
                                    inputProps={{ min: "0", step: "0.1" }}
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
                                    autoFocus 
                                    onClick={handleSetGovernanceConfig}
                                    sx={{
                                        p:1,
                                        borderRadius:'17px',
                                        '&:hover .MuiSvgIcon-root.claimNowIcon': {
                                            color:'rgba(255,255,255,0.90)'
                                        }
                                    }}
                                    startIcon={
                                    <>
                                        <SettingsIcon 
                                            sx={{
                                                color:'rgba(255,255,255,0.25)',
                                                fontSize:"14px!important"}}
                                        />
                                    </>
                                    }
                                >
                                    Create Proposal
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

