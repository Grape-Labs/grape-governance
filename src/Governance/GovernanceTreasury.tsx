import { getRealm } from '@solana/spl-governance';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
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
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

import { 
    getRealmIndexed,
    getGovernanceIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
} from '../Governance/api/queries';
import {
    getAllGovernances,
    getNativeTreasuryAddress
} from '@solana/spl-governance';

import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import ExplorerView from '../utils/grapeTools/Explorer';
import { getProfilePicture } from '@solflare-wallet/pfp';
import { findDisplayName } from '../utils/name-service';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ImageIcon from '@mui/icons-material/Image';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

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

declare module 'react' {
    interface CSSProperties {
      '--tree-view-color'?: string;
      '--tree-view-bg-color'?: string;
    }
  }
  
  type StyledTreeItemProps = TreeItemProps & {
    bgColor?: string;
    color?: string;
    labelIcon: React.ElementType<SvgIconProps>;
    labelInfo?: string;
    labelText: string;
  };
  
  const StyledTreeItemRoot = styled(TreeItem)(({ theme }) => ({
    color: theme.palette.text.secondary,
    [`& .${treeItemClasses.content}`]: {
      color: theme.palette.text.secondary,
      borderTopRightRadius: theme.spacing(2),
      borderBottomRightRadius: theme.spacing(2),
      paddingRight: theme.spacing(1),
      fontWeight: theme.typography.fontWeightMedium,
      '&.Mui-expanded': {
        fontWeight: theme.typography.fontWeightRegular,
      },
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
      '&.Mui-focused, &.Mui-selected, &.Mui-selected.Mui-focused': {
        backgroundColor: `var(--tree-view-bg-color, ${theme.palette.action.selected})`,
        color: 'var(--tree-view-color)',
      },
      [`& .${treeItemClasses.label}`]: {
        fontWeight: 'inherit',
        color: 'inherit',
      },
    },
    [`& .${treeItemClasses.group}`]: {
      marginLeft: 0,
      [`& .${treeItemClasses.content}`]: {
        paddingLeft: theme.spacing(2),
      },
    },
  }));
  
  function StyledTreeItem(props: StyledTreeItemProps) {
    const {
      bgColor,
      color,
      labelIcon: LabelIcon,
      labelInfo,
      labelText,
      ...other
    } = props;
  
    return (
      <StyledTreeItemRoot
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, pr: 0 }}>
            <Box component={LabelIcon} color="inherit" sx={{ mr: 1 }} />
            <Typography variant="body2" sx={{ fontWeight: 'inherit', flexGrow: 1 }}>
              {labelText}
            </Typography>
            <Typography variant="caption" color="inherit">
              {labelInfo}
            </Typography>
          </Box>
        }
        style={{
          '--tree-view-color': color,
          '--tree-view-bg-color': bgColor,
        }}
        {...other}
      />
    );
  }

TablePaginationActions.propTypes = {
    count: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired,
    page: PropTypes.number.isRequired,
    rowsPerPage: PropTypes.number.isRequired,
};

function TablePaginationActions(props) {
    const theme = useTheme();
    const { count, page, rowsPerPage, onPageChange } = props;
  
    const handleFirstPageButtonClick = (event) => {
        onPageChange(event, 0);
    };

    const handleBackButtonClick = (event) => {
        onPageChange(event, page - 1);
    };
  
    const handleNextButtonClick = (event) => {
        onPageChange(event, page + 1);
    };
  
    const handleLastPageButtonClick = (event) => {
        onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
    };
    
    return (
        <Box sx={{ flexShrink: 0, ml: 2.5 }}>
            <IconButton
                onClick={handleFirstPageButtonClick}
                disabled={page === 0}
                aria-label="first page"
            >
                {theme.direction === "rtl" ? <LastPageIcon /> : <FirstPageIcon />}
            </IconButton>
            <IconButton
                onClick={handleBackButtonClick}
                disabled={page === 0}
                aria-label="previous page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowRight />
                ) : (
                    <KeyboardArrowLeft />
                )}
            </IconButton>
            <IconButton
                onClick={handleNextButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="next page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowLeft />
                ) : (
                    <KeyboardArrowRight />
                )}
            </IconButton>
            <IconButton
                onClick={handleLastPageButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="last page"
            >
                {theme.direction === "rtl" ? <FirstPageIcon /> : <LastPageIcon />}
            </IconButton>
        </Box>
    );
}


