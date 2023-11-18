import React from "react";
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { styled, useTheme } from '@mui/material/styles';
// @ts-ignore
import { PublicKey, Connection } from '@solana/web3.js';
import { getMint } from "@solana/spl-token-v2";

import { 
    getRealm,
    getRealms, 
    getTokenOwnerRecordsByOwner,
    getTokenOwnerRecord
} from '@solana/spl-governance';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';

import ExplorerView from '../utils/grapeTools/Explorer';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';

//import GovernanceDetailsView from './GovernanceDetails';
import { TokenAmount } from '../utils/grapeTools/safe-math';
import { useWallet } from '@solana/wallet-adapter-react';

import {
    Button,
    Grid,
    Typography,
    Box,
    LinearProgress,
    Link,
    linearProgressClasses,
  } from '@mui/material';

import { RPC_CONNECTION
} from '../utils/grapeTools/constants';

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 15,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: theme.palette.grey[theme.palette.mode === 'light' ? 200 : 800],
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: theme.palette.mode === 'light' ? '#1a90ff' : '#ffffff',
    },
}));

const governancecolumns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70, hide: true },
    { field: 'pubkey', headerName: 'PublicKey', width: 70, hide: true },
    { field: 'realm', headerName: 'Governance', minWidth: 130, flex: 1, align: 'left' },
    { field: 'governingTokenMint', headerName: 'Governing Mint', width: 150, align: 'center',
        renderCell: (params) => {
            return (
                <ExplorerView address={params.value} type='address' shorten={4} hideTitle={false} style='text' color='white' fontSize='14px' />
            )
        }
    },
    { field: 'governingTokenDepositAmount', headerName: 'Votes (deposited)', width: 130, flex: 1, align: 'right'},
    { field: 'unrelinquishedVotesCount', headerName: '(un)Relinquished', width: 130, align: 'center'},
    { field: 'totalVotesCount', headerName: 'Total Votes', width: 130, align: 'center', hide: true },
    { field: 'details', headerName: '', width: 150,  align: 'center',
        renderCell: (params) => {
            return (
                <>
                    <Button 
                        size='small'
                        variant="contained"
                        color="info"
                        /*
                        component={Link}
                        to={`/dao/${params.value}`}
                        */
                        component='a'
                        href={`/dao/${params.value}`}
                        
                        sx={{borderRadius:'17px'}}
                        
                    >
                        View
                    </Button>
                </>
            )
        }
    },
    { field: 'link', headerName: '', width: 150,  align: 'center', hide: true,
        renderCell: (params) => {
            return (
                <Button
                    variant='outlined'
                    size='small'
                    component='a'
                    href={`https://realms.today/dao/${params.value}`}
                    target='_blank'
                    sx={{borderRadius:'17px'}}
                >Visit</Button>
            )
        }
    },
  ];

