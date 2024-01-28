import * as React from 'react';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import axios from "axios";
import { styled } from '@mui/material/styles';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import { red } from '@mui/material/colors';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../utils/grapeTools/constants';

import { 
    shortenString,
    isGated,
    findObjectByGoverningTokenOwner,
    convertSecondsToLegibleFormat,
    getJupiterPrices,
  } from '../../utils/grapeTools/helpers';

import {
    Typography,
    Card,
    CardHeader,
    CardMedia,
    CardContent,
    CardActions,
    Collapse,
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
    Tooltip,
    CircularProgress,
    LinearProgress,
    Menu,
    MenuItem,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Skeleton,
    Badge,
    Divider,
    Chip,
  } from '@mui/material/';

  import GridViewIcon from '@mui/icons-material/GridView';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

export default function WalletCardView(props:any) {
    const [expanded, setExpanded] = React.useState(false);
    const [expandedNft, setExpandedNft] = React.useState(false);
    const walletAddress = props?.walletAddress;
    const rulesWalletAddress = props?.rulesWalletAddress;
    const tokenMap = props?.tokenMap;
    const shortWalletAddress = shortenString(walletAddress,5,5);
    const shortRulesWalletAddress = shortenString(rulesWalletAddress,5,5);
    const [nativeSol, setNativeSol] = React.useState(null);
    const [rulesSol, setRulesSol] = React.useState(null);
    const [nativeTokens, setNativeTokens] = React.useState(null);
    const [rulesTokens, setRulesTokens] = React.useState(null);
    const [nativeNftTokens, setNativeNftTokens] = React.useState(null);
    const [rulesNftTokens, setRulesNftTokens] = React.useState(null);
    const [tokenMintArray, setTokenMintArray] = React.useState(null);
    const [usdcValue, setUsdcValue] = React.useState(null);
    const [nativeDomains, setNativeDomains] = React.useState(null);
    const [rulesDomains, setRulesDomains] = React.useState(null);
    const [totalWalletValue, setTotalWalletValue] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [loadingPrices, setLoadingPrices] = React.useState(false);
    
    function SettingsMenu() {
        const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
        const open = Boolean(anchorEl);
        const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
          setAnchorEl(event.currentTarget);
        };
        const handleClose = () => {
          setAnchorEl(null);
        };
      
        return (
          <div>
            <IconButton
              id="basic-button"
              aria-controls={open ? 'basic-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
              onClick={handleClick}
            >
                <MoreVertIcon />
            </IconButton>
            <Menu
              id="basic-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              MenuListProps={{
                'aria-labelledby': 'basic-button',
              }}
            >
              <MenuItem onClick={handleClose}>Rules Wallet {shortRulesWalletAddress}</MenuItem>
            </Menu>
          </div>
        );
      }

      const getWalletNftBalance = async(tokenOwnerRecord: PublicKey) => {

        if (SHYFT_KEY) {
            try{
                const uri = `https://rpc.shyft.to/?api_key=${SHYFT_KEY}`;
    
                const response = await fetch(uri, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'rpc-id',
                        method: 'getAssetsByOwner',
                        params: {
                            ownerAddress: tokenOwnerRecord.toBase58(),
                            page: 1, // Starts at 1
                            limit: 1000
                        },
                    }),
                    });
                const { result } = await response.json();
                //dasMeta = result.items;
                return result?.items;
                /*
                console.log("Assets owned by a wallet: ", result.items);
                */
            } catch(err){
                console.log("DAS: Err");
                return null;
            }
        }
    }

    const getWalletValue = async() => {
        setLoadingPrices(true);
        const cgp = await getJupiterPrices(tokenMintArray);

        //const solToUsd = cgp['So11111111111111111111111111111111111111112'].price;
        //const solUsdValue = (ia.solBalance > 0 ? cgp['So11111111111111111111111111111111111111112'].price*(ia.solBalance/(10 ** 9)) : 0);

        setUsdcValue(cgp);

        setLoadingPrices(false);
    }
    
    const getWalletAllTokenBalance = async(tokenOwnerRecord: PublicKey) => {
    
        const uri = `https://api.shyft.to/sol/v1/wallet/all_tokens?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
    
        return axios.get(uri, {
            headers: {
                'x-api-key': SHYFT_KEY
            }
            })
            .then(response => {
                if (response.data?.result){
                    return response.data.result;
                }
                return null
            })
            .catch(error => 
                {   
                    // revert to RPC
                    console.error(error);
                    return null;
                });
    }
    
    const getWalletBalance = async(tokenOwnerRecord: PublicKey) => {
        
        const uri = `https://api.shyft.to/sol/v1/wallet/balance?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
        
        return axios.get(uri, {
                headers: {
                    'x-api-key': SHYFT_KEY
                }
                })
            .then(response => {
                if (response.data?.result){
                    console.log("balance for "+tokenOwnerRecord.toBase58()+": "+response.data.result?.balance)
                    return response.data.result?.balance;
                }
                return null
            })
            .catch(error => 
                {   
                    // revert to RPC
                    console.error(error);
                    return null;
                });
    }

    const getWalletDomains = async(tokenOwnerRecord: PublicKey) => {
        
        const uri = `https://api.shyft.to/sol/v1/wallet/get_domains?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
        
        return axios.get(uri, {
                headers: {
                    'x-api-key': SHYFT_KEY
                }
                })
            .then(response => {
                if (response.data?.result){
                    return response.data.result;
                }
                return null
            })
            .catch(error => 
                {   
                    // revert to RPC
                    console.error(error);
                    return null;
                });
    }

    const getWalletBalances = async() =>{
        setLoading(true);
        // get total sol
        const sol1 = await getWalletBalance(new PublicKey(walletAddress));
        const sol2 = await getWalletBalance(new PublicKey(rulesWalletAddress));
        
        // get total tokens
        const token1 = await getWalletAllTokenBalance(new PublicKey(walletAddress));
        const token2 = await getWalletAllTokenBalance(new PublicKey(rulesWalletAddress));
        // consolidate tokens?
        const tArray = ["So11111111111111111111111111111111111111112"];
        
        token1 && token1
            .map((item: any,key:number) => ( 
                tArray.push(item.address)
        ));
        token2 && token2
            .map((item: any,key:number) => ( 
                tArray.push(item.address)
        ));
        setTokenMintArray(tArray);
        
        
        // get nft balance
        const nft1 = await getWalletNftBalance(new PublicKey(walletAddress));
        const nft2 = await getWalletNftBalance(new PublicKey(rulesWalletAddress));

        // get domains
        const domains1 = await getWalletDomains(new PublicKey(walletAddress));
        const domains2 = await getWalletDomains(new PublicKey(rulesWalletAddress));

        // put to unified array
        setNativeSol(sol1);
        setRulesSol(sol2);

        setNativeTokens(token1);
        setRulesTokens(token2);

        setNativeNftTokens(nft1);
        setRulesNftTokens(nft2);

        setNativeDomains(domains1);
        setRulesDomains(domains2);

        // unify tokens?
        // think of how we can display them unified if needed
        setLoading(false);
    }


    React.useEffect(() => { 
        
        if (usdcValue && 
            (nativeSol && nativeSol > 0 || rulesSol && rulesSol > 0) &&
            (nativeTokens && rulesTokens)){
            let totalVal = 0;
            //alert(usdcValue['So11111111111111111111111111111111111111112'].price + " " +(+nativeSol + +rulesSol));
            totalVal += usdcValue['So11111111111111111111111111111111111111112'].price*(+nativeSol + +rulesSol);
            if (nativeTokens){
                for (let item of nativeTokens){
                    if (usdcValue[item.address]){
                        totalVal += usdcValue[item.address].price * item.balance;
                    }

                }
            }
            if (rulesTokens){
                for (let item of rulesTokens){
                    if (usdcValue[item.address]){
                        totalVal += usdcValue[item.address].price * item.balance;
                    }

                }
            }
            setTotalWalletValue(totalVal);
        }
    }, [usdcValue, nativeSol, rulesSol, nativeTokens, rulesTokens]);


    React.useEffect(() => { 
        if (tokenMintArray && tokenMintArray.length > 0){
            getWalletValue();
        }
    }, [tokenMintArray]);

    React.useEffect(() => { 
        if (walletAddress && rulesWalletAddress){
            getWalletBalances();
        }
    }, [walletAddress, rulesWalletAddress]);

    const handleExpandClick = () => {
        setExpanded(!expanded);
    };

    const handleExpandNftClick = () => {
        setExpandedNft(!expandedNft);
    }

    return (
        <Card>
        <CardHeader
            avatar={
                <Avatar sx={{ bgcolor: red[500] }} aria-label={walletAddress.substring(0,1)}>
                    {walletAddress.substring(0,1)}
                </Avatar>
            }
            action={
                <SettingsMenu/>
            }
            title={shortWalletAddress}
            subheader={
                (nativeDomains && nativeDomains.length > 0) &&
                    <>{nativeDomains[0].name}</>    
            }
        />
        <Grid container
            sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}}
        > 
            <Grid xs={12} sx={{display: 'flex', justifyContent: 'center'}}>
                {(loading || loadingPrices) ?
                    <Skeleton variant="rounded" width={100} height={40} sx={{m:4}} />
                :
                    <h2>${
                        totalWalletValue &&
                        (+totalWalletValue.toFixed(2)).toLocaleString()
                    }</h2>

                    
                }
                
            </Grid>
            <Grid xs={6} >
                <Button size="large" variant="contained" disabled>Receive</Button>
            </Grid>
            <Grid xs={6}>
                <Button size="large" variant="contained" disabled>Send</Button>
            </Grid>

        </Grid>
        <CardContent>
            <Typography variant="body2" color="text.secondary">
                <List sx={{ width: '100%' }}>

                    {(loading || loadingPrices) ?
                        <Skeleton variant="rounded" width={'100%'} height={50} />
                    :
                    
                    <ListItem
                        secondaryAction={
                            <Box sx={{textAlign:'right'}}>
                                <Typography variant="subtitle1" sx={{color:'white'}}>
                                    {(nativeSol && rulesSol) &&
                                        <>
                                        {(nativeSol+rulesSol).toFixed(6)}
                                        </>
                                    }
                                </Typography>
                                <Typography variant="caption" sx={{color:'#919EAB'}}>
                                {usdcValue ? 
                                    <>{usdcValue['So11111111111111111111111111111111111111112'] ? 
                                        <>${Number(((nativeSol+rulesSol) * usdcValue['So11111111111111111111111111111111111111112']?.price).toFixed(2)).toLocaleString()}</>
                                        :<></>
                                    }</>
                                :<></>}</Typography>
                            </Box>
                        }
                    >
                        <ListItemAvatar>
                            <Avatar
                                src='https://solana-cdn.com/cdn-cgi/image/width=100/https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png'
                            >
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                            primary={<Typography variant="subtitle1" sx={{color:'white'}}>Solana</Typography>} 
                            secondary={<Typography variant="caption">{usdcValue && `$${usdcValue['So11111111111111111111111111111111111111112'].price.toFixed(2)}`}</Typography>}
                            />
                    </ListItem>
                    }
                </List>
                
                
            </Typography>
        </CardContent>
        <CardActions disableSpacing>
            <IconButton aria-label="share">
                <ShareIcon />
            </IconButton>
            {nativeNftTokens && nativeNftTokens.length > 0 &&
                <Tooltip title="Show NFTs">
                    <Badge color="primary" badgeContent={nativeNftTokens.length} max={999}>
                        <IconButton 
                            //expand={expandedNft}
                            onClick={handleExpandNftClick}
                            aria-expanded={expandedNft}
                            aria-label="Show NFTs"
                        >
                            <GridViewIcon />
                        </IconButton>
                    </Badge>
                </Tooltip>
            }
            <Grid container justifyContent={'right'} sx={{mr:1}}>
                {nativeTokens && nativeTokens.length > 0 &&
                <>
                    <Tooltip title="Show Tokens">
                        <Badge color="primary" badgeContent={nativeTokens.length + +rulesTokens?.length} max={999}>
                            <ExpandMore
                                expand={expanded}
                                onClick={handleExpandClick}
                                aria-expanded={expanded}
                                aria-label="Show Tokens"
                                >
                                    <ExpandMoreIcon />
                            </ExpandMore>
                        </Badge>
                    </Tooltip>
                </>
                }
            </Grid>
        </CardActions>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
            {(loading || loadingPrices) ?
                <Skeleton variant="rounded" width={'100%'} height={50} />
            :
                <CardContent>
                    {nativeTokens && nativeTokens
                        .sort((a:any,b:any) => (b.balance - a.balance)  || b.tokens?.value.length - a.tokens?.value.length)
                        .map((item: any,key:number) => (   
                            <ListItem
                                secondaryAction={
                                    <Box sx={{textAlign:'right'}}>
                                        <Typography variant="subtitle1" sx={{color:'white'}}>
                                            {item.balance.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" sx={{color:'#919EAB'}}>
                                        {usdcValue ? 
                                            <>{usdcValue[item.address] ? 
                                                <>${(item.balance * usdcValue[item.address]?.price).toFixed(2)}</>
                                                :<></>
                                            }</>
                                        :<></>}</Typography>
                                    </Box>
                                }
                                key={key}
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        src={item.info.image}
                                    >
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText 
                                    primary={<Typography variant="subtitle1" sx={{color:'white'}}>{item.info.name}</Typography>} 
                                    secondary={
                                        <>
                                            <Typography variant="caption">
                                                {usdcValue ? 
                                                    <>{usdcValue[item.address] ? 
                                                        <>${usdcValue[item.address]?.price.toFixed(6)}</>
                                                        :<></>
                                                    }</>
                                                :<></>}</Typography>
                                            {/*
                                            <Typography variant="caption">ATA {shortenString(item.associated_account,5,5)}</Typography>
                                            */}
                                        </>
                                    }
                                    />
                            </ListItem>
                            
                        ))
                    }

                    {(rulesTokens && rulesTokens.length > 0) &&
                        <Divider>
                            <Chip label="Wallet Rules" size="small" />
                        </Divider>
                    }

                    {rulesTokens && rulesTokens
                        .sort((a:any,b:any) => (b.balance - a.balance)  || b.tokens?.value.length - a.tokens?.value.length)
                        .map((item: any,key:number) => (   
                            <ListItem
                                secondaryAction={
                                    <Box sx={{textAlign:'right'}}>
                                        <Typography variant="subtitle1" sx={{color:'white'}}>
                                            {item.balance.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" sx={{color:'#919EAB'}}>
                                        {usdcValue ? 
                                            <>{usdcValue[item.address] ? 
                                                <>${(item.balance * usdcValue[item.address]?.price).toFixed(2)}</>
                                                :<></>
                                            }</>
                                        :<></>}</Typography>
                                    </Box>
                                }
                                key={key}
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        src={item.info.image}
                                    >
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText 
                                    primary={<Typography variant="subtitle1" sx={{color:'white'}}>{item.info.name}</Typography>} 
                                    secondary={
                                        <>
                                            <Typography variant="caption">
                                                {usdcValue ? 
                                                    <>{usdcValue[item.address] ? 
                                                        <>${usdcValue[item.address]?.price.toFixed(6)}</>
                                                        :<></>
                                                    }</>
                                                :<></>}</Typography>
                                            {/*
                                            <Typography variant="caption">ATA {shortenString(item.associated_account,5,5)}</Typography>
                                            */}
                                        </>
                                    }
                                    />
                            </ListItem>
                            
                        ))
                    }

                </CardContent>
            }
        </Collapse>

        <Collapse in={expandedNft} timeout="auto" unmountOnExit>
            <CardContent>
                {nativeNftTokens && nativeNftTokens
                    //.sort((a:any,b:any) => (b.balance - a.balance)  || b.tokens?.value.length - a.tokens?.value.length)
                    .map((item: any,key:number) => (   
                        
                        <ListItem
                            secondaryAction={
                                <Typography variant="subtitle1" sx={{color:'white'}}>
                                    1
                                </Typography>
                            }
                            key={key}
                        >
                            <ListItemAvatar>
                                <Avatar
                                    src={item.content.links.image}
                                >
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText 
                                primary={<Typography variant="subtitle1" sx={{color:'white'}}>{item.content.metadata.name}</Typography>} 
                                secondary={
                                    <>
                                        <Typography variant="caption">{shortenString(item.id,5,5)}</Typography>
                                    </>
                                }
                                />
                        </ListItem>
                        
                    ))
                }

                {(rulesNftTokens && rulesNftTokens.length > 0) &&
                    <Divider>
                        <Chip label="Wallet Rules" size="small" />
                    </Divider>
                }

                {rulesNftTokens && rulesNftTokens
                    //.sort((a:any,b:any) => (b.balance - a.balance)  || b.tokens?.value.length - a.tokens?.value.length)
                    .map((item: any,key:number) => (   
                        
                        <ListItem
                            secondaryAction={
                                <Typography variant="subtitle1" sx={{color:'white'}}>
                                    1
                                </Typography>
                            }
                            key={key}
                        >
                            <ListItemAvatar>
                                <Avatar
                                    src={item.content.links.image}
                                >
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText 
                                primary={<Typography variant="subtitle1" sx={{color:'white'}}>{item.content.metadata.name}</Typography>} 
                                secondary={
                                    <>
                                        <Typography variant="caption">{shortenString(item.id,5,5)}</Typography>
                                    </>
                                }
                                />
                        </ListItem>
                        
                    ))
                }

            </CardContent>
        </Collapse>
        </Card>
    );
}
