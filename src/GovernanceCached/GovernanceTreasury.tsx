import { getRealm, getAllTokenOwnerRecords, getTokenOwnerRecordsByOwner } from '@solana/spl-governance';
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

import GovernanceNavigation from './GovernanceNavigation'; 
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

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

function RenderGovernanceMembersTable(props:any) {
    const tokenMap = props.tokenMap;
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const participating = props.participating;
    const members = props.members;
    const circulatingSupply = props.circulatingSupply;
    const totalDepositedVotes = props.totalDepositedVotes;
    const connection = RPC_CONNECTION;
    const { publicKey } = useWallet();
    const [memberVotingResults, setMemberVotingResults] = React.useState(null);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    // Avoid a layout jump when reaching the last page with empty rows.
    const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - members.length) : 0;
    const token = props.token;
    const governingTokenMint = props?.governingTokenMint;
    const governingTokenDecimals = props?.governingTokenDecimals || 0;
    
    const memberresultscolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true},
        { field: 'member', headerName: 'Member', width: 170, flex: 1,
            renderCell: (params) => {
                return(
                    <>
                    <ExplorerView showSolanaProfile={true} grapeArtProfile={true} address={params.value.address} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='18px' />
                    {Number(params.value.governingCouncilDepositAmount) > 0 &&
                        <Grid item>
                            <Tooltip title={`Council Member - Votes: ${Number(params.value.governingCouncilDepositAmount)}`}><Button color='inherit' sx={{ml:1,borderRadius:'17px'}}><AssuredWorkloadIcon /></Button></Tooltip>
                        </Grid>
                    }</>
                )
            }
        },
        { field: 'staked', headerName: 'Votes Staked', width: 170, flex: 1, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {getFormattedNumberToLocale(params.value.governingTokenDepositAmount)}
                    </Typography>
                )
            }
        },
        { field: 'unstaked', headerName: 'Not Staked', width: 170, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="caption">
                        {getFormattedNumberToLocale(params.value)}
                    </Typography>
                )
            }
        },
        { field: 'percentDepositedGovernance', headerName: '% of Deposited Governance', width: 170, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {params.value}%
                    </Typography>
                )
            }
        },
        { field: 'percentSupply', headerName: '% of Supply', width: 170, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {params.value}%
                    </Typography>
                )
            }
        },
    ];


    const handleChangePage = (event:any, newPage:number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event:any) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    /*
    const getProposals = async (GOVERNANCE_PROGRAM_ID:string) => {
        if (!loading){
            setLoading(true);
            
        }
        setLoading(false);
    }*/

    const createMemberTableRows = async() => {
        const mmbr = new Array();
        let x = 0;
        for (const member of members){
            mmbr.push({
                id:x+1,
                member:{
                    address: member.governingTokenOwner.toBase58(),
                    governingCouncilDepositAmount:((Number(member.governingCouncilDepositAmount) > 0) ? Number(member.governingCouncilDepositAmount) : 0),
                    },
                staked:
                    {
                        governingTokenDepositAmount:(+((Number(member.governingTokenDepositAmount))/Math.pow(10, governingTokenDecimals || 0)).toFixed(0)),
                        governingCouncilDepositAmount:((Number(member.governingCouncilDepositAmount) > 0) ? Number(member.governingCouncilDepositAmount) : 0),
                    },
                unstaked:Number(member.walletBalanceAmount),
                percentDepositedGovernance:Number(member.governingTokenDepositAmount) > 0 ? ((+Number(member.governingTokenDepositAmount)/totalDepositedVotes)*100).toFixed(2) : 0,
                percentSupply:Number(member.governingTokenDepositAmount) > 0 ? ((Number(member.governingTokenDepositAmount)/circulatingSupply.value.amount)*100).toFixed(2) : 0,
            })
            x++;
        }

        console.log("mmbr: "+JSON.stringify(mmbr))
        setMemberVotingResults(mmbr);
    }

    React.useEffect(() => {
        if (members && !memberVotingResults){
            createMemberTableRows();
        }
    }, [members]);

    if(loading){
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress sx={{borderRadius:'10px;'}} />
            </Box>
        )
    }
    
    return (
        
        <>
            {memberVotingResults &&
                <div style={{ height: 600, width: '100%' }}>
                    <div style={{ display: 'flex', height: '100%' }}>
                        <div style={{ flexGrow: 1 }}>
                                
                                <DataGrid
                                    rows={memberVotingResults}
                                    columns={memberresultscolumns}
                                    pageSize={25}
                                    rowsPerPageOptions={[]}
                                    sx={{
                                        borderRadius:'17px',
                                        borderColor:'rgba(255,255,255,0.25)',
                                        '& .MuiDataGrid-cell':{
                                            borderColor:'rgba(255,255,255,0.25)'
                                        }}}
                                    sortingOrder={['asc', 'desc', null]}
                                    disableSelectionOnClick
                                />
                        </div>
                    </div>
                </div>
            }
        </>
    )
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
    
    const [loading, setLoading] = React.useState(false);
    const connection = RPC_CONNECTION;
    const [realm, setRealm] = React.useState(null);
    const [realmName, setRealmName] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [cachedTimestamp, setCachedTimestamp] = React.useState(null);

    const [totalGovernanceValue, setTotalGovernanceValue] = React.useState(null);
    const [totalGovernanceNftFloorValue, setTotalGovernanceNftFloorValue] = React.useState(null);
    const [totalGovernanceStableCoinValue, setTotalGovernanceStableCoinValue] = React.useState(null);

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

                    setRealmName(glitem.governanceName);

                    setTotalGovernanceValue(glitem?.totalVaultValue);
                    setTotalGovernanceNftFloorValue(glitem?.totalVaultNftValue);
                    setTotalGovernanceStableCoinValue(glitem?.totalVaultStableCoinValue);

                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);
                    setCachedTimestamp(glitem.timestamp);
                }
            }
        }

        
        setCachedGovernance(cached_governance);
        endTimer();
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

    React.useEffect(() => {
        if (governanceLookup){
            getCachedGovernanceFromLookup();
        }
    }, [governanceLookup, governanceAddress]);
    
    React.useEffect(() => { 
        if (tokenMap){  
            startTimer();
            callGovernanceLookup();
        }
    }, [tokenMap]);

    React.useEffect(() => { 
        if (!loading){
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
                                                    size='small'
                                                    sx={{color:'white', borderRadius:'17px'}}
                                                    href={'https://realms.today/dao/'+(governanceAddress)}
                                                    target='blank'
                                                >
                                                    <Typography variant="caption">
                                                    View on Realms <OpenInNewIcon fontSize='inherit'/>
                                                    </Typography>
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
                                <Grid item xs={12} md={6} lg={4} key={1}>
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
                                                        {totalGovernanceValue ? 
                                                        <>${getFormattedNumberToLocale(totalGovernanceValue.toFixed(2))}</>
                                                        :
                                                        <>-</>}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={4} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)'
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>Stable Coin Treasury</>
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

                                <Grid item xs={12} md={6} lg={4} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)'
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>NFT Treasury</>
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
                        
                            <TreeView
                                aria-label="treasury"
                                //defaultExpanded={['2']}
                                //expanded={true}
                                defaultCollapseIcon={<ArrowDropDownIcon />}
                                defaultExpandIcon={<ArrowRightIcon />}
                                defaultEndIcon={<div style={{ width: 24 }} />}
                                sx={{ flexGrow: 1, overflowY: 'auto' }}
                                >

                                {cachedTreasury
                                .sort((a:any,b:any) => (b.solBalance - a.solBalance)  || b.tokens?.value.length - a.tokens?.value.length)
                                .map((item: any,key:number) => (
                                    <>
                                        <StyledTreeItem nodeId={key.toString()} labelText={<>
                                            <ExplorerView address={item.vault.pubkey} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='18px' />
                                            SOL Balance: <strong>{(item.solBalance /(10 ** 9))}</strong>
                                            &nbsp;-&nbsp;
                                            All: <strong>{item?.tokens?.value.length}</strong>
                                            &nbsp;-&nbsp;
                                            Tokens: <strong>{(item?.tokens?.value.length - item?.nfts?.length)}</strong>
                                            &nbsp;-&nbsp;
                                            NFTs: <strong>{item?.nfts?.length}</strong>
                                            </>}> 
                                            
                                            <StyledTreeItem
                                                nodeId={key.toString()+"-1"}
                                                labelText="Sol"
                                                labelIcon={Label}
                                                labelInfo={(item.solBalance /(10 ** 9)).toString()}
                                                color="#1a73e8"
                                                bgColor="#e8f0fe"
                                                />
                                            
                                            {(item?.tokens?.value && item.tokens.value.length > 0) &&
                                                <StyledTreeItem
                                                    nodeId={key.toString()+"-2"}
                                                    labelText="Tokens"
                                                    labelIcon={AccountBalanceIcon}
                                                    labelInfo={(item?.tokens?.value.length - item?.nfts?.length).toString()}
                                                    color="#1a73e8"
                                                    bgColor="#e8f0fe"
                                                >
                                                    
                                                    {(item?.tokens?.value && item.tokens.value.length > 0) &&
                                                    <>
                                                    
                                                        {item.tokens.value
                                                        .sort((a:any,b:any) => (b.account.data.parsed.info.tokenAmount.uiAmountString - a.account.data.parsed.info.tokenAmount.uiAmountString))
                                                        .map((inneritem: any,innerkey:number) => (
                                                            <StyledTreeItem
                                                                nodeId={key.toString()+"-2-"+innerkey.toString()}
                                                                labelText={
                                                                    <>
                                                                        <ExplorerView address={inneritem.account.data.parsed.info.mint} title={tokenMap.get(inneritem.account.data.parsed.info.mint)?.name || inneritem.account.data.parsed.info.mint} useLogo={tokenMap.get(inneritem.account.data.parsed.info.mint)?.logoURI} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' />
                                                                    </>
                                                                }
                                                                labelInfo={<>
                                                                        UI Amount: {getFormattedNumberToLocale(inneritem.account.data.parsed.info.tokenAmount.uiAmountString)}
                                                                        <br/>Token Decimals: {inneritem.account.data.parsed.info.tokenAmount.decimals}
                                                                    </>
                                                                }
                                                                color="#1a73e8"
                                                                bgColor="#e8f0fe"
                                                                />
                                                        ))}
                                                    </>}
                                                </StyledTreeItem>
                                            }
                                            {(item?.nfts && item?.nfts?.length > 0) &&
                                                <StyledTreeItem
                                                    nodeId={key.toString()+"-3"}
                                                    labelText="NFTs"
                                                    labelIcon={ImageIcon}
                                                    labelInfo={item?.nfts?.length}
                                                    color="#1a73e8"
                                                    bgColor="#e8f0fe"
                                                    >
                                                    {item?.nfts &&
                                                    <>
                                                        {item.nfts
                                                        .sort((a:any,b:any) => ((a.floorPriceLamports > b.floorPriceLamports) ? 1 : -1))                                                        
                                                        .map((inneritem: any,innerkey:number) => (
                                                            <StyledTreeItem
                                                                nodeId={key.toString()+"-3-"+innerkey.toString()}
                                                                labelText={
                                                                    <>
                                                                    <ExplorerView address={inneritem.nftMint} title={inneritem.metadataJson.name} type='address' shorten={8} hideTitle={false} showAddress={true} style='text' color='white' fontSize='14px' />
                                                                    
                                                                    </>
                                                                }
                                                                labelInfo={<>
                                                                    {+inneritem.floorPriceLamports > 0 ? <><strong>Floor Price:  {+inneritem.floorPriceLamports/(10 ** 9)} sol</strong><br/></> : ``} {+inneritem.listingCount > 0 && <>Collection Listing Count: {inneritem.listingCount}</>}
                                                                    </>
                                                                }
                                                                color="#1a73e8"
                                                                bgColor="#e8f0fe"
                                                                />
                                                        )).sort((a:any,b:any) => (+a.floorPriceLamports > +b.floorPriceLamports) ? 1 : -1)}
                                                    </>}
                                                </StyledTreeItem>
                                            }
                                        </StyledTreeItem>
                                    </>
                                ))}

                            </TreeView>
                        </Box>
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Cached<br/>
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