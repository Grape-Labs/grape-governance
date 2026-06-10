import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { PublicKey, Transaction } from '@solana/web3.js';
import moment from 'moment';

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
    ListItemIcon,
    TextField,
    Stack,
    FormControl,
    FormControlLabel,
    Switch,
    Select,
    InputLabel,
    Divider,
} from '@mui/material/';

import { 
    getRealmIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getTokenOwnerRecordsByRealmIndexed,
} from '../../api/queries';
import {
    annotateProposalAuthorCandidates,
    formatGovernanceTokenAmount,
    getProposalAuthorSelectionStorageKey,
    getRecordDepositAmount,
    resolveProposalAuthorRecord,
    toBase58Safe,
} from '../../Proposals/proposalAuthority';

import CreateGistWithOAuth from '../../CreateGist';

import { useWallet } from '@solana/wallet-adapter-react';

export default function AdvanvedProposalView(props: any){
    const governanceAddress = props?.governanceAddress;
    const proposalTitle = props?.proposalTitle;
    const setProposalTitle = props?.setProposalTitle;
    const proposalDescription = props?.proposalDescription;
    const setProposalDescription = props?.setProposalDescription;
    const toggleGoverningMintSelected = props?.toggleGoverningMintSelected;
    const isGoverningMintCouncilSelected = props?.isGoverningMintCouncilSelected;
    const isGoverningMintSelectable = props?.isGoverningMintSelectable;
    const isDraft = props?.isDraft;
    const setIsDraft = props?.setIsDraft;
    const rulesWallet = props?.rulesWallet;
    const skipSimulationProp = props?.skipSimulation;
    const setSkipSimulationProp = props?.setSkipSimulation;

    const editProposalAddress = props?.editProposalAddress;
    const setEditProposalAddress = props?.setEditProposalAddress;
    
    const maxTitleLen = 130;
    const maxDescriptionLen = 350;//512;

    const { publicKey } = useWallet();

    const [loading, setLoading] = React.useState(false);
    const [draftProposals, setDraftProposals] = React.useState(null);
    const [skipSimulationLocal, setSkipSimulationLocal] = React.useState(false);
    const [cachedRealm, setCachedRealm] = React.useState<any>(null);
    const [governingMintDecimals, setGoverningMintDecimals] = React.useState<number>(0);
    const [proposalAuthorOptions, setProposalAuthorOptions] = React.useState<any[]>([]);
    const [selectedProposalAuthorPk, setSelectedProposalAuthorPk] = React.useState<string>('');
    const [proposalAuthorRecord, setProposalAuthorRecord] = React.useState<any>(null);

    const skipSimulation =
        typeof skipSimulationProp === 'boolean'
            ? skipSimulationProp
            : skipSimulationLocal;

    const persistSkipSimulation = (value: boolean) => {
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('grape_skip_simulation', value ? 'true' : 'false');
            }
        } catch (e) {
            console.log('Unable to persist skip simulation flag', e);
        }
    };

    const handleSkipSimulationChange = (value: boolean) => {
        if (typeof setSkipSimulationProp === 'function') {
            setSkipSimulationProp(value);
        } else {
            setSkipSimulationLocal(value);
        }
        persistSkipSimulation(value);
    };

    const getSelectedGoverningMint = React.useCallback((realmItem?: any) => {
        const selectedRealm = realmItem || cachedRealm;
        if (!selectedRealm?.account?.communityMint) return null;
        if (isGoverningMintCouncilSelected && selectedRealm?.account?.config?.councilMint) {
            return new PublicKey(selectedRealm.account.config.councilMint);
        }
        return new PublicKey(selectedRealm.account.communityMint);
    }, [cachedRealm, isGoverningMintCouncilSelected]);

    const updateSelectedGoverningMintDecimals = React.useCallback(async (realmItem?: any) => {
        const selectedRealm = realmItem || cachedRealm;
        const governingMint = getSelectedGoverningMint(selectedRealm);
        const councilMint58 = toBase58Safe(selectedRealm?.account?.config?.councilMint) || '';
        const selectedMint58 = governingMint?.toBase58?.() || '';
        if (!governingMint || !selectedMint58) {
            setGoverningMintDecimals(0);
            return;
        }
        if (councilMint58 && selectedMint58 === councilMint58) {
            setGoverningMintDecimals(0);
            return;
        }
        try {
            const mintInfo = await RPC_CONNECTION.getParsedAccountInfo(governingMint);
            setGoverningMintDecimals(Number(mintInfo?.value?.data?.parsed?.info?.decimals ?? 0));
        } catch (e) {
            console.log('Unable to fetch governing mint decimals', e);
            setGoverningMintDecimals(0);
        }
    }, [cachedRealm, getSelectedGoverningMint]);

    const persistProposalAuthorSelection = React.useCallback((mint58?: string | null, recordPk?: string | null) => {
        try {
            if (typeof window === 'undefined') return;
            const storageKey = getProposalAuthorSelectionStorageKey(governanceAddress, mint58);
            if (recordPk) {
                window.localStorage.setItem(storageKey, recordPk);
            } else {
                window.localStorage.removeItem(storageKey);
            }
        } catch (e) {
            console.log('Unable to persist proposal author selection', e);
        }
    }, [governanceAddress]);

    const loadProposalAuthorOptions = React.useCallback(async (realmItem?: any) => {
        const selectedRealm = realmItem || cachedRealm;
        if (!selectedRealm || !publicKey) {
            setProposalAuthorOptions([]);
            setSelectedProposalAuthorPk('');
            setProposalAuthorRecord(null);
            return;
        }

        const governingMint = getSelectedGoverningMint(selectedRealm);
        if (!governingMint) {
            setProposalAuthorOptions([]);
            setSelectedProposalAuthorPk('');
            setProposalAuthorRecord(null);
            return;
        }

        const authorResolution = await resolveProposalAuthorRecord(
            new PublicKey(selectedRealm.pubkey),
            new PublicKey(selectedRealm.owner),
            publicKey,
            governingMint
        );

        const candidates = annotateProposalAuthorCandidates(
            Array.isArray(authorResolution?.allCandidates)
                ? authorResolution.allCandidates
                : [],
            rulesWallet?.account?.config,
            governingMint.toBase58(),
            toBase58Safe(selectedRealm?.account?.config?.councilMint)
        );
        const eligibleCandidates = candidates.filter(
            (item: any) => item?.proposalAuthorEligibility?.eligible !== false
        );
        let storedRecordPk = '';
        try {
            if (typeof window !== 'undefined') {
                storedRecordPk =
                    window.localStorage.getItem(
                        getProposalAuthorSelectionStorageKey(governanceAddress, governingMint.toBase58())
                    ) || '';
            }
        } catch (e) {
            console.log('Unable to read proposal author selection', e);
        }

        const selectedRecord =
            eligibleCandidates.find((item: any) => toBase58Safe(item?.pubkey) === storedRecordPk) ||
            candidates.find(
                (item: any) =>
                    toBase58Safe(item?.pubkey) === storedRecordPk &&
                    item?.proposalAuthorEligibility?.eligible !== false
            ) ||
            eligibleCandidates[0] ||
            null;
        const selectedPk = toBase58Safe(selectedRecord?.pubkey) || '';

        setProposalAuthorOptions(candidates);
        setSelectedProposalAuthorPk(selectedPk);
        setProposalAuthorRecord(selectedRecord);
        persistProposalAuthorSelection(governingMint.toBase58(), selectedPk);
    }, [cachedRealm, publicKey, getSelectedGoverningMint, governanceAddress, persistProposalAuthorSelection]);

    const getGovernanceProposals = async () => {
        console.log("get governance proposals...");
        if (!loading){
            setLoading(true);
            try {
                const governanceAddressBase58 = new PublicKey(governanceAddress).toBase58();
                const grealm = await getRealmIndexed(governanceAddressBase58);
                setCachedRealm(grealm);
                const governanceRulesIndexed = await getAllGovernancesIndexed(governanceAddressBase58, grealm?.owner);
                const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
                
                const gprops = await getAllProposalsIndexed(
                    governanceRulesStrArr, 
                    grealm?.owner, 
                    governanceAddressBase58
                );
                
                const processedDraftProposals = [];
                
                for (const item of gprops) {
                    if (item?.account?.state === 0) { // Check if proposal is in draft state
                        try {
                            const voter = await getTokenOwnerRecordsByRealmIndexed(
                                governanceAddressBase58,
                                grealm.owner.toBase58(),
                                publicKey.toBase58()
                            );
                            const matchingVoter = voter?.find?.((record: any) =>
                                record?.pubkey?.toBase58?.() === item.account.tokenOwnerRecord.toBase58() &&
                                record?.account?.governingTokenMint?.toBase58?.() === item.account.governingTokenMint.toBase58()
                            );

                            if (matchingVoter){
                                processedDraftProposals.push(item);
                            }
                        } catch (voterError) {
                            console.error("Error fetching voter record:", voterError);
                            // Handle individual voter fetch errors if necessary
                        }
                    }
                }
                
                setDraftProposals(processedDraftProposals);
                await updateSelectedGoverningMintDecimals(grealm);
                await loadProposalAuthorOptions(grealm);
            } catch (e) {
                console.error("Error in getGovernanceProposals:", e);
            } finally {
                setLoading(false);
            }
        }
    }

    const handleSelectChange = (event: any) => {
        const tata = event.target.value;
        setEditProposalAddress(tata);
    }

    const handleProposalAuthorChange = (event: any) => {
        const selectedPk = event.target.value || '';
        const selectedRecord =
            proposalAuthorOptions.find((item: any) => toBase58Safe(item?.pubkey) === selectedPk) || null;
        if (selectedRecord?.proposalAuthorEligibility?.eligible === false) {
            return;
        }
        setSelectedProposalAuthorPk(selectedPk);
        setProposalAuthorRecord(selectedRecord);
        const governingMint = getSelectedGoverningMint();
        persistProposalAuthorSelection(governingMint?.toBase58?.() || null, selectedPk || null);
    }


    React.useEffect(() => { 
        if (governanceAddress){
            getGovernanceProposals();
        }
    }, [governanceAddress]);

    React.useEffect(() => {
        if (cachedRealm && publicKey) {
            updateSelectedGoverningMintDecimals(cachedRealm);
            loadProposalAuthorOptions(cachedRealm);
        }
    }, [cachedRealm, publicKey, isGoverningMintCouncilSelected, loadProposalAuthorOptions, updateSelectedGoverningMintDecimals]);
    
    React.useEffect(() => { 
        if (editProposalAddress){
            setIsDraft(true);
        }
    }, [editProposalAddress]);

    React.useEffect(() => {
        if (typeof skipSimulationProp === 'boolean') return;
        try {
            if (typeof window !== 'undefined') {
                const persisted = window.localStorage.getItem('grape_skip_simulation');
                setSkipSimulationLocal(persisted === 'true');
            }
        } catch (e) {
            console.log('Unable to read skip simulation flag', e);
        }
    }, [skipSimulationProp]);

    const stopInputKeyPropagation = (event: React.KeyboardEvent) => {
        event.stopPropagation();
    };


    return (
        <>
            <Box
                sx={{
                    border:'1px solid #333',
                    borderRadius:'17px',
                    p:2,
                }}
                onKeyDown={stopInputKeyPropagation}
            >
                
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField
                    required
                    margin="dense"
                    id="proposal_title"
                    name="proposal_title"
                    label="Proposal TItle"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={proposalTitle}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                    sx={{textAlign:"center"}}
                    />
                
                <Grid sx={{textAlign:'right',}}>
                    <Typography variant="caption">{proposalTitle ? proposalTitle.length > 0 ? maxTitleLen - proposalTitle.length : maxTitleLen : maxTitleLen} characters remaining</Typography>
                </Grid>
            </FormControl>

            <FormControl fullWidth  sx={{mb:2}}> 
                <TextField
                    required
                    margin="dense"
                    id="proposal_dsecription"
                    name="proposal_description"
                    label="Proposal Description"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={proposalDescription}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => setProposalDescription(e.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                    sx={{textAlign:"center"}}
                    />

                    <Grid container justifyContent="space-between" alignItems="center">
                        
                        {/*governanceAddress === 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' &&*/}
                        <Grid item sx={{textAlign:'left',}}>
                            <CreateGistWithOAuth
                            onGistCreated={(url) => {
                                // Set it to your description field, or trigger your handler
                                setProposalDescription(url); // or handleDescriptionChange(url)
                            }}
                            defaultText={proposalDescription}
                            />
                        </Grid>

                        <Grid sx={{textAlign:'right',}}>
                            <Typography variant="caption">{proposalDescription ? proposalDescription.length > 0 ? maxDescriptionLen - proposalDescription.length : maxDescriptionLen : maxDescriptionLen} characters remaining</Typography>
                        </Grid>
                    </Grid>
                </FormControl>

                {(setEditProposalAddress) &&
                    <>
                    {/*
                    <FormControl fullWidth  sx={{mb:2}}>
                        <TextField
                            autoFocus
                            required
                            margin="dense"
                            id="proposal_address"
                            name="proposal_address"
                            label="Edit Proposal Address"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={editProposalAddress}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => setEditProposalAddress(e.target.value)}
                            sx={{textAlign:"center"}}
                            />
                    </FormControl>
                    */}

                    {draftProposals &&
                        <FormControl fullWidth  sx={{mb:2}}>
                            <InputLabel id="demo-simple-select-label">Edit Proposal</InputLabel>
                            <Select
                                labelId="master-wallet"
                                id="master-wallet"
                                size='small'
                                label="Edit Proposal"
                                //value={tokenSelected ? tokenSelected?.associated_account : ""}
                                sx={{}}
                                onChange={handleSelectChange}
                                //renderValue={() => <RenderTokenSelected ata={tokenSelected?.associated_account} />}
                            >
                                <MenuItem value={null} key={0}>
                                    Create New Proposal
                                </MenuItem>
                                <Divider/>
                                {draftProposals.map((item: any, index:number) => (
                                    <MenuItem value={item.pubkey.toBase58()} key={index}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={8}>
                                                {item.account.name}
                                            </Grid>
                                            <Grid item xs={4}>
                                                <Typography variant="caption" color={`gray`}>
                                                    {`${item.account?.draftAt ? (moment.unix(Number((item.account?.draftAt))).format("MMM D, YYYY, h:mm a")) : `-`}`}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    }
                    </>

                }

                <FormControl fullWidth >
                    <FormControlLabel 
                    control={
                        <Switch 
                        checked={isGoverningMintCouncilSelected} //communitySupport ? false : true}
                        onChange={
                            (e) => {
                                toggleGoverningMintSelected(e.target.checked)
                            }
                        }
                        disabled={!isGoverningMintSelectable}
                        />
                    } 
                    label="Council" />
                </FormControl>

                <FormControl fullWidth sx={{mt:1, mb:2}}>
                    <InputLabel id="proposal-author-select-label">Create Proposal As</InputLabel>
                    <Select
                        labelId="proposal-author-select-label"
                        id="proposal-author-select"
                        size='small'
                        label="Create Proposal As"
                        value={selectedProposalAuthorPk || ''}
                        onChange={handleProposalAuthorChange}
                        disabled={!proposalAuthorOptions.length}
                    >
                        {proposalAuthorOptions.map((item: any) => {
                            const recordPk = toBase58Safe(item?.pubkey) || '';
                            const owner58 = toBase58Safe(item?.account?.governingTokenOwner) || '';
                            const isOwnRecord = owner58 === publicKey?.toBase58();
                            const isEligible = item?.proposalAuthorEligibility?.eligible !== false;
                            const reason = item?.proposalAuthorEligibility?.reason;
                            return (
                                <MenuItem value={recordPk} key={recordPk} disabled={!isEligible}>
                                    {isOwnRecord
                                        ? `Your voting power • ${owner58.slice(0, 4)}...${owner58.slice(-4)} • ${formatGovernanceTokenAmount(item?.account?.governingTokenDepositAmount, governingMintDecimals)}`
                                        : `Delegated from ${owner58.slice(0, 4)}...${owner58.slice(-4)} • ${formatGovernanceTokenAmount(item?.account?.governingTokenDepositAmount, governingMintDecimals)}`}
                                    {!isEligible && reason ? ` • ${reason}` : ''}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>

                <Box sx={{ mb: 2, p: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.04)' }}>
                    {proposalAuthorRecord ? (
                        <>
                            <Typography variant="caption" sx={{ display: 'block' }}>
                                {toBase58Safe(proposalAuthorRecord?.account?.governingTokenOwner) === publicKey?.toBase58()
                                    ? 'Using your own voting record'
                                    : `Using delegated voting power from ${toBase58Safe(proposalAuthorRecord?.account?.governingTokenOwner)?.slice(0, 4)}...${toBase58Safe(proposalAuthorRecord?.account?.governingTokenOwner)?.slice(-4)}`}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                                Token owner record: {toBase58Safe(proposalAuthorRecord?.pubkey)?.slice(0, 5)}...{toBase58Safe(proposalAuthorRecord?.pubkey)?.slice(-5)}
                            </Typography>
                        </>
                    ) : (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            {proposalAuthorOptions.length > 0
                                ? 'Available wallets do not meet the minimum proposal threshold for this governance.'
                                : 'No direct or delegated voting record is available for the selected governing mint.'}
                        </Typography>
                    )}
                </Box>

                <FormControl fullWidth >
                    <FormControlLabel 
                    control={
                        <Switch 
                            checked={isDraft}
                            onChange={
                                (e) => {
                                    setIsDraft(!isDraft)
                                }
                            }
                        />
                    } 
                    label="Draft" />
                </FormControl>

                <FormControl fullWidth>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={skipSimulation}
                                onChange={(e) => {
                                    handleSkipSimulationChange(e.target.checked);
                                }}
                            />
                        }
                        label="Skip simulation"
                    />
                </FormControl>
            </Box>
        </>
    )
}
