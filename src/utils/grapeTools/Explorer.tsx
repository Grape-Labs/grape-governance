import React from "react"
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { Link } from "react-router-dom";
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import axios from "axios";
import QRCode from "react-qr-code";

import { 
    tryGetName,
} from '@cardinal/namespaces';

import { getProfilePicture } from '@solflare-wallet/pfp';
import { findDisplayName } from '../name-service';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';

import { 
    RPC_CONNECTION, 
    TWITTER_PROXY,
    SHYFT_KEY,
    HELIUS_API,
    BLACKLIST_WALLETS } from './constants';

import { 
    Avatar,
    Button,
    Menu,
    MenuItem,
    ListItemIcon,
    Grid,
    Box,
    ListItemText,
    Typography,
    Paper,
    Divider,
    Tooltip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
} from '@mui/material';

import {
    //GRAPE_COLLECTIONS_DATA
} from './constants';

import { decodeMetadata } from '../grapeTools/utils';
import { ValidateCurve } from '../grapeTools/WalletAddress';

import SolIcon from '../../components/static/SolIcon';
import SolCurrencyIcon from '../../components/static/SolCurrencyIcon';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CloseIcon from '@mui/icons-material/Close';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import TwitterIcon from '@mui/icons-material/Twitter';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExploreIcon from '@mui/icons-material/Explore';
import PersonIcon from '@mui/icons-material/Person';
import ContactPageIcon from '@mui/icons-material/ContactPage';

import { trimAddress } from "./WalletAddress";
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
  }

  const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
  }));

const StyledMenu = styled(Menu)(({ theme }) => ({
    '& .MuiMenu-root': {
    },
    '& .MuiMenu-box': {
        backgroundColor:'rgba(0,0,0,0.95)',
        borderRadius:'17px'
    },
}));

const getTokens = async () => {
    const tarray:any[] = [];
    try{
        await new TokenListProvider().resolve().then(tokens => {
            const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
            console.log("tokenList: "+JSON.stringify(tokenList))
            const tmap = tokenList.reduce((map, item) => {
                tarray.push({address:item.address, decimals:item.decimals})
                map.set(item.address, item);
                return map;
            },new Map())
            console.log("gt: "+JSON.stringify(tmap));
            return tmap;
        });
        return null;
    } catch(e){
        console.log("ERR: "+e);
        return null;
    }
}

