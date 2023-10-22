import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress, 
    createCloseAccountInstruction,
    createBurnInstruction
} from "@solana/spl-token-v2";
import { createBurnNftInstruction } from './BurnNFT';
import * as anchor from '@project-serum/anchor';
//import { getMasterEdition, getMetadata } from '../utils/auctionHouse/helpers/accounts';
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from '@solana/wallet-adapter-react';

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import {
    getHashedName,
    getNameAccountKey,
    NameRegistryState,
    performReverseLookup,
    getTwitterRegistry,
} from '@bonfida/spl-name-service';

import { styled } from '@mui/material/styles';

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
  Checkbox
} from '@mui/material';

import Confetti from 'react-dom-confetti';
import SolIcon from '../../../components/static/SolIcon';
import SolCurrencyIcon from '../../../components/static/SolCurrencyIcon';

import ExplorerView from '../../../utils/grapeTools/Explorer';

import { SelectChangeEvent } from '@mui/material/Select';
import { MakeLinkableAddress, ValidateAddress } from '../../../utils/grapeTools/WalletAddress'; // global key handling
import { useSnackbar } from 'notistack';

//import { withSend } from "@cardinal/token-manager";

import WhatshotIcon from '@mui/icons-material/Whatshot';
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

export default function TokenTransferView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [hasBeenCalled, setHasBeenCalled] = React.useState(false);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAta, setTokenAta] = React.useState(null);
    const [tokenDecimals, setTokenDecimals] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [tokenMaxAmountRaw, setTokenMaxAmountRaw] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    let maxDestinationWalletLen = 20;
    const [destinationWalletArray, setDestinationWalletArray] = React.useState(null);
    const [destinationString, setDestinationString] = React.useState(null);
    const [distributionType, setDistributionType] = React.useState(false);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [burnToken, setBurnToken] = React.useState(false);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    const getMetadata = async (
        mint: anchor.web3.PublicKey,
      ): Promise<anchor.web3.PublicKey> => {
        return (
          await anchor.web3.PublicKey.findProgramAddress(
            [
              Buffer.from('metadata'),
              TOKEN_METADATA_PROGRAM_ID.toBuffer(),
              mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID,
          )
        )[0];
      };
      
      const getMasterEdition = async (
        mint: anchor.web3.PublicKey,
      ): Promise<anchor.web3.PublicKey> => {
        return (
          await anchor.web3.PublicKey.findProgramAddress(
            [
              Buffer.from('metadata'),
              TOKEN_METADATA_PROGRAM_ID.toBuffer(),
              mint.toBuffer(),
              Buffer.from('edition'),
            ],
            TOKEN_METADATA_PROGRAM_ID,
          )
        )[0];
      };

    async function closeTokens() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        //const toWallet = new PublicKey(toAddress);
        const mintPubkey = new PublicKey(tokenMint);
        const amountToSend = +tokenAmount;
        console.log("amountToSend: "+amountToSend)
        const tokenAccount = new PublicKey(mintPubkey);
                
        const transaction = new Transaction();
        const pTransaction = new Transaction();
        let useTokenAta = null;

        if (!tokenAta){
            useTokenAta = await getAssociatedTokenAddress(
                mintPubkey,
                fromWallet,
                true
            );
        } else{
            useTokenAta = new PublicKey(tokenAta);
        }
        const MD_PUBKEY = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
        if (tokenDecimals <= 0){
            const [pda, bump] = await PublicKey.findProgramAddress(
                [Buffer.from('metadata'), MD_PUBKEY.toBuffer(), mintPubkey.toBuffer()],
                MD_PUBKEY
            );

            const masterEdition = await getMasterEdition(mintPubkey)
            const collectionMetadata = await Metadata.fromAccountAddress(connection, pda);
            let collectionMetadataPk = null;

            if (collectionMetadata.data?.creators && collectionMetadata?.collection && collectionMetadata?.collection?.verified)
                collectionMetadataPk = await getMetadata(collectionMetadata.collection.key);
            const accounts = {
                metadata: pda,
                owner: fromWallet,
                mint: mintPubkey,
                tokenAccount: new PublicKey(tokenAta),
                masterEditionAccount: masterEdition,
                splTokenProgram: new PublicKey(TOKEN_PROGRAM_ID),
                collectionMetadata: collectionMetadataPk || null
            }

            console.log("This mint used the Metaplex program and supports full account closing")
            let tti = createBurnNftInstruction(accounts);
            transaction.add(tti);
        } else{

            if (tokenMaxAmountRaw && tokenMaxAmountRaw > 0){
                transaction.add(
                    createBurnInstruction(
                        useTokenAta,
                        mintPubkey,
                        fromWallet,
                        tokenMaxAmountRaw,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                )
            }
            
            transaction.add(
                createCloseAccountInstruction(
                    useTokenAta,
                    fromWallet,
                    fromWallet,
                    [],
                    TOKEN_PROGRAM_ID
                )
            )

        }
        
        setTransactionInstructions(transaction);
        
        return null;
    }

    function TokenSelect() {

        const handleAtaSelected = (event: SelectChangeEvent) => {
            const selectedAta = event.target.value as string;
            //alert("selectedAta: "+selectedAta);
            setTokenAta(selectedAta);
            //const selectedTokenMint = event.target.value as string;
            
            // with token mint traverse to get the mint info if > 0 amount
            let decimals = 0;
            let meta = null;
            {//governanceWallet && governanceWallet.tokens.value
            consolidatedGovernanceWallet && consolidatedGovernanceWallet.tokens.value
                //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                .map((item: any, key: number) => {
                    if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                        item.account.data.parsed.info.tokenAmount.amount > 0) {
                            if (item.pubkey.toBase58() === selectedAta){
                                setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                setTokenMaxAmountRaw(item.account.data.parsed.info.tokenAmount.amount);
                                //setTokenAta(item.pubkey);
                                setTokenMint(item.account.data.parsed.info.mint);
                                setTokenDecimals(item.account.data.parsed.info.tokenAmount.decimals);
                            }
                    } else {
                        if (item.pubkey.toBase58() === selectedAta){
                            setTokenMaxAmount(0);
                            setTokenMaxAmountRaw(0);
                            setTokenMint(item.account.data.parsed.info.mint);
                            setTokenDecimals(item.account.data.parsed.info.tokenAmount.decimals);
                        }
                    }
            })}

            //collectionMetadata = await getMetadata(new PublicKey(holdingsSelected[item * maxLen + holding].metadata_decoded.collection.key));
        };

        function ShowTokenMintInfo(props: any){
            const mintAddress = props.mintAddress;
            const [mintName, setMintName] = React.useState(null);
            const [mintLogo, setMintLogo] = React.useState(null);

            const getTokenMintInfo = async() => {
                    
                    const mint_address = new PublicKey(mintAddress)
                    const [pda, bump] = await PublicKey.findProgramAddress([
                        Buffer.from("metadata"),
                        PROGRAM_ID.toBuffer(),
                        new PublicKey(mint_address).toBuffer(),
                    ], PROGRAM_ID)
                    let tokenMetadata = null;
                    try{
                        tokenMetadata = await Metadata.fromAccountAddress(connection, pda)
                    }catch(e){console.log("ERR: "+e)}
                    
                    if (tokenMetadata?.data?.name)
                        setMintName(tokenMetadata.data.name);
                    
                    if (tokenMetadata?.data?.uri){
                        try{
                            const metadata = await window.fetch(tokenMetadata.data.uri)
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

            React.useEffect(() => { 
                if (mintAddress && !mintName){
                    getTokenMintInfo();
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
                        <>{mintAddress}</>
                    }
                </>
            )

        }
      
        return (
          <>
            <Box sx={{ minWidth: 120, ml:1 }}>
              <FormControl fullWidth sx={{mb:2}}>
                <InputLabel id="governance-token-select-label">Token</InputLabel>
                <Select
                  labelId="governance-token-select-label"
                  id="governance-token-select"
                  value={tokenAta}
                  label="Token"
                  onChange={handleAtaSelected}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 200, // Adjust this value as needed
                        overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                      },
                    },
                  }}
                >
                    {consolidatedGovernanceWallet && consolidatedGovernanceWallet.tokens.value
                            .filter((item: any) => 
                                item.account.data?.parsed?.info?.tokenAmount?.amount >= 0
                            )
                            .sort((a: any, b: any) => 
                                b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
                            )
                            .map((item: any, key: number) => {
                                
                                if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                    item.account.data.parsed.info.tokenAmount.amount >= 0) {
                                
                                    //console.log("mint: "+item.account.data.parsed.info.mint)

                                    return (
                                        <MenuItem key={key} value={item.pubkey?.toBase58() || new PublicKey(item.pubkey)}>
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
                                                        {item.account.data.parsed.info.mint}
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

    function prepareAndReturnInstructions(){

        //await transferTokens;


        let description = "";

        description = `Closing ${tokenAmount.toLocaleString()} ${tokenMint}`;
        
        setInstructionsObject({
            "type":`Close Token Account`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
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
                                gitem.pubkey = titem.pubkey;
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
    
    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings(governanceWallet?.vault.pubkey);
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

    return (
        <Box
            sx={{
                m:2,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:4
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
                            <WhatshotIcon sx={{ fontSize: 40, display: 'flex', alignItems: 'center', color:'yellow'}} />
                        </Grid>
                        <Grid item xs sx={{ml:1, display: 'flex', alignItems: 'center'}}>
                            <strong>Close Token</strong>&nbsp;Plugin
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
            
            {consolidatedGovernanceWallet &&
                <TokenSelect />
            }

            {(tokenMint) ?
                <>  
                    <Box
                        sx={{ m:2,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }}
                    >
                        <Typography variant="h6">Preview/Summary</Typography>
                        <Typography variant="caption">
                            Closing <strong>{tokenMaxAmount.toLocaleString()}</strong> <strong>{tokenMint}</strong><br/>
                            ATA <strong>{tokenAta}</strong>
                        </Typography>
                    </Box>
                
                </>
            :
                <Box
                    sx={{textAlign:'center'}}
                >
                    <Typography variant="caption">Select a token</Typography>
                </Box>
            }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (tokenMint)
                        )
                        }
                        onClick={closeTokens}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}>
                        Preview Instructions</Button>
                </Grid>
                
                {transactionInstructions && 
                    <Box
                        sx={{ m:2,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Close Token Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}