
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
//import Gist from 'react-gist';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';

import {
  Typography,
  Tooltip,
  Button,
  Grid,
  Box,
  ButtonGroup,
} from '@mui/material/';

import AddCircleIcon from '@mui/icons-material/AddCircle';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import SettingsIcon from '@mui/icons-material/Settings';
import AddCircle from '@mui/icons-material/AddCircle';

import { 
    RPC_CONNECTION,
    PROXY,
    HELIUS_API,
    HELLO_MOON_BEARER,
    GGAPI_STORAGE_POOL,
    GGAPI_STORAGE_URI,
    PRIMARY_STORAGE_WALLET,
    RPC_ENDPOINT,
    WS_ENDPOINT,
    TWITTER_PROXY
} from '../utils/grapeTools/constants';

import { 
    findObjectByGoverningTokenOwner
  } from '../utils/grapeTools/helpers';

  import { 
    getRealmIndexed,
    getProposalIndexed,
    getProposalNewIndexed,
    getAllProposalsIndexed,
    getGovernanceIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getTokenOwnerRecordsByRealmIndexed,
} from './api/queries';

export default function GovernanceNavigation(props: any){
    const governanceAddress = props.governanceAddress;
    const [realm, setRealm] = React.useState(props?.realm || null);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(props?.cachedMemberMap || false);
    const [rpcMemberMap, setRpcMemberMap] = React.useState(null);
    const [isParticipatingInDao, setIsParticipatingInDao] = React.useState(false);
    const { publicKey } = useWallet();

    async function getRpcMemberMap(){
        //console.log("realm.owner? "+realm?.owner)
        //const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(realm?.owner || SYSTEM_PROGRAM_ID), new PublicKey(governanceAddress));
        //console.log("rawTokenOwnerRecords: "+rawTokenOwnerRecords);
        //setRpcMemberMap(rawTokenOwnerRecords);
    }

    React.useEffect(() => {
        if (publicKey && rpcMemberMap){
            const foundObject = getTokenOwnerRecordsByRealmIndexed(governanceAddress, null, publicKey.toBase58());

            //const foundObject = findObjectByGoverningTokenOwner(rpcMemberMap, publicKey.toBase58(), true, 0)
            if (foundObject){
                setIsParticipatingInDao(true);
            }
        }
    }, [rpcMemberMap]);

    React.useEffect(() => {
        if (publicKey && cachedMemberMap){
            //const foundObject = findObjectByGoverningTokenOwner(cachedMemberMap, publicKey.toBase58(), false, 0)
            const foundObject = getTokenOwnerRecordsByRealmIndexed(governanceAddress, null, publicKey.toBase58());

            if (foundObject){
                setIsParticipatingInDao(true);
            }
        } else if (publicKey && !cachedMemberMap){
            //console.log("key ++ cache")
            //getRpcMemberMap();
        }
    }, [cachedMemberMap, publicKey]);

    return(
        <Grid xs={12}>
            <Box
                m={1}
                //margin
                display="flex"
                justifyContent="flex-end"
                alignItems="flex-end"
                >
                    {/*publicKey &&
                    <Tooltip title={
                            <><strong>Create Proposal</strong><br/> (coming soon)
                            </>
                        }>
                        <Button
                            variant="text"
                            color="warning"
                            size='small'
                            //component={Link}
                            //to={'/newproposal/'+governanceAddress}
                            sx={{mr:1}}
                        ><AddCircleIcon /></Button>
                    </Tooltip>
                    */}
                    <ButtonGroup
                        color='inherit'
                        size='small'
                        variant='outlined'
                        sx={{borderRadius:'17px'}}
                    >
                        <Tooltip title={
                                <><strong>Proposals</strong><br/>* Realtime Hybrid Caching
                                </>
                            }>
                            <Button
                                component={Link}
                                to={'/dao/'+governanceAddress}
                                sx={{borderTopLeftRadius:'17px', borderBottomLeftRadius:'17px'}}
                            ><HowToVoteIcon /></Button>
                        </Tooltip>
                        <Tooltip title={
                            <><strong>Members</strong><br/>
                            </>}>
                            <Button
                                component={Link}
                                to={'/members/'+governanceAddress}
                            ><GroupIcon /></Button>
                        </Tooltip>
                        <Tooltip title={
                            <><strong>Treasury</strong></>
                            }>
                            <Button
                                component={Link}
                                to={'/treasury/'+governanceAddress}
                            ><AccountBalanceIcon /></Button>
                        </Tooltip>
                        <Tooltip title={
                            <><strong>Metrics</strong><br/>* Via Cached Storage<br/>** Premium Feature
                            </>}>
                            <Button
                                component={Link}
                                to={'/metrics/'+governanceAddress}
                                sx={{borderTopRightRadius:'17px', borderBottomRightRadius:'17px'}}
                            ><BarChartIcon /></Button>
                        </Tooltip>
                        {/*
                        <Tooltip title={
                            <><strong>Reputation</strong><br/> (coming soon)</>
                            }>
                            <Button
                                sx={{color:'#999', ml:1}}
                            ><MilitaryTechIcon /></Button>
                        </Tooltip>

                        <Tooltip title={
                            <><strong>Configuration</strong><br/> (coming soon)</>
                            }>
                            <Button
                                sx={{color:'#999', ml:1}}
                            ><SettingsIcon /></Button>
                        </Tooltip>
                        */}

                        {/*isParticipatingInDao &&
                            <Tooltip title={
                                <><strong>Proposal Builder</strong><br/></>
                                }>
                                <Button
                                    color='warning'
                                    component={Link}
                                    to={'/newproposal/'+governanceAddress}
                                    sx={{borderTopRightRadius:'17px', borderBottomRightRadius:'17px'}}
                                ><AddCircle /></Button>
                            </Tooltip>
                        */}

                    </ButtonGroup>
                    
            </Box>
        </Grid>
    );
}