export default function ExplorerView(props:any){
    const address = props.address;
    //const [address, setAddress] = React.useState(props.address);
    const title = props.title || null;
    const showAddress = props.showAddress || false;
    const memberMap = props?.memberMap || null;
    const type = props.type || 'address';
    const buttonStyle = props?.style || 'outlined';
    const buttonColor = props?.color || 'white';
    const hideTitle = props?.hideTitle || false;
    const hideIcon = props?.hideIcon || false;
    const fontSize = props?.fontSize || '14px';
    const useLogo = props?.useLogo || null;
    const grapeArtProfile = props?.grapeArtProfile || false;
    const shorten = props?.shorten || 0;
    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);
    const dao = props?.dao;
    const governance = props?.governance;
    const showSolanaProfile = props.showSolanaProfile || null;
    const showNftData = props.showNftData || null;
    const showSolBalance = props.showSolBalance || null;
    const connection = RPC_CONNECTION;
    const [solanaDomain, setSolanaDomain] = React.useState(null);
    const [hasSolanaDomain, setHasSolanaDomain] = React.useState(false);
    const [profilePictureUrl, setProfilePictureUrl] = React.useState(null);
    const [twitterRegistration, setTwitterRegistration] = React.useState(null);
    const [hasProfilePicture, setHasProfilePicture] = React.useState(null);
    const [openDialog, setOpenDialog] = React.useState(false);
    const [solBalance, setSolBalance] = React.useState(null);
    const showTokenMetadata = props?.showTokenMetadata;
    const tokenMap = props?.tokenMap;

    const isBlacklisted = BLACKLIST_WALLETS.some(w => w.toLowerCase() === address.toLowerCase());

    const handleClickOpenDialog = (event:any) => {
        setOpenDialog(true);
    };
    const handleCloseDialog = () => {
        setOpenDialog(false);
        handleClose();
    };

    const handleClick = (event:any) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const [open_snackbar, setSnackbarState] = React.useState(false);
    const { enqueueSnackbar } = useSnackbar();

    const handleCopyClick = () => {
        enqueueSnackbar(`Copied!`,{ variant: 'success' });
        handleClose();
    };

    const fetchTokenMetada = async() => {
        try{
            
            let titem = null;
            if (tokenMap){
                titem = tokenMap.get(address);
                //console.log("item: "+JSON.stringify(titem))
                if (titem?.name)
                    setSolanaDomain(titem.name);

                if (titem?.logoURI){
                    setProfilePictureUrl(titem?.logoURI);
                    setHasProfilePicture(true);
                }
            }
            if (!titem) // && tokenMap) // remove tokenMap here to will make more rpc calls
                fetchTokenData();
            
        }catch(e){
            console.log("ERR: "+e);
        }
    }

    const fetchSolBalance = async() => {
        try{
            const balance = await connection.getBalance(new PublicKey(address));
            const adjusted_balance = +(balance/(10 ** 9)).toFixed(3)
            console.log("balance: "+adjusted_balance)
            setSolBalance(adjusted_balance);
        }catch(e){
            console.log("ERR: "+e);
        }
    }

    const fetchTokenData = async() => {
        try{
            
            if (HELIUS_API){
                const uri = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API}`;
                const response = await fetch(uri, {
                    method: 'POST',
                    headers: {
                    "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "id": "text",
                    "method": "getAsset",
                    "params": {
                        id: address,
                    }
                    }),
                });
                /*
                const uri = `https://rpc.shyft.to/?api_key=${SHYFT_KEY}`;
                const response = await fetch(uri, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'rpc-id',
                        method: 'getAsset',
                        params: {
                            id: address
                        },
                    }),
                    });
                    */ 
                const { result } = await response.json();
                
                if (result){
                    if (result?.content?.metadata?.name){
                        setSolanaDomain(result?.content?.metadata?.name);
                        //return result?.content?.metadata?.name;
                    }
                    const image = result?.content?.links?.image;
                
                    if (image){
                        if (image){
                            setProfilePictureUrl(image);
                            setHasProfilePicture(true);
                        }
                    }
                    return null;
                } else {

                    const MD_PUBKEY = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
                    const [pda, bump] = await PublicKey.findProgramAddress(
                        [Buffer.from('metadata'), MD_PUBKEY.toBuffer(), new PublicKey(address).toBuffer()],
                        MD_PUBKEY
                    );
                    
                    const tokendata = await connection.getParsedAccountInfo(new PublicKey(pda));

                    if (tokendata){
                        //console.log("tokendata: "+JSON.stringify(tokendata));
                        if (tokendata.value?.data) {
                            const buf = Buffer.from(tokendata.value.data, 'base64');
                            const meta_final = decodeMetadata(buf);
                            
                            if (meta_final?.data?.name){
                                setSolanaDomain(meta_final.data.name);
                                if (meta_final.data?.uri){
                                    const urimeta = await window.fetch(meta_final.data.uri).then((res: any) => res.json());
                                    const image = urimeta?.image;
                                    if (image){
                                        setProfilePictureUrl(image);
                                        setHasProfilePicture(true);
                                    }
                                }
                            }
                            //console.log("meta_final: "+JSON.stringify(meta_final));
                        }
                    }
                }
            }
            
            /*
            const uri = `https://rpc.shyft.to/?api_key=${SHYFT_KEY}`;

            const response = await fetch(uri, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'rpc-id',
                    method: 'getAsset',
                    params: {
                    id: address
                    },
                }),
                });
            const { result } = await response.json();
            //console.log("Asset: ", result);

            if (result){
                if (result?.content?.metadata?.name){
                    setSolanaDomain(result?.content?.metadata?.name);
                }
                const image = result?.content?.links?.image;
                
                if (image){
                    if (image){
                        setProfilePictureUrl(image);
                        setHasProfilePicture(true);
                    }
                }
            } else {

                const MD_PUBKEY = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
                const [pda, bump] = await PublicKey.findProgramAddress(
                    [Buffer.from('metadata'), MD_PUBKEY.toBuffer(), new PublicKey(address).toBuffer()],
                    MD_PUBKEY
                );
                
                const tokendata = await connection.getParsedAccountInfo(new PublicKey(pda));

                if (tokendata){
                    //console.log("tokendata: "+JSON.stringify(tokendata));
                    if (tokendata.value?.data) {
                        const buf = Buffer.from(tokendata.value.data, 'base64');
                        const meta_final = decodeMetadata(buf);
                        
                        if (meta_final?.data?.name){
                            setSolanaDomain(meta_final.data.name);
                            if (meta_final.data?.uri){
                                const urimeta = await window.fetch(meta_final.data.uri).then((res: any) => res.json());
                                const image = urimeta?.image;
                                if (image){
                                    setProfilePictureUrl(image);
                                    setHasProfilePicture(true);
                                }
                            }
                        }
                        //console.log("meta_final: "+JSON.stringify(meta_final));
                    }
                }
            }
            */
        }catch(e){
            console.log("ERR: "+e)
        }
    
    }

    const fetchProfilePicture = async () => {
        //setLoadingPicture(true);  
            try{
                const { isAvailable, url } = await getProfilePicture(connection, new PublicKey(address));
                
                let img_url = url;
                if (url)
                    img_url = url.replace(/width=100/g, 'width=256');
                setProfilePictureUrl(img_url);
                setHasProfilePicture(isAvailable);
                //countRef.current++;
            }catch(e){
                console.log("ERR: "+e)
            }
        //setLoadingPicture(false);
    }

    const fetchSolanaDomain = async () => {
        
        console.log("fetching tryGetName: "+address);
        setTwitterRegistration(null);
        setHasSolanaDomain(false);
        let found_cardinal = false;
        /*
        //const cardinalResolver = new CardinalTwitterIdentityResolver(ggoconnection);
        try{
            //const cardinal_registration = await cardinalResolver.resolve(new PublicKey(address));
            //const identity = await cardinalResolver.resolveReverse(address);
            //console.log("identity "+JSON.stringify(cardinal_registration))
            
            
            const cardinal_registration = await tryGetName(
                connection, 
                new PublicKey(address)
            );

            if (cardinal_registration){
                found_cardinal = true;
                console.log("cardinal_registration: "+JSON.stringify(cardinal_registration));
                setHasSolanaDomain(true);
                setSolanaDomain(cardinal_registration[0]);
                setTwitterRegistration(cardinal_registration[0]);
                const url = `${TWITTER_PROXY}https://api.twitter.com/2/users/by&usernames=${cardinal_registration[0].slice(1)}&user.fields=profile_image_url,public_metrics`;
                const response = await axios.get(url);
                //const twitterImage = response?.data?.data[0]?.profile_image_url;
                if (response?.data?.data[0]?.profile_image_url){
                    setProfilePictureUrl(response?.data?.data[0]?.profile_image_url);
                    setHasProfilePicture(true);
                }
            }
            
        }catch(e){
            console.log("ERR: "+e);
        }
        */
        
        if (!found_cardinal){
            const domain = await findDisplayName(connection, address);
            if (domain) {
                if (domain[0] !== address) {
                    setHasSolanaDomain(true);
                    setSolanaDomain(domain[0]);
                }
            }
        }
    };

    function GetEscrowName(props:any){
        const thisAddress = props.address;
        const [escrowName, setEscrowName] = React.useState(null);
      
        const fetchVerifiedAuctionHouses = async() => {
            try{
                /*
                const url = GRAPE_COLLECTIONS_DATA+'verified_auctionHouses.json';
                const response = await window.fetch(url, {
                    method: 'GET',
                    headers: {
                    }
                  });
                  const string = await response.text();
                  const json = string === "" ? {} : JSON.parse(string);

                  for (let itemAuctionHouse of json){
                    //console.log("itemAuctionHouse: " + itemAuctionHouse.address + " vs " + thisAddress)
                    if (itemAuctionHouse.address === thisAddress){
                      setEscrowName(itemAuctionHouse.name);
                    }
                  }
                
                return json;
                */
                return null
            } catch(e){
                console.log("ERR: "+e)
                return null;
            }
        }
      
        React.useEffect(() => {   
            if (thisAddress)
                fetchVerifiedAuctionHouses();
        }, [thisAddress]);
          
        return (
            <>
                {escrowName && <Typography variant='caption' sx={{ml:1}}>({escrowName})</Typography>}
            </>
        );
    }

    React.useEffect(() => {   
        if (showSolanaProfile){

            {(shorten && shorten > 0) ? 
                setSolanaDomain(trimAddress(address,shorten))
            : 
                setSolanaDomain(address)
            } 

            setHasProfilePicture(null);
            setProfilePictureUrl(null);
            setHasProfilePicture(false);
            setTwitterRegistration(null);
            if (memberMap){
                for (var member of memberMap){
                    if (new PublicKey(member.account.governingTokenOwner).toBase58() === address){
                        //console.log("found: "+address);
                        //console.log("memberItem: "+JSON.stringify(member.socialConnections));
                        if (member?.socialConnections){
                            if (member.socialConnections.solflare.pfp){
                                setProfilePictureUrl(member.socialConnections.solflare.pfp)
                                setHasProfilePicture(true);
                            }
                            if (member.socialConnections.bonfida.handle){
                                setSolanaDomain(member.socialConnections.bonfida.handle)
                            }
                            if (member.socialConnections.cardinal.handle){
                                setSolanaDomain(member.socialConnections.cardinal.handle)
                                setTwitterRegistration(member.socialConnections.cardinal.handle)
                            }
                            if (member.socialConnections.cardinal.pfp){
                                setProfilePictureUrl(member.socialConnections.cardinal.pfp)
                                setHasProfilePicture(true);
                            }
                            if (member.socialConnections?.allDomains?.handles){
                                //console.log("All Domains ("+address+"): "+JSON.stringify(member.socialConnections.allDomains))
                                //setSolanaDomain(member.socialConnections.allDomains.handle)
                            }
                            

                        }
                    }
                }
            } else{
                //console.log("no memberMap?")
                //fetchProfilePicture();
                //fetchSolanaDomain();
            }
        }
    }, [showSolanaProfile, address]);
    
    React.useEffect(() => {   
        if (showTokenMetadata){
            fetchTokenMetada();
        }
    }, [showTokenMetadata, address]);

    React.useEffect(() => {   
        if (showNftData){
            fetchTokenData()
        }
    }, [showNftData, address]);

    React.useEffect(() => {   
        if (showSolBalance){
            fetchSolBalance()
        }
    }, [showSolBalance, address]);

    return (
        <>
            <Tooltip title={isBlacklisted ? "This wallet is blacklisted" : "View in explorer"}>
            <Button
                aria-controls={open ? 'basic-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}
                variant={buttonStyle}
                color='inherit'
                sx={{m:0,borderRadius:'17px',color:`${buttonColor}`, textTransform:'none'}}
                startIcon={
                    <>
                        {profilePictureUrl ?
                            <Avatar alt={address} src={profilePictureUrl} sx={{ width: 30, height: 30, bgcolor: 'rgb(0, 0, 0)' }}>
                                {address.substr(0,2)}
                            </Avatar>
                        :
                            <>
                            {useLogo ?
                                <Avatar alt={address} src={useLogo} sx={{ width: 30, height: 30, bgcolor: 'rgb(0, 0, 0)' }}>
                                    {address.substr(0,2)}
                                </Avatar>
                            :
                                <>
                                {hideIcon ?
                                    <></>
                                :
                                    <>
                                        {isBlacklisted ? (
                                            <WarningAmberIcon sx={{ color: 'orange', fontSize: fontSize }} />
                                        ) : (
                                            <ExploreIcon sx={{ color: buttonColor, fontSize: fontSize }} />
                                        )}
                                    </>
                                }
                                </>
                            }
                            </>
                        }
                    </>
                }
            >
                <Typography sx={{color:`${buttonColor}`,fontSize:`${fontSize}`,textAlign:'left'}}>
                    {title ?
                        <>{title}</>
                    :
                        <>
                            {!hideTitle &&
                                <>
                                    {solanaDomain ?
                                        <>
                                            {solanaDomain}
                                            {showAddress && hasSolanaDomain &&
                                            <><br/><Typography variant='caption' sx={{textTransform:'none'}}>{(shorten && shorten > 0) ? trimAddress(address,shorten) : address}</Typography></>}
                                        </>
                                    :
                                    <>
                                    {(shorten && shorten > 0) ? 
                                        trimAddress(address,shorten) : address
                                    } 
                                    </>
                                    }
                                </>
                            }
                        </>
                    }
                    
                    {address && type === 'address' && !ValidateCurve(address) &&
                        <>
                            <GetEscrowName address={address} />
                        </>
                    }
                    
                </Typography>
            </Button>
            </Tooltip>
            <Box
            >
                <StyledMenu
                    id="basic-menu"
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleClose}
                    MenuListProps={{
                        'aria-labelledby': 'basic-button',
                    }}
                >
                    <CopyToClipboard 
                            text={address} 
                            onCopy={handleCopyClick}
                        >
                        <MenuItem 
                            onClick={handleClose}
                            color='inherit'
                        >

                            <ListItemIcon>
                                <ContentCopyIcon fontSize="small" />
                            </ListItemIcon>
                            Copy
                        </MenuItem>
                    </CopyToClipboard>
                    {grapeArtProfile &&
                        <>
                        <Divider />
                        <MenuItem 
                            color='inherit'
                            onClick={handleClickOpenDialog}>
                                <ListItemIcon>
                                    <QrCode2Icon fontSize="small" />
                                </ListItemIcon>
                                QR Code
                        </MenuItem>
                        
                        {solBalance &&
                        <>
                            <Divider />
                            <Tooltip title="SOL balance in wallet">
                                <MenuItem
                                    color='inherit'
                                >
                                        <ListItemIcon>
                                            <SolCurrencyIcon sx={{color:'white'}} />
                                        </ListItemIcon>
                                        {solBalance}
                                </MenuItem>
                            </Tooltip>
                        </>
                        }

                        <BootstrapDialog
                            onClose={handleCloseDialog}
                            aria-labelledby="customized-dialog-title"
                            open={openDialog}
                            PaperProps={{
                                style: {
                                boxShadow: '0px 4px 20px rgba(0,0,0,0.1)',
                                borderRadius: '17px',
                                padding: '24px',
                                background: 'linear-gradient(to right, #434343, #111111)' // ✅ use 'background' here
                                },
                            }}
                            >
                            <DialogContentText id="alert-dialog-description">
                                <Box
                                    display="flex"
                                    flexDirection="column"
                                    alignItems="center"
                                    justifyContent="center"
                                    sx={{
                                        borderRadius: 2,
                                        backgroundColor: '#1e1e1e',  // ✅ Dark theme friendly
                                        p: 2,
                                        mb: 2,
                                        border: '1px solid #444',    // ✅ Adds subtle separation
                                        boxShadow: 1,
                                        maxWidth: 256,
                                        mx: 'auto',
                                    }}
                                    >
                                    <QRCode
                                        size={256}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        value={address}
                                        viewBox={`0 0 256 256`}
                                        fgColor="#ffffff"  // ✅ Make QR code white for visibility on dark
                                        bgColor="#1e1e1e"
                                    />
                                    </Box>

                                <Grid container spacing={1} justifyContent="center" textAlign="center">
                                    <Grid item xs={12}>
                                        <Typography
                                            variant="subtitle1"
                                            color="text.secondary"
                                            sx={{
                                                wordBreak: 'break-all',
                                            }}
                                        >
                                        {address}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="caption" color="text.secondary">
                                        Send to this address
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </DialogContentText>
                            </BootstrapDialog>
                        </>
                    }
                    <Divider />
                    
                    
                    {/*grapeArtProfile && 
                        <>
                        {ValidateCurve(address) ?
                                <MenuItem 
                                    component={Link}
                                    to={`${GRAPE_PROFILE}${address}`}
                                    onClick={handleClose}>
                                        <ListItemIcon>
                                            <PersonIcon fontSize="small" />
                                        </ListItemIcon>
                                        Grape Profile
                                </MenuItem>
                        :
                            <Tooltip title='The address is off-curve (this address does not lie on a Ed25519 curve - typically a valid curve is generated when creating a new wallet), the address here is off-curve and can be a program derived address (PDA) like a multi-sig or escrow'>
                                <MenuItem >
                                    <ListItemIcon>
                                        <WarningAmberIcon sx={{ color: 'yellow' }} fontSize="small" />
                                    </ListItemIcon>
                                    Off-Curve
                                </MenuItem>
                            </Tooltip>
                        }
                        </>
                    */}
                {grapeArtProfile && 
                    <>    
                        <MenuItem 
                            color='inherit'
                            component='a'
                            target='_blank'
                            href={`https://governance.so/profile/${address}`}
                            onClick={handleClose}>
                                <ListItemIcon>
                                    <ContactPageIcon fontSize="small" />
                                </ListItemIcon>
                                Governance Profile
                        </MenuItem>

                        <MenuItem 
                            color='inherit'
                            component='a'
                            target='_blank'
                            href={`https://grape.art/identity/${address}`}
                            onClick={handleClose}>
                                <ListItemIcon>
                                    <PersonIcon fontSize="small" />
                                </ListItemIcon>
                                Grape Identity
                        </MenuItem>
                        
                        <Divider />
                    </>
                }

                {governance &&
                    <>    
                        <MenuItem 
                            color='inherit'
                            component='a'
                            target='_blank'
                            href={`https://governance.so/treasury/${dao}/${governance}`}
                            onClick={handleClose}>
                                <ListItemIcon>
                                    <AccountBalanceIcon fontSize="small" />
                                </ListItemIcon>
                                Treasury Wallet
                        </MenuItem>
                        
                        <Divider />
                    </>
                }
                    <MenuItem 
                        color='inherit'
                        component='a'
                        href={`https://explorer.solana.com/${type}/${address}`}
                        target='_blank'
                        onClick={handleClose}
                    >
                        <ListItemIcon>
                            <ExploreOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        Explorer
                    </MenuItem>
                    <MenuItem 
                        color='inherit'
                        component='a'
                        href={`https://translator.shyft.to/${type === 'address' ? 'address' : 'tx'}/${address}`}
                        target='_blank'
                        onClick={handleClose}>
                            <ListItemIcon>
                                <ExploreOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            Shyft
                    </MenuItem>
                    <MenuItem 
                        color='inherit'
                        component='a'
                        href={`https://solscan.io/${type === 'address' ? 'account' : type}/${address}`}
                        target='_blank'
                        onClick={handleClose}>
                            <ListItemIcon>
                                <ExploreOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            SolScan
                    </MenuItem>
                    <MenuItem 
                        color='inherit'
                        component='a'
                        href={`https://solana.fm/${type}/${address}`}
                        target='_blank'
                        onClick={handleClose}>
                            <ListItemIcon>
                                <ExploreOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            SolanaFM
                    </MenuItem>
                    <MenuItem 
                        color='inherit'
                        component='a'
                        href={`https://solanabeach.io/${type === 'address' ? 'address' : 'transaction'}/${address}`}
                        target='_blank'
                        onClick={handleClose}>
                            <ListItemIcon>
                                <ExploreOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            Solana Beach
                    </MenuItem>
                    {/*
                    <MenuItem 
                        color='inherit'
                        component='a'
                        href={`https://xray.helius.xyz/${type === 'address' ? 'account' : 'tx'}/${address}`}
                        target='_blank'
                        onClick={handleClose}>
                            <ListItemIcon>
                                <ExploreOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            XRay
                    </MenuItem>
                    */}
                    
                    {twitterRegistration &&
                        <>
                            <Divider />
                            <MenuItem 
                                color='inherit'
                                component='a'
                                href={`https://twitter.com/${twitterRegistration}`}
                                target='_blank'
                                onClick={handleClose}>
                                    <ListItemIcon>
                                        <TwitterIcon fontSize="small" />
                                    </ListItemIcon>
                                    Twitter
                            </MenuItem>
                        </>
                    }

                </StyledMenu>
            </Box>
        </>
        
    ); 
}