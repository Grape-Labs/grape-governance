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
    getAllTokenOwnerRecordsIndexed,
    getVoteRecordsByVoterIndexed,
} from '../../api/queries';

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

    // let's check here if the user is a delegate to give the option to choose who to create the proposal from

    const getGovernanceProposals = async () => {
        console.log("get governance proposals...");
        if (!loading){
            setLoading(true);
            try {
                const governanceAddressBase58 = new PublicKey(governanceAddress).toBase58();
                const grealm = await getRealmIndexed(governanceAddressBase58);
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
                            const voter = await getAllTokenOwnerRecordsIndexed(
                                governanceAddressBase58,
                                grealm.owner.toBase58(),
                                publicKey.toBase58(),
                                item.account.governingTokenMint.toBase58()
                            );
                            //console.log("post voter:"+ JSON.stringify(voter));
                            //console.log("proposal author:", item.account.tokenOwnerRecord.toBase58());
                            //console.log("governance rules:", item.account.governance.toBase58());
                            
                            // You can add additional logic here based on the voter record if needed
                            if (voter && voter.length > 0){
                                if (voter[0].pubkey.toBase58() === item.account.tokenOwnerRecord.toBase58())
                                    processedDraftProposals.push(item);
                            }
                        } catch (voterError) {
                            console.error("Error fetching voter record:", voterError);
                            // Handle individual voter fetch errors if necessary
                        }
                    }
                }
                
                setDraftProposals(processedDraftProposals);
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


    React.useEffect(() => { 
        if (governanceAddress){
            getGovernanceProposals();
        }
    }, [governanceAddress]);
    
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
