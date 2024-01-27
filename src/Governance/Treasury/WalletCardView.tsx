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
    Skeleton
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
    const [loading, setLoading] = React.useState(false);
    
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

    const getWalletBalances = async() =>{
        setLoading(true);
        // get total sol
        const sol1 = await getWalletBalance(new PublicKey(walletAddress));
        const sol2 = await getWalletBalance(new PublicKey(rulesWalletAddress));
        
        // get total tokens
        const token1 = await getWalletAllTokenBalance(new PublicKey(walletAddress));
        const token2 = await getWalletAllTokenBalance(new PublicKey(rulesWalletAddress));
        
        // get nft balance
        const nft1 = await getWalletNftBalance(new PublicKey(walletAddress));
        const nft2 = await getWalletNftBalance(new PublicKey(rulesWalletAddress));

        // put to unified array
        setNativeSol(sol1);
        setRulesSol(sol2);

        setNativeTokens(token1);
        setRulesTokens(token2);

        setNativeNftTokens(nft1);
        setRulesNftTokens(nft2);

        // unify tokens?
        // think of how we can display them unified if needed
        setLoading(false);
    }

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
            subheader={`domain.sol`}
        />
        <Grid container
            sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}}
        > 
            <Grid xs={12} sx={{display: 'flex', justifyContent: 'center'}}>
                {loading ?
                    <Skeleton variant="rounded" width={100} height={40} sx={{m:4}} />
                :
                    <h2>$#.##</h2>
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

                    {loading ?
                        <Skeleton variant="rounded" width={'100%'} height={50} />
                    :
                    
                    <ListItem
                        secondaryAction={
                            <Typography variant="subtitle1" sx={{color:'white'}}>
                                {(nativeSol && rulesSol) &&
                                    <>
                                    {(nativeSol+rulesSol).toFixed(6)}
                                    </>
                                }
                            </Typography>
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
                            secondary={<Typography variant="caption">Native SOL</Typography>}
                            />
                    </ListItem>
                    }
                </List>

                
                <Grid sx={{textAlign:'right'}}>
                    {nativeTokens &&
                        <Typography variant="caption" >{nativeTokens.length} Tokens</Typography>
                    }
                    {(nativeNftTokens && nativeNftTokens.length > 0) &&
                        <Typography variant="caption" >&nbsp;{nativeNftTokens.length} NFTs</Typography>
                    }
                </Grid>
                
            </Typography>
        </CardContent>
        <CardActions disableSpacing>
            <IconButton aria-label="share">
                <ShareIcon />
            </IconButton>
            {nativeNftTokens && nativeNftTokens.length > 0 &&
                <Tooltip title="Show NFTs">
                    <IconButton 
                        //expand={expandedNft}
                        onClick={handleExpandNftClick}
                        aria-expanded={expandedNft}
                        aria-label="Show NFTs"
                    >
                        <GridViewIcon />
                    </IconButton>
                </Tooltip>
            }
            <Grid container sx={{textAlign:'right'}}>
                {nativeTokens && nativeTokens.length > 0 &&
                <>
                    <Tooltip title="Show Tokens">
                        <ExpandMore
                            expand={expanded}
                            onClick={handleExpandClick}
                            aria-expanded={expanded}
                            aria-label="Show Tokens"
                            >
                            <ExpandMoreIcon />
                        </ExpandMore>
                    </Tooltip>
                </>
                }
            </Grid>
        </CardActions>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
            <CardContent>
                {nativeTokens && nativeTokens
                    .sort((a:any,b:any) => (b.balance - a.balance)  || b.tokens?.value.length - a.tokens?.value.length)
                    .map((item: any,key:number) => (   
                        <>
                            <ListItem
                                secondaryAction={
                                    <Typography variant="subtitle1" sx={{color:'white'}}>
                                        {item.balance.toLocaleString()}
                                    </Typography>
                                }
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
                                            <Typography variant="caption">ATA {shortenString(item.associated_account,5,5)}</Typography>
                                        </>
                                    }
                                    />
                            </ListItem>
                        </>
                    ))
                }

            </CardContent>
        </Collapse>

        <Collapse in={expandedNft} timeout="auto" unmountOnExit>
            <CardContent>
                {nativeNftTokens && nativeNftTokens
                    //.sort((a:any,b:any) => (b.balance - a.balance)  || b.tokens?.value.length - a.tokens?.value.length)
                    .map((item: any,key:number) => (   
                        <>
                            <ListItem
                                secondaryAction={
                                    <Typography variant="subtitle1" sx={{color:'white'}}>
                                        ##
                                    </Typography>
                                }
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
                        </>
                    ))
                }

            </CardContent>
        </Collapse>
        </Card>
    );
}
