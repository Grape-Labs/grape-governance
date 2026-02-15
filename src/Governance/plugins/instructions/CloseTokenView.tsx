import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress, 
    createCloseAccountInstruction,
    createBurnInstruction,
    getMint,
} from "@solana/spl-token-v2";
import { createBurnNftInstruction } from './BurnNFT';
import * as anchor from '@project-serum/anchor';
//import { getMasterEdition, getMetadata } from '../utils/auctionHouse/helpers/accounts';
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { publicKey as umiPublicKey  } from '@metaplex-foundation/umi'
import { 
    Metadata, 
    TokenRecord, 
    TokenStandard, 
    fetchDigitalAsset, 
    burnV1, 
    MPL_TOKEN_METADATA_PROGRAM_ID, 
    getCreateMetadataAccountV3InstructionDataSerializer 
} from "@metaplex-foundation/mpl-token-metadata";
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults"
import { useWallet } from '@solana/wallet-adapter-react';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';
import { 
    shortenString,
  } from '../../../utils/grapeTools/helpers';

import {
    getHashedName,
    getNameAccountKey,
    NameRegistryState,
    performReverseLookup,
    getTwitterRegistry,
} from '../../../utils/web3/snsCompat';

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
    width: '100%', // Keep full width
    backgroundColor: '#333', // Dark background color
    color: '#fff', // White text for contrast
    border: '1px solid rgba(255, 255, 255, 0.2)', // Add a subtle border for clarity
    padding: theme.spacing(0.5), // Reduce padding for a smaller appearance
    fontSize: '12px', // Smaller font size for compactness
    lineHeight: '1.4', // Adjust line height for tighter spacing
    borderRadius: theme.shape.borderRadius, // Keep consistent border radius
    resize: 'none', // Prevent manual resizing for consistency
    outline: 'none', // Remove focus outline
    boxSizing: 'border-box', // Ensure padding does not affect total width
}));

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export default function TokenTransferView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [governanceRulesWallet, setGovernanceRulesWallet] = React.useState(props?.governanceRulesWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [hasBeenCalled, setHasBeenCalled] = React.useState(false);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.nativeTreasuryAddress?.toBase58() || governanceWallet?.vault?.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAta, setTokenAta] = React.useState(null);
    const [tokenDecimals, setTokenDecimals] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [tokenMap, setTokenMap] = React.useState(props?.tokenMap);
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
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    const [simulationResults, setSimulationResults] = React.useState(null);
    const [burnToken, setBurnToken] = React.useState(false);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    const [availableTokens, setAvailableTokens] = React.useState([
        {
            mint:"So11111111111111111111111111111111111111112",
            name:"SOL",
            symbol:"SOL",
            decimals:9,
            logo:"https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/So11111111111111111111111111111111111111112.png"
        },{
            mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            name:"USDC",
            symbol:"USDC",
            decimals:6,
            logo:"https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png"
        },{
            mint:"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            name:"USDT",
            symbol:"USDT",
            decimals:6,
            logo:"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg"
        },{
            mint:"mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
            name:"mSol",
            symbol:"mSol",
            decimals:9,
            logo:"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png"
        },{
            mint:"8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA",
            name:"GRAPE",
            symbol:"GRAPE",
            decimals:6,
            logo:"https://lh3.googleusercontent.com/y7Wsemw9UVBc9dtjtRfVilnS1cgpDt356PPAjne5NvMXIwWz9_x7WKMPH99teyv8vXDmpZinsJdgiFQ16_OAda1dNcsUxlpw9DyMkUk=s0"
        },{
            mint:"AZsHEMXd36Bj1EMNXhowJajpUXzrKcK57wW4ZGXVa7yR",
            name:"GUAC",
            symbol:"GUAC",
            decimals:5,
            logo:"https://shdw-drive.genesysgo.net/36JhGq9Aa1hBK6aDYM4NyFjR5Waiu9oHrb44j1j8edUt/image.png"
        },{
            mint:"BaoawH9p2J8yUK9r5YXQs3hQwmUJgscACjmTkh8rMwYL",
            name:"ALL",
            symbol:"ALL",
            decimals:6,
            logo:"https://arweave.net/FY7yQGrLCAvKAup_SYEsHDoTRZXsttuYyQjvHTnOrYk"
        },{
            mint:"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
            name:"BONK",
            symbol:"BONK",
            decimals:5,
            logo:"https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I"
        }]);
    
    const objectToken = {};
    availableTokens.forEach(token => {
        objectToken[token.mint] = token;
    }); 

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

      const simulateIx = async (transactionIx: Transaction): Promise<boolean> => {
        try {
            // Fetch the latest blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            
            // Create a VersionedTransaction using the prepared instructions
            const message = new TransactionMessage({
                payerKey: new PublicKey(fromAddress),
                recentBlockhash: blockhash,
                instructions: transactionIx.instructions,
            }).compileToV0Message();
            
            const transaction = new VersionedTransaction(message);
    
            // Simulate the transaction
            const simulationResult = await connection.simulateTransaction(transaction);
            setSimulationResults(simulationResult.value.logs);
            // Analyze the result
            if (simulationResult.value.err) {
                console.error("Simulation failed with error:", simulationResult.value.err);
                console.log("Logs:", simulationResult.value.logs);
                return false; // Indicate failure
            }

            console.log("Simulation successful. Logs:", simulationResult.value.logs);
            return true; // Indicate success
        } catch (error) {
            setSimulationResults(error);
            console.error("Error simulating transaction:", error);
            return false; // Indicate failure due to error
        }
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

            const masterEdition = await getMasterEdition(mintPubkey);

            const umi = createUmi(RPC_CONNECTION);
            const asset = await fetchDigitalAsset(umi, umiPublicKey(mintPubkey.toBase58()));
        
            //const collectionMetadata = await Metadata.fromAccountAddress(connection, pda);
            let collectionMetadataPk = new PublicKey(asset.publicKey);
            
            //if (collectionMetadata.data?.creators && asset.metadata?.collection && asset.metadata. ?.collection?.verified)
            //collectionMetadataPk = await getMetadata(collectionMetadata.collection.key);
            console.log("fromWallet: "+fromWallet.toBase58());

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
            
            
            // try using burnV1
            /*
            await burnV1(umi, {
                umiPublicKey(mintPubkey.toBase58()),
                authority: owner,
                tokenOwner: owner.publicKey,
                collectionMetadata: umiPublicKey(collectionMetadataPk.toBase58()) || null,
                tokenStandard: TokenStandard.NonFungible,
            })*/
            
            transaction.add(tti);

        } else{

            console.log("simple fromWallet: "+fromWallet.toBase58());

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
        
        const status =  await simulateIx(transaction);

        return null;
    }

    function TokenSelect() {
        
        const handleMintSelected = (event: SelectChangeEvent) => {
            //const selectedTokenMint = event.target.value as string;
            // use the ATA not the mint:
            const selectedTokenAta = event.target.value as string;

            //setTokenMint(selectedTokenMint);
            setTokenAta(selectedTokenAta);
            if (pluginType === 4){
                // with token mint traverse to get the mint info if > 0 amount
                {consolidatedGovernanceWallet && consolidatedGovernanceWallet
                    //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                    .map((governanceItem: any, key: number) => {
                        governanceItem.tokens
                            .map((item: any, key: number) => {
                                
                                if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                    item.account.data.parsed.info.tokenAmount.amount > 0) {
                                        //if (item.account.data.parsed.info.mint === selectedTokenMint){
                                        //console.log("Item: "+JSON.stringify(item))
                                        if (new PublicKey(item.pubkey).toBase58() === selectedTokenAta){
                                            //console.log("Found Token: "+item.account.data.parsed.info.mint)
                                            setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                            setTokenMint(item.account.data.parsed.info.mint);
                                        }
                                }
                            })
                        })}
            } else{
                setTokenMaxAmount(governanceWallet.solBalance/10 ** 9)
            }
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
                
                let foundLogo = false;
                let foundName = false;
                if (tokenMap && tokenMap.length > 0){ // check token map
                    let tl = tokenMap.get(mint_address.toBase58())?.logoURI;
                    if (tl){
                        setMintLogo(tl);
                        foundLogo = true;
                        setMintName(tokenMap.get(mint_address.toBase58())?.name);
                        foundName = true;
                    }
                } else {
                    
                    if (objectToken[mint_address.toBase58()]){
                        setMintLogo(objectToken[mint_address.toBase58()].logo);
                        foundLogo = true;
                    }
                }

                if (!foundName && !foundLogo){
                    const umi = createUmi(RPC_CONNECTION);
                    const asset = await fetchDigitalAsset(umi, umiPublicKey(mint_address.toBase58()));
            
                    //console.log("Asset: ",(asset))
            
                    if (asset){
                        if (asset?.metadata?.name)
                            setMintName(asset.metadata.name.trim());
                        if (!foundLogo && asset?.metadata?.uri){
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
                                }else if (tokenMap){ // check token map
                                    let tn = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.name;
                                    setMintName(tn);
                                    let tl = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.logoURI;
                                    setMintLogo(tl);
                                }
                            }catch(err){
                                console.log("ERR: ",err);
                            }
                        }
                    }
                    return asset?.metadata;
                }
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
                {loadingWallet ?
                <>Loading Tokens...</>
                :
                <FormControl fullWidth sx={{mb:2}}>
                    <InputLabel id="governance-token-select-label">{pluginType === 4 ? 'Token' : 'Select'}</InputLabel>
                    <Select
                    labelId="governance-token-select-label"
                    id="governance-token-select"
                    value={tokenAta}
                    label="Token"
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
                        {consolidatedGovernanceWallet && 
                            consolidatedGovernanceWallet.map((governanceItem: any, govKey: number) => (
                                governanceItem.tokens
                                .filter((item: any) => 
                                    // Adjust filter logic if you want to show tokens with zero balance
                                    item?.pubkey && 
                                    item?.account?.data?.parsed?.info?.mint && 
                                    Number(item.account.data?.parsed?.info?.tokenAmount?.amount) > 0
                                )
                                .sort((a: any, b: any) => 
                                    Number(b.account.data?.parsed?.info?.tokenAmount?.amount) - 
                                    Number(a.account.data?.parsed?.info?.tokenAmount?.amount)
                                )
                                .map((item: any) => (
                                    <MenuItem key={`${govKey}-${item.pubkey}`} value={new PublicKey(item.pubkey).toBase58()}>
                                        <Grid container alignItems="center">
                                            <Grid item xs={12}>
                                                <Grid container>
                                                    <Grid item sm={8}>
                                                    <Grid container direction="row" justifyContent="left" alignItems="left">
                                                        {item.account?.tokenMap?.tokenName ? (
                                                        <Grid container direction="row" alignItems="center">
                                                            <Grid item>
                                                            <Avatar 
                                                                alt={item.account?.tokenMap?.tokenName || "Token"} 
                                                                src={item.account?.tokenMap?.tokenLogo && item.account.tokenMap.tokenLogo} 
                                                            />
                                                            </Grid>
                                                            <Grid item sx={{ ml: 1 }}>
                                                            <Typography variant="h6">
                                                                {item.account?.tokenMap?.tokenName || "Token"}
                                                            </Typography>
                                                            </Grid>
                                                        </Grid>
                                                        ) : (
                                                            <>-</>
                                                        )}
                                                    </Grid>
                                                    </Grid>
                                                    <Grid item xs sx={{ textAlign: 'right' }}>
                                                    <Typography variant="h6">
                                                        {(Number(item.account.data.parsed.info.tokenAmount.amount) / 
                                                        10 ** item.account.data.parsed.info.tokenAmount.decimals
                                                        ).toLocaleString()}
                                                    </Typography>
                                                    </Grid>
                                                </Grid>
                                                <Grid item xs={12} sx={{ textAlign: 'center', mt: -1 }}>
                                                    <Typography variant="caption" sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', pt: 1 }}>
                                                    {shortenString(item.account.data.parsed.info.mint, 5, 5)}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                    </MenuItem>
                                ))
                            ))}
                        
                        
                    </Select>
                </FormControl>
                }
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

    const getTokens = async (setTokenMap:any) => {
        const tarray:any[] = [];
        try{
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tmap = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map())
                if (setTokenMap) setTokenMap(tmap);
                return tmap;
            });
    } catch(e){console.log("ERR: "+e)}
    }

    async function fetchWalletHoldings(wallet:string){
        
        if (!tokenMap){
            const tmap = await getTokens(setTokenMap);
            setTokenMap(tmap);
        }

        let solBalance = 0;

        if (wallet === governanceWallet?.vault?.pubkey || wallet === governanceWallet?.nativeTreasuryAddress?.toBase58() || wallet === governanceWallet?.pubkey?.toBase58()){
            
            console.log("wallet: "+wallet);
            if (governanceWallet?.vault?.pubkey)
                solBalance = await connection.getBalance(new PublicKey(governanceWallet.vault.pubkey));
            else
                solBalance = await connection.getBalance(new PublicKey(governanceWallet?.nativeTreasuryAddress));
            //if (governanceWallet?.vault?.pubkey ){
            governanceWallet.solBalance = solBalance;
            setTokenMaxAmount(governanceWallet.solBalance/10 ** 9)
            /*
            } else{
                if (!governanceWallet.solBalance && consolidatedGovernanceWallet?.solBalance){
                    setTokenMaxAmount(consolidatedGovernanceWallet.solBalance)
                } else{
                    console.log("max: "+governanceWallet.solBalance)
                    setTokenMaxAmount(governanceWallet.solBalance)
                }
            }*/
        }
        if (pluginType === 5)
            setTokenMint("So11111111111111111111111111111111111111112");

        console.log("getting parsed tokens: "+wallet);
        const tokenBalance = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(wallet),
            {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            }
        )
        // loop through governanceWallet
        const itemsToAdd = [];

        if (tokenBalance && tokenBalance?.value){
            for (let titem of tokenBalance.value){
                itemsToAdd.push(titem);
                    
                    /*
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
                    }*/
                
            }
        }

        // return a more easy to read object?
        const walletObject = {
            pubkey: wallet,
            solBalance: solBalance,
            tokens: itemsToAdd,
        }
        return walletObject;
    }

    async function getAndUpdateWalletHoldings(){
        try{
            setLoadingWallet(true);
            //console.log("1. governanceWallet: "+JSON.stringify(governanceWallet));
            //console.log("fetching governanceWallet: "+(governanceWallet?.vault?.pubkey || governanceWallet?.pubkey.toBase58()));
            const gwToAdd = await fetchWalletHoldings(governanceWallet?.vault?.pubkey || governanceWallet?.nativeTreasuryAddress?.toBase58());
            //console.log("fetching rules now rules: "+governanceRulesWallet);
            const rwToAdd = await fetchWalletHoldings(governanceRulesWallet);


            // add metadata!
            const getTokenMintInfo = async(mintAddress:string) => {
        
                const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(mintAddress));
        
                //const tokenName = mintInfo.name;
                
                //JSON.stringify(mintInfo);
        
                const decimals = mintInfo.decimals;
                //setMintDecimals(decimals);
                
                const mint_address = new PublicKey(mintAddress)
                
                let logo = null;
                let name = null;
                if (tokenMap && tokenMap.length > 0){ // check token map
                    if (tokenMap.get(mint_address.toBase58())?.logoURI){
                        logo = tokenMap.get(mint_address.toBase58())?.logoURI;
                    }
                    if (tokenMap.get(mint_address.toBase58())?.name)
                        name = tokenMap.get(mint_address.toBase58())?.name;
                } else {
                    if (objectToken[mint_address.toBase58()]){
                        logo = objectToken[mint_address.toBase58()].logo;
                        name = objectToken[mint_address.toBase58()].name;
                    }
                }

                if (!name || !logo){
                    const umi = createUmi(RPC_CONNECTION);
                    const asset = await fetchDigitalAsset(umi, umiPublicKey(mint_address.toBase58()));
            
                    //console.log("Asset: ",(asset))
            
                    if (asset){
                        if (asset?.metadata?.name)
                            name = asset.metadata.name.trim();
                        if (!logo && asset?.metadata?.uri){
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
                                        logo = metadata.image;
                                }else if (tokenMap){ // check token map
                                    let tn = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.name;
                                    name = tn;
                                    let tl = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.logoURI;
                                    logo = tl;
                                }
                            }catch(err){
                                console.log("ERR: ",err);
                            }
                        }
                    }
                }
                return {name:name,logo:logo};
            }
            // Preload metadata for tokens
            const addMetadataToTokens = async (tokens: any[]) => {
                const tokenPromises = tokens.map(async (item: any) => {
                    try{
                        const mintAddress = item.account?.data?.parsed?.info?.mint;
                        if (mintAddress) {
                            const metadata = await getTokenMintInfo(mintAddress);
                            //console.log('found '+JSON.stringify(metadata));
                            item.account.tokenMap = item.account.tokenMap || {};
                            item.account.tokenMap.tokenName = metadata?.name || "Unknown Token";
                            item.account.tokenMap.tokenLogo = metadata?.logo || null;
                        }
                    }catch(e){
                        console.log("ERR: "+e);
                    }
                    return item;
                });
        
                return Promise.all(tokenPromises);
            };

            gwToAdd.tokens = await addMetadataToTokens(gwToAdd.tokens || []);
            rwToAdd.tokens = await addMetadataToTokens(rwToAdd.tokens || []);

            const walletObjects = [gwToAdd, rwToAdd];

            setConsolidatedGovernanceWallet(walletObjects);

            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }
    
    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings();
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

            {loadingWallet ? 
                <>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <Grid 
                            container 
                            alignItems="center" 
                            justifyContent="center" 
                            spacing={1}
                            sx={{ textAlign: 'center' }}
                        >
                            <Grid item>
                            <CircularProgress size="20px" />
                            </Grid>
                            <Grid item>
                            <Typography variant="body1">Loading Tokens...</Typography>
                            </Grid>
                        </Grid>
                    </FormControl>
                </>
            :
            <>
                {consolidatedGovernanceWallet ?
                    <TokenSelect />
                :
                <>-</>
                }
                </>
            
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
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:2
                        }}
                    >
                        <Typography variant="h6">Transaction Instructions</Typography>
                    
                        <CustomTextarea
                            minRows={6}
                            value={JSON.stringify(transactionInstructions, null, 2)}
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

                {simulationResults && 
                    <Box
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:2
                        }}
                    >
                        <Typography variant="h6">Simulation</Typography>
                    
                        <CustomTextarea
                            minRows={6}
                            value={JSON.stringify(simulationResults, null, 2)}
                            readOnly
                        />
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
