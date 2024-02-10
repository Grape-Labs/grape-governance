import { getRealm } from '@solana/spl-governance';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { 
    TOKEN_PROGRAM_ID, 
    getMint,
    getAssociatedTokenAddress
} from "@solana/spl-token-v2";

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import axios from "axios";
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import moment from 'moment';

import { 
    tryGetName,
} from '@cardinal/namespaces';

import { CardinalTwitterIdentityResolver } from '@dialectlabs/identity-cardinal';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import BN from 'bn.js';
import { styled, useTheme } from '@mui/material/styles';
import {
  Typography,
  Button,
  Grid,
  Box,
  Paper,
  Avatar,
  Table,
  TableContainer,
  TableCell,
  TableHead,
  TableBody,
  TableFooter,
  TableRow,
  TablePagination,
  Collapse,
  Tooltip,
  CircularProgress,
  LinearProgress,
} from '@mui/material/';

import TreeView from '@mui/lab/TreeView';
import TreeItem, { TreeItemProps, treeItemClasses } from '@mui/lab/TreeItem';

import WalletCardView from './Treasury/WalletCardView';
import GovernanceNavigation from './GovernanceNavigation'; 

import { 
    getRealmIndexed,
    getGovernanceIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
} from '../Governance/api/queries';
import {
    getNativeTreasuryAddress
} from '@solana/spl-governance';

import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers';

import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import LastPageIcon from '@mui/icons-material/LastPage';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IconButton from '@mui/material/IconButton';
import Label from '@mui/icons-material/Label';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { SvgIconProps } from '@mui/material/SvgIcon';

import PropTypes from 'prop-types';
import { 
    RPC_CONNECTION, 
    GGAPI_STORAGE_POOL } from '../utils/grapeTools/constants';
import { InfoItem } from '@dynamic-labs/sdk-react-core/src/lib/components';

const GOVERNANNCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing with Errors!',
}


