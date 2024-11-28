import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress, 
    createCloseAccountInstruction,
    createBurnInstruction,
    getMint,
} from "@solana/spl-token-v2";
import { Buffer } from "buffer";
import BN from "bn.js";
import * as anchor from '@project-serum/anchor';
import { publicKey as umiPublicKey  } from '@metaplex-foundation/umi'
import { Metadata, TokenRecord, fetchDigitalAsset, MPL_TOKEN_METADATA_PROGRAM_ID, getCreateMetadataAccountV3InstructionDataSerializer } from "@metaplex-foundation/mpl-token-metadata";
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults"
import { useWallet } from '@solana/wallet-adapter-react';

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import { styled } from '@mui/material/styles';

import { 
    withDepositGoverningTokens,
    getRealm,
    serializeInstructionToBase64,
  } from '@solana/spl-governance';
import { getGrapeGovernanceProgramVersion } from '../../../utils/grapeTools/helpers';
import {
  Dialog,
  Button,
  ButtonGroup,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  TextareaAutosize,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  MenuItem,
  InputLabel,
  Select,
  IconButton,
  Avatar,
  Grid,
  Paper,
  Typography,
  Box,
  Alert,
  Checkbox,
  SelectChangeEvent
} from '@mui/material';

import { shortenString, parseMintNaturalAmountFromDecimalAsBN } from '../../../utils/grapeTools/helpers';

import ExplorerView from '../../../utils/grapeTools/Explorer';

import JoinLeftIcon from '@mui/icons-material/JoinLeft';
import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CircularProgress from '@mui/material/CircularProgress';
import HelpIcon from '@mui/icons-material/Help';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';
import { number } from 'prop-types';

const confettiConfig = {
    angle: 90,
    spread: 360,
    startVelocity: 40,
    elementCount: 200,
    dragFriction: 0.12,
    duration: 4000,
    stagger: 3,
    width: "10px",
    height: "10px",
    perspective: "285px",
    colors: ["#f00", "#0f0", "#00f"]
};