export function MyGovernanceView(props: any){
    const { publicKey, wallet } = useWallet();
    const [pubkey, setPubkey] = React.useState(props?.pubkey);;
    const ggoconnection = RPC_CONNECTION;
    const ticonnection = RPC_CONNECTION;
    const txonnection = RPC_CONNECTION;
    const [realms, setRealms] = React.useState(null);
    const [governanceRecord, setGovernanceRecord] = React.useState(null);
    const [governanceRecordRows, setGovernanceRecordRows] = React.useState(null);
    const [loadingGovernance, setLoadingGovernance] = React.useState(false);
    const [selectionGovernanceModel, setSelectionGovernanceModel] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(props?.tokenMap);
    const [loading, setLoading] = React.useState(false);

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tmap = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map())
                setTokenMap(tmap);
                //setTokenArray(tarray);
                return tmap;
            });
        } catch(e){console.log("ERR: "+e)}
    }

    const fetchGovernance = async () => {
        const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
        const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
        
        try{
            //console.log("fetching tor ");
            const tor = await getTokenOwnerRecord(txonnection, new PublicKey(pubkey));
            //console.log("tor "+JSON.stringify(tor));
        }catch(e){
            console.log("ERR: "+e);
        }

        try{
            //console.log("fetching realms ");
            //const rlms = await getRealms(ticonnection, [programId]);
            //console.log("rlms ",rlms);

            //const uTable = rlms.reduce((acc, it) => (acc[it.pubkey.toBase58()] = it, acc), {})
            //setRealms(uTable);
            
            const ownerRecordsbyOwner = await getTokenOwnerRecordsByOwner(ggoconnection, programId, new PublicKey(pubkey));
        
            //console.log("ownerRecordsbyOwner "+JSON.stringify(ownerRecordsbyOwner))
            const governance: any[] = [];
            
            let cnt = 0;
            //console.log("all uTable "+JSON.stringify(uTable))
        
            let vType = null;

            // this method is not correct, migrate to set decimals by an RPC:
            
            
            for (const item of ownerRecordsbyOwner){
                let isCouncil = false;
                //const realm = uTable[item.account.realm.toBase58()];
                const realm = await getRealm(RPC_CONNECTION, item.account.realm)
                //console.log("realm: "+JSON.stringify(realm))
                const name = realm.account.name;
                let votes = item.account.governingTokenDepositAmount.toNumber().toString();
                
                const tokenInfo = await getMint(RPC_CONNECTION, new PublicKey(item.account.governingTokenMint));
                const decimals = tokenInfo?.decimals;
                vType = 'Token';
                
                console.log("item ",item)
                console.log("decimals ",decimals)
                if (decimals){
                    votes = (item.account.governingTokenDepositAmount.toNumber() / 10 ** decimals).toLocaleString();
                    // check if council or community
                    
                    if (realm.account.config?.councilMint && new PublicKey(realm.account.config.councilMint).toBase58() === new PublicKey(item.account.governingTokenMint).toBase58()){
                        votes += " Council";
                        isCouncil = true;
                    } else{
                        votes += "";
                    }
                    console.log("realm: ",realm);

                    /*
                    if (decimals === 0 &&
                        realm.account.config.councilMint !== item.account.governingTokenMint){
                            votes = "NFT"
                    }*/
                } else{
                    //console.log("???")
                    //votes = "NFT";
                    if (votes === "0")
                        votes = "NFT"
                    /*
                    if (realm.account.config?.councilMint?.toBase58() === item?.account?.governingTokenMint?.toBase58()){
                        votes = item.account.governingTokenDepositAmount.toNumber() + ' Council';
                    }else{
                        const thisToken = tokenMap.get(item.account.governingTokenMint.toBase58());
                        if (thisToken){
                            votes = (new TokenAmount(+item.account.governingTokenDepositAmount, thisToken.decimals).format())
                        } else{
                            const btkn = await getBackedTokenMetadata(realm.account?.communityMint.toBase58(), wallet);
                            if (btkn){
                                const parentToken = tokenMap.get(btkn.parentToken).name;
                                const vote_count =  (new TokenAmount(+item.account.governingTokenDepositAmount, btkn.decimals).format());
                                if (+vote_count > 0)
                                    votes = (new TokenAmount(+item.account.governingTokenDepositAmount, btkn.decimals).format());
                                else
                                    votes = parentToken + ' Backed Token';

                            }else{
                                votes = 'NFT';
                            }
                        }
                    } 
                    */
                }
                
                governance.push({
                    id:cnt,
                    pubkey:item.pubkey,
                    realm:name,
                    governingTokenMint:item.account.governingTokenMint.toBase58(),
                    isCouncil:isCouncil,
                    governingTokenDepositAmount:votes,
                    unrelinquishedVotesCount:item.account.unrelinquishedVotesCount,
                    totalVotesCount:item.account.totalVotesCount,
                    details:item.account.realm.toBase58(),
                    link:item.account.realm
                });
                cnt++;
            }
            
            setGovernanceRecord(ownerRecordsbyOwner);
            setGovernanceRecordRows(governance);

        }catch(e){
            console.log("ERR: "+e);
        }
        
    }

    const fetchGovernancePositions = async () => {
        setLoadingGovernance(true);
        await fetchGovernance();
        setLoadingGovernance(false);
    }

    React.useEffect(() => {
        //setLoadingGovernance(true);
        if (pubkey && tokenMap){
            fetchGovernancePositions();
        }
    }, [tokenMap, pubkey]);

    React.useEffect(() => {
        setLoadingGovernance(true);
        if (!pubkey && publicKey){
            setPubkey(publicKey.toBase58());
        }
        if (!tokenMap){
            getTokens();
        }
    }, [publicKey]);

    return(
        <>
            <Box
                sx={{
                    mt:6,
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    overflow: 'hidden',
                    p:4
                }} 
              > 
            <>
                <Grid container>
                    <Grid item xs={12} sm={6} container justifyContent="flex-start">
                        <Grid container>
                            <Grid item xs={12}>
                                <Typography variant="h4">
                                    Profile
                                </Typography>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            
            
                <Box sx={{ p:1}}>
                    {loadingGovernance ?
                        <LinearProgress color="inherit" />
                    :
                        <>
                        {governanceRecord && governanceRecordRows && 
                            <div style={{ height: 600, width: '100%' }}>
                                <div style={{ display: 'flex', height: '100%' }}>
                                    <div style={{ flexGrow: 1 }}>
                                        
                                        <DataGrid
                                            rows={governanceRecordRows}
                                            columns={governancecolumns}
                                            initialState={{
                                                sorting: {
                                                    sortModel: [{ field: 'value', sort: 'desc' }],
                                                },
                                            }}
                                            sx={{
                                                borderRadius:'17px',
                                                borderColor:'rgba(255,255,255,0.25)',
                                                '& .MuiDataGrid-cell':{
                                                    borderColor:'rgba(255,255,255,0.25)'
                                                }}}
                                            pageSize={25}
                                            rowsPerPageOptions={[]}
                                        />
                                        
                                    </div>
                                </div>
                            </div>    
                        }
                        </>
                    }
                    </Box>
                </>
            </Box>
        </>
    );
}