export function GovernanceTreasuryView(props: any) {
    //const [searchParams, setSearchParams] = useSearchParams();
    //const {handlekey} = useParams<{ handlekey: string }>();
    //const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const {address} = useParams<{ address: string }>();
    const {rules} = useParams<{ rules: string }>();
    const governanceAddress = address;
    const filterRulesWallet = rules;
    //const governanceAddress = urlParams;
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [cachedGovernance, setCachedGovernance] = React.useState(null);
    const [cachedRealm, setCachedRealm] = React.useState(null);
    const [cachedTreasury, setCachedTreasury] = React.useState(null);
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    
    const isLoading = React.useRef(false);
    const [loading, setLoading] = React.useState(false);
    const connection = RPC_CONNECTION;
    const [realm, setRealm] = React.useState(null);
    const [realmName, setRealmName] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [cachedTimestamp, setCachedTimestamp] = React.useState(null);

    const [governanceValue, setGovernanceValue] = React.useState([]);

    const [totalGovernanceValue, setTotalGovernanceValue] = React.useState(null);
    const [totalGovernanceSolValue, setTotalGovernanceSolValue] = React.useState(null);
    const [totalGovernanceSol, setTotalGovernanceSol] = React.useState(null);
    const [totalGovernanceNftFloorValue, setTotalGovernanceNftFloorValue] = React.useState(null);
    const [totalGovernanceStableCoinValue, setTotalGovernanceStableCoinValue] = React.useState(null);
    const [totalStakedValue, setTotalStakedValue] = React.useState(null);

    const [communityMintDecimals, setCommunityMintDecimals] = React.useState(0);
    const [governanceWallets, setGovernanceWallets] = React.useState(null);

    const { publicKey } = useWallet();

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            let tmap  = null;
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tokenMp = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map());
                setTokenMap(tokenMp);
                setTokenArray(tarray);
                tmap = tokenMp;
            });
            return tmap;
        } catch(e){console.log("ERR: "+e); return null;}
    }

    const fetchRealm = async() =>{
        const rlm = await getRealmIndexed(governanceAddress);
        //console.log("rlm: "+JSON.stringify(rlm))

        if (rlm){
            if (rlm?.account?.communityMint && rlm.account.communityMint.toBase58()){
                const mintInfo = await getMint(RPC_CONNECTION, rlm.account.communityMint);
                const decimals = mintInfo.decimals;
                setCommunityMintDecimals(decimals);
            }

            setRealm(rlm);
            setRealmName(rlm.account?.name)
            setCachedRealm(rlm);
        }
    }

    const startTimer = () => {
        setStartTime(Date.now());
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    const fetchGovernances = async() => {
        const tmpGovernanceAddresses = await getAllGovernancesIndexed(governanceAddress);
        
        if (tmpGovernanceAddresses){

            const governanceAddresses = new Array();
                    
            for (let item of tmpGovernanceAddresses){
                if (filterRulesWallet){
                    
                    if (filterRulesWallet === item.pubkey.toBase58())
                        governanceAddresses.push(item);
                } else {
                    governanceAddresses.push(item);
                }

            }
            
            let thisrealm = null;
            if (realm)
                thisrealm = realm;
            else
                thisrealm = await getRealmIndexed(governanceAddress);
            
            const rawNativeSolAddresses = await Promise.all(
                governanceAddresses.map((x) =>  
                    getNativeTreasuryAddress(
                        //@ts-ignore
                        new PublicKey(thisrealm.owner),
                        x!.pubkey
                    )
                )
            );

       
            if (governanceAddresses.length === rawNativeSolAddresses.length){
                let x = 0;
                for (let item of governanceAddresses){
                    item.nativeTreasuryAddress = rawNativeSolAddresses[x];
                    item.walletValue = 0;
                    x++;
                }
            }

            setGovernanceWallets(governanceAddresses);
        }

        endTimer();
        setLoading(false);
        isLoading.current = false;
    }

    React.useEffect(() => { 
        if (realm){  
            isLoading.current = true;
            setLoading(true);
            startTimer();
            fetchGovernances();
        }
    }, [realm]);

    React.useEffect(() => { 
        if (!isLoading.current) {
            fetchRealm();
        }
    }, []);

    return (
        <>
        {(loading && !governanceWallets)?
            <Box
                sx={{
                    mt:6,
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    p:4,
                    alignItems: 'center', textAlign: 'center'
                }} 
            > 
                <Typography variant="caption">Loading Governance Treasury {governanceAddress}</Typography>
                
                <LinearProgress color="inherit" />
            </Box>
        :

            <Box
                    sx={{
                        mt:6,
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '17px',
                        overflow: 'hidden',
                        p:1,
                    }} 
                > 
                    {realmName &&
                        <>
                            <Grid container>
                                <Grid item xs={6} container justifyContent="flex-start">
                                    <Grid container>
                                        <Grid item xs={12}>
                                            <Typography variant="h4">
                                                {realmName}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Button 
                                                aria-label="back"
                                                variant="outlined" 
                                                color='inherit'
                                                href={`https://realms.today/dao/${governanceAddress}`}
                                                target='blank'
                                                sx={{
                                                    borderRadius:'17px',
                                                    borderColor:'rgba(255,255,255,0.05)',
                                                    fontSize:'10px'}}
                                            >
                                                <OpenInNewIcon fontSize='inherit' sx={{mr:1}} /> Realms
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Grid>
                                <Grid item xs={6} container justifyContent="flex-end">
                                    <GovernanceNavigation governanceAddress={governanceAddress} />
                                </Grid>
                            </Grid>
                        </>
                    }

                    {filterRulesWallet ?
                    <></>
                    :
                        <Box sx={{ p:1}}>

                            <Grid container spacing={1}>
                                <Grid item xs={12} md={6} lg={6} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:0,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)'
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>Treasury</>
                                        </Typography>
                                        <Box
                                            sx={{
                                                borderRadius: '17px',
                                                display: 'flex', /* Add this line */
                                                justifyContent: 'center', /* Add this line */
                                                alignItems: 'center', /* Add this line */
                                            }}
                                        >
                                            <Tooltip title={<>
                                                    Total Token Value (value does not include NFT floor prices)</>
                                                }>
                                                <Button
                                                    color='inherit'
                                                    sx={{
                                                        borderRadius:'17px'
                                                    }}
                                                >
                                                    <Grid container
                                                        sx={{
                                                            verticalAlign: 'bottom',
                                                            textAlign:'center'}}
                                                        >
                                                        <Typography variant="h4" sx={{textAlign:'center'}}>
                                                            {governanceValue && `$${(Number(governanceValue.reduce((sum, item) => sum + item.totalVal, 0).toFixed(2)).toLocaleString())}`}
                                                            {/*totalGovernanceValue ? 
                                                            <>${getFormattedNumberToLocale(totalGovernanceValue.toFixed(2))}</>
                                                            :
                                                            <>-</>*/}
                                                        </Typography>
                                                    </Grid>
                                                </Button>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                </Grid>
                                
                                <Grid item xs={12} md={6} lg={6} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:0,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>Solana Treasury</>
                                        </Typography>
                                        <Box
                                            sx={{
                                                borderRadius: '17px',
                                                display: 'flex', /* Add this line */
                                                justifyContent: 'center', /* Add this line */
                                                alignItems: 'center', /* Add this line */
                                            }}
                                        >
                                            <Tooltip title={<>
                                                    Total Value in&nbsp;
                                                    <strong>{governanceValue && `${(Number(governanceValue.reduce((sum, item) => sum + item.totalGovernanceSol, 0).toFixed(2)).toLocaleString())}`}</strong>
                                                    SOL held</>
                                                }>
                                                <Button
                                                    color='inherit'
                                                    sx={{
                                                        borderRadius: '17px',
                                                        display: 'flex', /* Add this line */
                                                        justifyContent: 'center', /* Add this line */
                                                        alignItems: 'center', /* Add this line */
                                                    }}
                                                >
                                                    <Grid container
                                                        sx={{
                                                            verticalAlign: 'bottom'}}
                                                        >
                                                            
                                                            <Typography variant="h4" sx={{textAlign:'center'}}>
                                                                {governanceValue && `$${(Number(governanceValue.reduce((sum, item) => sum + item.solAccountVal, 0).toFixed(2)).toLocaleString())}`}
                                                                
                                                            </Typography>
                                                        
                                                    </Grid>
                                                </Button>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                </Grid>
                                {/*
                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)'
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>Stable Coin Treasury (cached)</>
                                        </Typography>
                                        <Tooltip title={<>
                                                Total Treasury in Stable Coins</>
                                            }>
                                            <Button
                                                color='inherit'
                                                sx={{
                                                    borderRadius:'17px'
                                                }}
                                            >
                                                <Grid container
                                                    sx={{
                                                        verticalAlign: 'bottom'}}
                                                    >
                                                    <Typography variant="h4">
                                                    {totalGovernanceStableCoinValue ? 
                                                        <>
                                                        ${getFormattedNumberToLocale(totalGovernanceStableCoinValue.toFixed(2))}</>
                                                        :
                                                        <>-</>}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)'
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>NFT Treasury (cached)</>
                                        </Typography>
                                        <Tooltip title={<>
                                                Total Floor Value of NFTs held in this Governance</>
                                            }>
                                            <Button
                                                color='inherit'
                                                sx={{
                                                    borderRadius:'17px'
                                                }}
                                            >
                                                <Grid container
                                                    sx={{
                                                        verticalAlign: 'bottom'}}
                                                    >
                                                    <Typography variant="h4">
                                                        {totalGovernanceNftFloorValue ? 
                                                        <>
                                                        ${getFormattedNumberToLocale(totalGovernanceNftFloorValue.toFixed(2))}</>
                                                        :
                                                        <>-</>}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>
                                */}
                            </Grid>
                        </Box>
                    }
                        

                    {/*
                    <RenderGovernanceTreasuryTable members={members} participating={participating} tokenMap={tokenMap} governingTokenMint={governingTokenMint} governingTokenDecimals={governingTokenDecimals} circulatingSupply={circulatingSupply} totalDepositedVotes={totalDepositedVotes} />
                    */}

                    <Box
                        sx={{
                            mt:2,
                            mb:2,
                        }} 
                    > 
                        {/**/}

                        
                        <Grid 
                            container 
                            spacing={4}
                            direction="row"
                            justifyContent="center"
                            alignItems="flex-start">
                            {governanceWallets && governanceWallets
                                //.sort((a:any,b:any) => (b.walletValue - a.walletValue))
                                .map((item: any,key:number) => (                                
                                    <Grid item lg={4} md={6} sm={12} xs={12}>
                                        <WalletCardView 
                                            realm={realm}
                                            rulesWallet={item}
                                            governanceWallets={governanceWallets}
                                            governanceAddress={governanceAddress}
                                            setGovernanceValue={setGovernanceValue}
                                            governanceValue={governanceValue} 
                                            communityMintDecimals={communityMintDecimals}
                                            tokenMap={tokenMap} 
                                            walletAddress={new PublicKey(item.nativeTreasuryAddress).toBase58()}  />
                                    </Grid>
                                ))
                            }
                        </Grid>
                        {/*
                        :<>
                        
                            <Grid container alignContent={'center'} justifyContent={'center'}>
                                <h2>Get ready for some GRAPE(ness) very soon!!!</h2>
                            </Grid>

                        </>*/}

                    </Box>
                    {endTime &&
                        <Typography 
                            variant="caption"
                            sx={{textAlign:'center'}}
                        >
                            Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Realtime<br/>
                            Cache Node: {storagePool}
                        </Typography>
                    }
                </Box>
            }
        </>
    );

}