const CustomTextarea = styled(TextareaAutosize)(({ theme }) => ({
    width: '100%', // Make it full width
    backgroundColor: '#333', // Change the background color to dark
    color: '#fff', // Change the text color to white or another suitable color
    border: 'none', // Remove the border (optional)
    padding: theme.spacing(1), // Add padding (optional)
}));

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export default function IntraDAOJoinView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const setInstructionsObject = props?.setInstructionsObject;
    const governanceLookup = props?.governanceLookup;
    const [governance, setGovernance] = React.useState(null);
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.pubkey?.toBase58() || governanceWallet?.vault?.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [tokenAmountStr, setTokenAmountStr] = React.useState(null);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [tokenMaxAmountRaw, setTokenMaxAmountRaw] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    const [selectedRecord, setSelectedRecord] = React.useState(null);
    const [daoToJoinAddress, setDaoToJoinAddress] = React.useState(null);
    const [daoToJoinAddressStr, setDaoToJoinAddressStr] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    async function joinDAO() {
        setLoadingInstructions(true);
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        const toJoinPk = new PublicKey(daoToJoinAddress);
        const withMint = new PublicKey(tokenMint);    
        const transaction = new Transaction();
        
        // we need to fetch the governance details either her or a step before
        
        const programId = governance.owner;
        console.log("programId: "+JSON.stringify(programId));
        const realmPk = new PublicKey(governance.pubkey);
        const programVersion = await getGrapeGovernanceProgramVersion(
            connection,
            programId,
            realmPk
          )
        
        console.log("programVersion: "+JSON.stringify(programVersion));

        
        
        const tokenInfo = await getMint(RPC_CONNECTION, withMint);
        
        const userAtaPk = await getAssociatedTokenAddress(
            withMint,
            fromWallet, // owner
            true
          )

        // Extract the mint authority
        const mintAuthority = tokenInfo.mintAuthority ? new PublicKey(tokenInfo.mintAuthority) : null;
        const decimals = tokenInfo.decimals;

        //console.log("mintAuthority: "+mintAuthority.toBase58());
        console.log("tokenAmount: "+tokenAmount);
        console.log("decimals: "+decimals);
        
        const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
            tokenAmount,
            decimals
        )
        console.log("fromWallet: "+fromWallet.toBase58());

        const instructions: TransactionInstruction[] = []
        /*
        console.log("realm: "+realmPk.toBase58())
        console.log("governingTokenSource / userAtaPk: "+userAtaPk.toBase58())
        console.log("governingTokenMint: "+communityMint.toBase58())
        console.log("governingTokenOwner: "+fromWallet.toBase58())
        console.log("governingTokenSourceAuthority: "+mintAuthority?.toBase58())
        console.log("payer: "+fromWallet.toBase58())
        console.log("amount: "+atomicAmount);
        */
        await withDepositGoverningTokens(
            instructions,
            programId,
            programVersion,
            realmPk,
            userAtaPk,
            withMint,
            fromWallet,
            fromWallet,
            fromWallet,
            atomicAmount
        )
        
        if (instructions.length != 1) {
            console.log("ERROR: Something went wrong");
        } else{

            if (instructions){

                const transaction = new Transaction();
                transaction.add(...instructions);

                console.log("TX: "+JSON.stringify(transaction));
                setTransactionInstructions(transaction);
            } else{
                console.log("No instructions!");
            }
        }
        
        setLoadingInstructions(false);
        return null;
    }

    
    function prepareAndReturnInstructions(){

        //await transferTokens;

        let description = "";

        description = `Joining DAO with ${tokenMint} using ${tokenAmount.toLocaleString()} Governance Power`;
        
        setInstructionsObject({
            "type":`Join DAO`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
    }

    function isValidSolanaPublicKey(publicKeyString:string) {
        // Regular expression for Solana public key validation
        //const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        //return solanaPublicKeyRegex.test(publicKey);
        if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
            return false;
          }
        
          // Regular expression for Solana public key validation
          const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        
          // Check if the publicKey matches the Solana public key pattern
          return solanaPublicKeyRegex.test(publicKeyString);
    }

    function handleSetDaoToJoinAddressChange(text:string){
        // add validation here
        console.log("checking: "+text);
        setDaoToJoinAddressStr(text);
        if (isValidSolanaPublicKey(text)){
            console.log("setDaoToJoinAddress complete!");
            setDaoToJoinAddress(text);
        } else{
            setDaoToJoinAddress(null);
        }
    }

    async function getAndUpdateWalletHoldings(wallet:string){
        try{
            setLoadingWallet(true);
            const solBalance = await connection.getBalance(new PublicKey(wallet));

            const tokenBalance = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(wallet),
                {
                programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                }
            )
            // loop through governanceWallet
            governanceWallet.solBalance = solBalance;
            const itemsToAdd = [];

            console.log("governanceWallet "+JSON.stringify(governanceWallet));
            if (tokenBalance?.value){
                for (let titem of tokenBalance?.value){
                    if (governanceWallet.tokens.value){
                        let foundCached = false;
                        for (let gitem of governanceWallet.tokens.value){
                            if (titem.pubkey.toBase58() === gitem.pubkey){
                                foundCached = true;
                                gitem.account.data.parsed.info.tokenAmount.amount = titem.account.data.parsed.info.tokenAmount.amount;
                                gitem.account.data.parsed.info.tokenAmount.uiAmount = titem.account.data.parsed.info.tokenAmount.uiAmount;
                                itemsToAdd.push(gitem);
                            }
                        }
                        if (!foundCached) {
                            itemsToAdd.push(titem);
                        }
                    }
                }
            }

            governanceWallet.tokens.value = itemsToAdd;//[...governanceWallet.tokens.value, ...itemsToAdd];
            setConsolidatedGovernanceWallet(governanceWallet);
            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }

    async function fetchGovernanceSpecifications(address:string){
        console.log("fetching specs");
        const rlm = await getRealm(RPC_CONNECTION, new PublicKey(address || daoToJoinAddress));
        if (rlm){
            console.log("realm: "+JSON.stringify(rlm));
            setGovernance(rlm);
        }
    }

    function TokenSelect(props:any) {
        const filter = props.filter;

        const handleMintSelected = (event: SelectChangeEvent) => {
            const selectedTokenMint = event.target.value as string;
            setTokenMint(selectedTokenMint);

            
            // with token mint traverse to get the mint info if > 0 amount
            {governanceWallet && governanceWallet.tokens.value
                //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                .map((item: any, key: number) => {
                    if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                        item.account.data.parsed.info.tokenAmount.amount > 0) {
                            if (item.account.data.parsed.info.mint === selectedTokenMint){
                                setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                setTokenAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                            }
                    }
            })}
            
        };

        function ShowTokenMintInfo(props: any){
            const mintAddress = props.mintAddress;
            const [mintName, setMintName] = React.useState(null);
            const [mintLogo, setMintLogo] = React.useState(null);

            const getTokenMintInfo = async(mintAddress:string) => {
        
                const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(mintAddress));
        
                //const tokenName = mintInfo.name;
                
                //JSON.stringify(mintInfo);
        
                const decimals = mintInfo.decimals;
                //setMintDecimals(decimals);
                
                const mint_address = new PublicKey(mintAddress)
                
                const umi = createUmi(RPC_CONNECTION);
                const asset = await fetchDigitalAsset(umi, umiPublicKey(mint_address.toBase58()));
        
                //console.log("Asset: ",(asset))
        
                if (asset){
                    if (asset?.metadata?.name)
                        setMintName(asset.metadata.name.trim());
                    if (asset?.metadata?.uri){
                        try{
                            const metadata = await window.fetch(asset.metadata.uri)
                            .then(
                                (res: any) => res.json())
                            .catch((error) => {
                                // Handle any errors that occur during the fetch or parsing JSON
                                console.error("Error fetching data:", error);
                            });
                            
                            if (metadata && metadata?.image){
                                if (metadata.image)
                                    setMintLogo(metadata.image);
                            }
                        }catch(err){
                            console.log("ERR: ",err);
                        }
                    }
                }
        
                return asset?.metadata;
            }

            React.useEffect(() => { 
                if (mintAddress && !mintName){
                    getTokenMintInfo(mintAddress);
                }
            }, [mintAddress]);

            return ( 
                <>

                    {mintName ?
                        <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                            <Grid item>
                                <Avatar alt={mintName} src={mintLogo} />
                            </Grid>
                            <Grid item sx={{ml:1}}>
                                <Typography variant="h6">
                                {mintName}
                                </Typography>
                            </Grid>
                        </Grid>       
                    :
                        <>{shortenString(mintAddress,5,5)}</>
                    }
                </>
            )

        }
      
        return (
          <>
            <Box sx={{ minWidth: 120, ml:1 }}>
              <FormControl fullWidth sx={{mb:2}}>
                <InputLabel id="governance-token-select-label">Select Token</InputLabel>
                <Select
                  labelId="governance-token-select-label"
                  id="governance-token-select"
                  value={tokenMint}
                  label="Select Token"
                  onChange={handleMintSelected}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 200, // Adjust this value as needed
                        overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                      },
                    },
                  }}
                >
                    {governanceWallet && governanceWallet.tokens.value
                    // ? item.account.data.parsed.info.mint === filter
                            .filter((item: any) => 
                                item.account.data?.parsed?.info?.tokenAmount?.amount > 0
                            )
                            .sort((a: any, b: any) => 
                                b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
                            )
                            .map((item: any, key: number) => {
                                
                                if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                    item.account.data.parsed.info.tokenAmount.amount > 0 &&
                                    (item.account.data.parsed.info.mint === filter[0] || item.account.data.parsed.info.mint === filter[1])) {
                                
                                    //console.log("mint: "+item.account.data.parsed.info.mint)

                                    return (
                                        <MenuItem key={key} value={item.account.data.parsed.info.mint}>
                                            {/*console.log("wallet: "+JSON.stringify(item))*/}
                                            
                                            <Grid container
                                                alignItems="center"
                                            >
                                                <Grid item xs={12}>
                                                <Grid container>
                                                    <Grid item sm={8}>
                                                    <Grid
                                                        container
                                                        direction="row"
                                                        justifyContent="left"
                                                        alignItems="left"
                                                    >

                                                        {item.account?.tokenMap?.tokenName ?
                                                            <Grid 
                                                                container
                                                                direction="row"
                                                                alignItems="center"
                                                            >
                                                                <Grid item>
                                                                    <Avatar alt={item.account.tokenMap.tokenName} src={item.account.tokenMap.tokenLogo} />
                                                                </Grid>
                                                                <Grid item sx={{ml:1}}>
                                                                    <Typography variant="h6">
                                                                    {item.account.tokenMap.tokenName}
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>
                                                        :
                                                            <>
                                                                <ShowTokenMintInfo mintAddress={item.account.data.parsed.info.mint} />
                                                            </>
                                                        }
                                                    </Grid>
                                                    </Grid>
                                                    <Grid item xs sx={{textAlign:'right'}}>
                                                    <Typography variant="h6">
                                                        {/*item.vault?.nativeTreasury?.solBalance/(10 ** 9)*/}

                                                        {(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals).toLocaleString()}
                                                    </Typography>
                                                    </Grid>
                                                </Grid>  

                                                <Grid item xs={12} sx={{textAlign:'center',mt:-1}}>
                                                    <Typography variant="caption" sx={{borderTop:'1px solid rgba(255,255,255,0.05)',pt:1}}>
                                                        {shortenString(item.account.data.parsed.info.mint,5,5)}
                                                    </Typography>
                                                </Grid>
                                                </Grid>
                                            </Grid>
                                        </MenuItem>
                                    );
                                } else {
                                    return null; // Don't render anything for items without nativeTreasuryAddress
                                }
                            })}
                    
                </Select>
              </FormControl>
            </Box>
          </>
        );
      }
    
    function handleTokenAmountChange(text:string){
        const cleanedText = text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, '$1');
        //console.log("HERE: "+text)
        setTokenAmountStr(cleanedText);
        setTokenAmount(parseFloat(cleanedText))
        
        //setTokenAmountStr(text);
    }
    React.useEffect(() => {
        if (tokenAmount){
            //const cleanedText = tokenAmountStr.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, '$1');
            setTokenAmountStr(tokenAmount);
            setTokenAmount(tokenAmount)
            
        }
    },[tokenAmount]);
    

    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings(governanceWallet?.vault?.pubkey || governanceWallet?.pubkey);
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

    React.useEffect(() => {
        if (daoToJoinAddress){
            fetchGovernanceSpecifications(null);
        }
    }, [daoToJoinAddress]);

    return (
        <Box
            sx={{
                m:1,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:1
            }} 
        >
            <Box
                sx={{mb:4}}
            >
                <Typography variant="h5">
                    <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                        <Grid item>
                            <JoinLeftIcon sx={{ fontSize: 50, display: 'flex', alignItems: 'center' }} />
                        </Grid>
                        <Grid item xs sx={{ml:1, display: 'flex', alignItems: 'center'}}>
                            <strong>Join DAO</strong>&nbsp;Plugin
                        </Grid>
                    </Grid>
                </Typography>
            </Box>

            {/*
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField 
                    fullWidth 
                    label="From Governance Wallet" 
                    id="fullWidth"
                    value={fromAddress}
                    type="text"
                    onChange={(e) => {
                    //    setFromAddress(e.target.value);
                    }}
                    disabled
                    sx={{borderRadius:'17px'}} 
                />
            </FormControl>
            */}
            
            <FormControl fullWidth  sx={{mb:2}}>
                
                <TextField 
                    fullWidth 
                    label="DAO Address" 
                    id="fullWidth"
                    type="text"
                    onChange={(e) => {
                        handleSetDaoToJoinAddressChange(e.target.value);
                        
                    }}
                    inputProps={{
                        style: { textAlign: 'center' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                {(!daoToJoinAddress && (daoToJoinAddressStr && daoToJoinAddressStr.length > 0)) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: Invalid DAO address!</Typography>
                    </Grid>
                : 
                    <>{governance ?
                            <>
                                 <Box
                                    sx={{ m:2,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:4
                                    }}
                                >
                                    <Grid sx={{textAlign:'right',}}>
                                        <Typography variant="h6">{governance.account.name}<br/></Typography>
                                        <Typography variant="caption" color="success">
                                            
                                            Community Mint: <ExplorerView
                                                                address={governance.account.communityMint.toBase58()} type='address'
                                                                shorten={8}
                                                                hideTitle={false} style='text' color='white' fontSize='12px'/>
                                            
                                            {governance.account.config.councilMint &&
                                                <>
                                                Council Mint: <ExplorerView
                                                                address={governance.account.config.councilMint.toBase58()} type='address'
                                                                shorten={8}
                                                                hideTitle={false} style='text' color='white' fontSize='12px'/>
                                                </>
                                            }
                                        </Typography>
                                    </Grid>
                                </Box>
                            </>
                        :
                            <></>
                    }
                    </>
                }
            </FormControl>

            <FormControl fullWidth  sx={{mb:2}}>
                {/*
                <TextField 
                    fullWidth 
                    label="DAO Address" 
                    id="fullWidth"
                    type="text"
                    onChange={(e) => {
                        handleDestinationAddressChange(e.target.value);
                        
                    }}
                    inputProps={{
                        style: { textAlign: 'center' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                {(!destinationAddress) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: Invalid DAO address!</Typography>
                    </Grid>
                : <></>
                }*/}
                
            </FormControl>
            
            {(daoToJoinAddress && governance) &&
                <>

                    <TokenSelect filter={[governance.account.communityMint.toBase58(), governance.account.config.councilMint ? governance.account.config.councilMint.toBase58() : '']} /> 
                    {/*
                    [{governance.account.communityMint.toBase58()}, governance.account.config.councilMint ? governance.account.config.councilMint : ''] }/>
                    */}

                    {tokenMint &&
                        <FormControl fullWidth sx={{mb:2}}>

                            <RegexTextField
                                regex={/[^0-9]+\.?[^0-9]/gi}
                                autoFocus
                                autoComplete='off'
                                margin="dense"
                                id="amount_to_deposit"
                                label='Select Amount to Deposit'
                                type="text"
                                fullWidth
                                variant="standard"
                                value={tokenAmountStr}
                                //value={(tokenAmountStr.length > 0 && tokenAmount > 0) ? tokenAmount : tokenAmountStr.length > 0 ? tokenAmountStr : ''}
                                default={tokenMaxAmount}
                                onChange={(e:any) => {
                                    handleTokenAmountChange(e.target.value);
                                }}
                                inputProps={{
                                    style: { 
                                        textAlign:'center', 
                                        fontSize: '34px'
                                    }
                                }}
                            />
                            <Grid sx={{textAlign:'right',}}>
                                <Typography variant="caption" color="info">
                                    <Button
                                        variant="text"
                                        size="small"
                                        onClick={(e) => setTokenAmount(tokenMaxAmount)}
                                    >
                                        Max
                                    </Button>
                                </Typography>
                            </Grid>
                        </FormControl>
                    }
                </>
            }

            {(daoToJoinAddress && tokenMint && tokenAmount) ?
                <>  
                    <Box
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
                        }}
                    >
                        <Typography variant="h6">Preview/Summary</Typography>
                        <Typography variant="caption">
                            DAO to Join <strong>{daoToJoinAddress}</strong><br/>
                            Using Mint: <strong>{tokenMint}</strong><br/>
                            With <strong>{tokenAmount}</strong> Tokens<br/>
                        </Typography>
                    </Box>
                
                </>
            :
                <Box
                    sx={{textAlign:'center'}}
                >
                    <Typography variant="caption">Enter a valid DAO address, select the token</Typography>
                </Box>
            }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (daoToJoinAddress) &&
                            ((tokenAmount > 0) &&
                            (tokenAmount <= tokenMaxAmount)) && !loadingInstructions
                        )
                        }
                        onClick={joinDAO}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}
                        >
                            {loadingInstructions ? 
                                <><CircularProgress sx={{padding:'10px'}} /> Preparing Instructions</>
                                :
                                <>
                                Preview Instructions</>
                            }</Button>
                </Grid>
                
                {transactionInstructions && 
                    <Box
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
                        }}
                    >
                        <Typography variant="h6">Transaction Instructions</Typography>
                    
                        <CustomTextarea
                            minRows={6}
                            value={JSON.stringify(transactionInstructions)}
                            readOnly
                        /><br/>
                        {/*
                        <TextField 
                            fullWidth
                            label="Instructions"
                            multiline
                            rows={4}
                            maxRows={4}
                            value={JSON.stringify(transactionInstructions)}
                            disabled
                        />*/}

                        {transactionEstimatedFee &&
                            <Grid sx={{textAlign:'right'}}>
                                <Typography variant="caption">
                                    Estimated Fee {transactionEstimatedFee}
                                </Typography>
                            </Grid>
                        }
                    </Box>

                }

            <Grid sx={{textAlign:'right'}}>
            <Button 
                disabled={!(
                    (transactionInstructions && JSON.stringify(transactionInstructions).length > 0)
                )}
                onClick={prepareAndReturnInstructions}
                fullWidth
                variant="contained"
                color="warning"
                sx={{borderRadius:'17px'}}>
                Add to Proposal</Button>
            </Grid>

            
            <Box
                sx={{mt:4,textAlign:'center'}}
            >
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Join DAO Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}