export function GovernanceTreasuryView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const governanceAddress = urlParams;
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

    const getRealmDetails = async () => {
        let grealm = null;
        if (cachedRealm){
            console.log("Realm from cache")
            grealm = cachedRealm;
        } else{
            grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
        }
        const realmPk = new PublicKey(grealm.pubkey);
        setRealm(grealm);
        setRealmName(grealm.account.name);
    }

    const getCachedGovernanceFromLookup = async () => {
        
        let cached_governance = new Array();
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){

                    if (glitem?.realm){
                        setCachedRealm(glitem?.realm);
                    }

                    if (glitem?.governanceVaultsFilename){
                        const cached_treasury = await getFileFromLookup(glitem.governanceVaultsFilename, storagePool);
                        setCachedTreasury(cached_treasury);
                    }

                    /*
                    const rawGovernances = await getAllGovernances(
                        connection,
                        new PublicKey(glitem.realm.owner),
                        new PublicKey(governanceAddress)
                    );
                    console.log("rawGovernances: "+JSON.stringify(rawGovernances));

                    const governanceRulesIndexed = await getAllGovernancesIndexed(new PublicKey(governanceAddress).toBase58());
                    console.log("governanceRulesIndexed: "+JSON.stringify(governanceRulesIndexed));
                    */
                   
                    setRealmName(glitem.governanceName);

                    setTotalGovernanceValue(glitem?.totalVaultValue);
                    setTotalGovernanceSolValue(glitem?.totalVaultSolValue);
                    setTotalGovernanceSol(glitem?.totalVaultSol);
                    setTotalGovernanceNftFloorValue(glitem?.totalVaultNftValue);
                    setTotalGovernanceStableCoinValue(glitem?.totalVaultStableCoinValue);

                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);
                    setCachedTimestamp(glitem.timestamp);
                }
            }
        }

        
        setCachedGovernance(cached_governance);
        endTimer();
        setLoading(false);
        isLoading.current = false;
    }

    const startTimer = () => {
        setStartTime(Date.now());
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    const fetchGovernanceVaults = async(grealm:any) => {
    
        const rawGovernances = await getAllGovernances(
            RPC_CONNECTION,
            new PublicKey(grealm.owner),
            new PublicKey(grealm.pubkey)
        );
    
        /*
        const rawGovernances = await getAllGovernancesIndexed(
            new PublicKey(grealm.pubkey).toBase58(),
            new PublicKey(grealm.owner).toBase58()
        )
        */
        
        return rawGovernances;
    }

    const fetchGovernances = async() => {
        const governanceAddresses = await getAllGovernancesIndexed(governanceAddress);
        //console.log("governanceAddresses: "+JSON.stringify(governanceAddresses));
        

        //if (realm){
            const thisrealm = await getRealmIndexed(governanceAddress);
            
            const rawNativeSolAddresses = await Promise.all(
                governanceAddresses.map((x) =>
                    getNativeTreasuryAddress(
                        //@ts-ignore
                        new PublicKey(thisrealm.owner),
                        x!.pubkey
                    )
                )
            );

        // push to a single array with rules & native
        if (governanceAddresses.length === rawNativeSolAddresses.length){
            let x = 0;
            for (let item of governanceAddresses){
                item.nativeTreasuryAddress = rawNativeSolAddresses[x];
                item.walletValue = 0;
                x++;
            }
        }

        //console.log("governanceAddresses: "+JSON.stringify(governanceAddresses));
        //}

        setGovernanceWallets(governanceAddresses);
    }


    React.useEffect(() => {
        if (governanceValue){
            // sum all unique governances

        }
    }, [governanceValue]);

    


    React.useEffect(() => {
        if (governanceLookup){
            getCachedGovernanceFromLookup();
            // fetch all governance wallets from Index
            fetchGovernances();
        }
    }, [governanceLookup, governanceAddress]);
    
    React.useEffect(() => { 
        if (tokenMap){  
            isLoading.current = true;
            setLoading(true);
            startTimer();
            callGovernanceLookup();
        }
    }, [tokenMap]);

    React.useEffect(() => { 
        if (!isLoading.current) {
            if (!tokenMap){
                getTokens();
            }
        }
    }, []);

    
        if(loading){
            return (
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
            )
        } else{
            if (cachedTreasury){
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }} 
                    > 
                        {realmName &&
                            <>
                                <Grid container>
                                    <Grid item xs={12} sm={6} container justifyContent="flex-start">
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
                                    <Grid item xs={12} sm={6} container justifyContent="flex-end">
                                        <GovernanceNavigation governanceAddress={governanceAddress} />
                                    </Grid>
                                </Grid>
                            </>
                        }

                        <Box sx={{ p:1}}>
                            <Grid container spacing={0}>
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
                                            <>Treasury</>
                                        </Typography>
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
                                                        verticalAlign: 'bottom'}}
                                                    >
                                                    <Typography variant="h4">
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
                                            <>Solana Treasury</>
                                        </Typography>
                                        <Tooltip title={<>
                                                Total Value in&nbsp;
                                                <strong>{governanceValue && `${(Number(governanceValue.reduce((sum, item) => sum + item.totalGovernanceSol, 0).toFixed(2)).toLocaleString())}`}</strong>
                                                SOL held</>
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
                                                        {governanceValue && `$${(Number(governanceValue.reduce((sum, item) => sum + item.solAccountVal, 0).toFixed(2)).toLocaleString())}`}
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
                            </Grid>
                        </Box>
                            

                        {/*
                        <RenderGovernanceTreasuryTable members={members} participating={participating} tokenMap={tokenMap} governingTokenMint={governingTokenMint} governingTokenDecimals={governingTokenDecimals} circulatingSupply={circulatingSupply} totalDepositedVotes={totalDepositedVotes} />
                        */}

                        <Box
                            sx={{
                                m:2,
                            }} 
                        > 
                            {(publicKey &&
                            (publicKey.toBase58() === "KirkNf6VGMgc8dcbp5Zx3EKbDzN6goyTBMKN9hxSnBT" ||
                            publicKey.toBase58() === "FDw92PNX4FtibvkDm7nd5XJUAg6ChTcVqMaFmG7kQ9JP" ||
                            publicKey.toBase58() === "AZpn1dn3VbLdFe2JfbHe9JmUP7NX2roYyzNwKbDZqqvz" ||
                            publicKey.toBase58() === "F8qopzCYLt5dCf4t9GxtyQkNqSAEKfqiuMcpZbuMfP2x")) ?

                            
                            <Grid 
                                container 
                                spacing={4}
                                direction="row"
                                justifyContent="center"
                                alignItems="flex-start">
                                {governanceWallets && governanceWallets
                                    //.sort((a:any,b:any) => (b.walletValue - a.walletValue))
                                    .map((item: any,key:number) => (                                
                                        <Grid item md={4} sm={6} xs={12}>
                                            <WalletCardView 
                                                rulesWallet={item}
                                                governanceAddress={governanceAddress}
                                                setGovernanceValue={setGovernanceValue}
                                                governanceValue={governanceValue} 
                                                tokenMap={tokenMap} 
                                                walletAddress={new PublicKey(item.nativeTreasuryAddress).toBase58()}  />
                                        </Grid>
                                    ))
                                }
                            </Grid>
                            :<>
                            
                                <Grid container alignContent={'center'} justifyContent={'center'}>
                                    <h2>Get ready for some GRAPE(ness) very soon!!!</h2>
                                </Grid>

                            </>}

                        </Box>
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Realtime<br/>
                                {cachedTimestamp &&
                                    <>Cached: {moment.unix(Number(cachedTimestamp)).format("MMMM D, YYYY, h:mm a") }<br/></>
                                }
                                Cache Node: {storagePool}
                            </Typography>
                        }
                    </Box>
                                
                );
            }else{
                /*
                if (!participating){
                    return (
                        <Box
                            sx={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '17px',
                                p:4
                            }} 
                        > 
                            <Typography variant="h4">
                                You are not participating in this governance
                            </Typography>
                        </Box>
                    );
                } else {
                    */
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '17px',
                            p:4,
                            alignItems: 'center', textAlign: 'center'
                        }} 
                    > 
                        <Typography variant="caption">Governance Treasury {governanceAddress}</Typography>
                        
                    </Box>
                );
                
            }
            
        }
    
}