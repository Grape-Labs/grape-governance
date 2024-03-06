import { PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, web3 } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';
import axios from "axios";

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';

import { 
    shortenString
} from '../../../utils/grapeTools/helpers';

import { 
    TOKEN_PROGRAM_ID, 
    getMint,
    getAssociatedTokenAddress
} from "@solana/spl-token-v2";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';

import {
    Avatar,
    Chip,
    Typography,
    Button,
    Grid,
    Box,
    Table,
    Tooltip,
    LinearProgress,
    DialogTitle,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogActions,
    MenuItem,
    ListItemIcon,
    TextField,
    Stack,
    Switch,
    FormControl,
    FormControlLabel,
    InputAdornment,
    InputLabel,
    Select,
    ListItem,
    ListItemAvatar,
    ListItemText,
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import GetAppIcon from '@mui/icons-material/GetApp';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

import AdvancedProposalView from './AdvancedProposalView';

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
}
  
const BootstrapDialogTitle = (props: DialogTitleProps) => {
    const { children, onClose, ...other } = props;
    
    return (
      <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

export default function SendExtensionView(props: any){
    const setReload = props?.setReload;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const editProposalAddress = props?.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const governanceAddress = props.governanceAddress;
    
    const masterWallet = props?.masterWallet;
    const usdcValue = props?.usdcValue;
    const realm = props?.realm;
    const rulesWallet = props?.rulesWallet;
    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const instructions = props?.instructions;
    const setInstructions = props?.setInstructions;
    
    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey } = useWallet();
    const wallet = useWallet();


    const [distributor, setDistributor] = React.useState(null);
    const [claimTokenAddress, setClaimTokenAddress] = React.useState(null);
    const [claimableAmount, setClaimableAmount] = React.useState(null);
    const [claimMintInfo, setClaimMintInfo] = React.useState(null);
    const [mintInfo, setMintInfo] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [open, setPropOpen] = React.useState(false);
    const [openAdvanced, setOpenAdvanded] = React.useState(false);
    const [proposalTitle, setProposalTitle] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [governingMint, setGoverningMint] = React.useState(null);
    const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
    const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
    const [isDraft, setIsDraft] = React.useState(false);
    const [tokenSelected, setTokenSelected] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(null);
    const [tokenRecipient, setTokenRecipient] = React.useState(null);
    
    const [expanded, setExpanded] = React.useState<string | false>(false);
    
    const provider = new AnchorProvider(RPC_CONNECTION, wallet, {
        commitment: 'confirmed',
    });
    
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const toggleGoverningMintSelected = (council: boolean) => {
        if (council){
            setIsGoverningMintCouncilSelected(true);
            setGoverningMint(realm?.account.config.councilMint);
        } else{
            setIsGoverningMintCouncilSelected(false);
            setGoverningMint(realm?.communityMint);
        }
    }

    const handleAdvancedToggle = () => {
        setOpenAdvanded(!openAdvanced);
    }

    const handleCloseDialog = () => {
        setPropOpen(false);
        handleCloseExtMenu();
    }

    const handleClickOpen = () => {
        setPropOpen(true);
    };

    const handleClose = () => {
        setPropOpen(false);
        handleCloseExtMenu();
    };

    const handleProposalIx = async() => {
        handleCloseExtMenu();
        setPropOpen(false);

        const ixs = await distributor.claimToken(new PublicKey(governanceNativeWallet));
        
        if (ixs){

            const propIx = {
                title:proposalTitle,
                description:proposalDescription,
                ix:ixs,
                nativeWallet:governanceNativeWallet,
                governingMint:governingMint,
                draft:isDraft,
            }

            console.log("propIx: "+JSON.stringify(propIx))

            setInstructions(propIx);
            setExpandedLoader(true);
        }

        
    }

    const RenderTokenItem = (props: any) => {
        const item = props?.item;
        const key = props?.key;
        
        return (
            <ListItem
                secondaryAction={
                    <Box sx={{textAlign:'right'}}>
                        <Box>
                            {item.balance.toLocaleString()}
                        </Box>
                        <Typography variant="caption" sx={{color:'#919EAB'}}>
                        {usdcValue ? 
                            <>{usdcValue[item.address] ? 
                                <>${((item.balance * usdcValue[item.address]?.price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))}</>
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
                    primary={
                        
                        <Typography variant="subtitle1" sx={{color:'white'}}>{item.info.name}</Typography>
                            
                    }
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

        );
    }

    const RenderTokenSelected = (props: any) => {
        const ata = props.ata;
        const [thisTokenSelected, setThisTokenSelected] = React.useState(null);
        
        React.useEffect(() => { 
            if (ata && masterWallet){

                if (masterWallet?.nativeTokens && masterWallet.nativeTokens.length > 0){
                    for (var item of masterWallet.nativeTokens){
                        if (item.associated_account === ata){
                            setThisTokenSelected(item);
                            //setTokenSelected(item)
                        }
                    }
                }

                if (thisTokenSelected)
                    setTokenSelected(thisTokenSelected)
            }
        }, [ata, masterWallet, thisTokenSelected]);

        
        return (

            <>
                {tokenSelected ?
                    <ListItem sx={{m:0,mr:1,p:0,pr:1}}>
                        <ListItemAvatar sx={{m:0,p:0}}>
                            <Avatar
                                src={tokenSelected.info.image}
                                alt={tokenSelected.info.name}
                                sx={{ width: 24, height: 24 }}
                            />
                        </ListItemAvatar>
                        <ListItemText sx={{m:0,p:0,ml:1}}
                            primary={tokenSelected.info.name}
                        />
                    </ListItem>
                :
                    <>{ata}</>
                }
                
            </>

        );
    }

    const getMintFromApi = async(tokenAddress: PublicKey) => {
        
        const uri = `https://api.shyft.to/sol/v1/token/get_info?network=mainnet-beta&token_address=${tokenAddress}`;
        
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

    const adjustTokenAmount = (amountFixed?:number,amountPercent?:number) => {
        if (amountPercent){
            if (amountPercent > 0){
                if (tokenSelected.balance > 0){
                    setTokenAmount(tokenSelected.balance * amountPercent)
                }
            }
        }
    }

    const handleSetTokenAmount = (amount:string) => {
        if (amount){
            setTokenAmount(+amount);
        } else {
            setTokenAmount(0);
        }
    }

    
    const handleSetTokenRecipient = (reciever:string) => {
        if (reciever){
            setTokenRecipient(reciever);
        } else {
            setTokenRecipient(null);
        }
    }
    
    function handleAddMyWallet(){
        if (!tokenRecipient)
            setTokenRecipient(publicKey.toBase58());
        else if (tokenRecipient.length <= 0)
            setTokenRecipient(publicKey.toBase58());
        else if (tokenRecipient.includes(publicKey.toBase58()))
            return;
        //else
            //setDestinationString(tokenRecipient + "\n" + publicKey.toBase58());
    }

    const handlePasteFromClipboard = (event:any) => {
        
        /*event.preventDefault(); // Prevent default paste behavior
        const pastedText = event.clipboardData?.getData('text');
        if (pastedText)
            setTokenRecipient(pastedText);
        */
    }

    React.useEffect(() => { 
        setIsGoverningMintSelectable(false);
        if (realm && realm?.account.config?.councilMint){
            setGoverningMint(realm?.account.config.councilMint);
            setIsGoverningMintCouncilSelected(true);
            if (realm && realm?.account?.communityMint){
                if (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) !== 18446744073709551615){
                    setGoverningMint(realm?.account.communityMint);
                    setIsGoverningMintSelectable(true);
                    setIsGoverningMintCouncilSelected(false);
                }
            }
        } else {
            if (realm && realm?.account?.communityMint){
                setGoverningMint(realm?.account.communityMint);
                setIsGoverningMintCouncilSelected(false);
            }
        }

    }, []);


    function generateInstructions(){
        if (tokenSelected && tokenRecipient){
            if (tokenAmount && tokenAmount > 0){
                const title = "Send "+tokenSelected.info.name
                setProposalTitle(title);
                const description = "Sending "+tokenAmount+" "+tokenSelected.info.name+" to "+shortenString(tokenRecipient,5,5);
                setProposalDescription(description);


            }
        }
    }

    React.useEffect(() => { 
        if (tokenSelected && tokenRecipient){
            if (tokenAmount && tokenAmount > 0){
                
                generateInstructions();
                //setOpenAdvanded(true);

            }
        } else {
            setOpenAdvanded(false);
        }
    }, [tokenSelected, tokenAmount, tokenRecipient]);

    
    return (
        <>
            <Tooltip title="Send Token" placement="right">
                <MenuItem onClick={handleClickOpen}>
                <ListItemIcon>
                    <SendIcon fontSize="small" />
                </ListItemIcon>
                Send
                </MenuItem>
            </Tooltip>
            
            <BootstrapDialog 
                //maxWidth={"xl"}
                fullWidth={true}
                open={open} onClose={handleClose}
                PaperProps={{
                    style: {
                        background: '#13151C',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px'
                    }
                    }}
                >
                <BootstrapDialogTitle 
                    id='extensions-dialog'
                    onClose={handleCloseDialog}
                >
                    Send Extension
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText>
                        Quickly send tokens to any valid Solana address
                    </DialogContentText>
                    
                    <FormControl fullWidth  sx={{mt:2,mb:2}}>
                        
                        {tokenSelected ?
                            <Grid container direction='row' sx={{pl:2,pr:1}}>
                                <Grid item xs>
                                    <Typography variant='caption' sx={{color:'#919EAB'}}>
                                    You're sending
                                    </Typography>
                                </Grid>
                                <Grid item>
                                    <Typography variant='caption' sx={{color:'#919EAB'}}>
                                        <>
                                            <Chip size="small" icon={<AccountBalanceWalletIcon sx={{ fontSize: 6 }} color='inherit' />} 
                                                label={(+tokenSelected.balance).toLocaleString()} 
                                                variant="outlined" 
                                                sx={{mr:1,border:'none;',color:'#919EAB'}} />
                                            <Chip 
                                                onClick={() => adjustTokenAmount(null,0.5)}
                                                label="Half" variant="outlined" size="small" sx={{mr:1,borderColor:'#919EAB',color:'#919EAB'}} />
                                            <Chip
                                                onClick={() => adjustTokenAmount(null,1)}
                                                label="Max" variant="outlined" size="small" sx={{borderColor:'#919EAB',color:'#919EAB'}}/>
                                        </>
                                        
                                    </Typography>
                                </Grid>
                            </Grid>
                        :
                        <></>
                        }


                        
                        
                        <TextField
                            //label="With normal TextField"
                            id="token-amount"
                            variant="filled"
                            sx={{ p: 1, height:'none;', fontSize:'16px' }}
                            value={tokenAmount}
                            onChange={(e) => handleSetTokenAmount(e.target.value)}
                            InputProps={{
                                startAdornment: 
                                <InputAdornment position="start" sx={{ maxWidth:'50%',height:'none' }}>
                                    <FormControl sx={{ m: 1,mt:-1, minWidth: 120 }} size="small">
                                        
                                            <Select
                                                labelId="master-wallet"
                                                id="master-wallet"
                                                size='small'
                                                //value={tokenSelected ? tokenSelected.associated_account : null}
                                                //label="Token"
                                                //onChange={handleChange}
                                                sx={{}}
                                                renderValue={
                                                    (value) => <RenderTokenSelected ata={value} />
                                                }
                                                // (value) => `⚠️  - ${value}`
                                            >
                                                {masterWallet?.nativeTokens && masterWallet.nativeTokens
                                                    //.sort((a:any,b:any) => (b.balance - a.balance))
                                                    .sort((a, b) => {
                                                        const priceA = usdcValue[a.address]?.price;
                                                        const priceB = usdcValue[b.address]?.price;
                                                        
                                                        if (priceA !== undefined && priceB !== undefined) {
                                                            return (b.balance * priceB) - (a.balance * priceA);
                                                        } else if (priceA !== undefined) {
                                                            // If only the first token has a price, it should come first
                                                            return -1;
                                                        } else if (priceB !== undefined) {
                                                            // If only the second token has a price, it should come first
                                                            return 1;
                                                        } else {
                                                            // If neither has a price, fall back to sorting by balance
                                                            return b.balance - a.balance;
                                                        }
                                                    })
                                                    //.sort((a:any,b:any) => ((usdcValue && (usdcValue[b.address] && usdcValue[a.address]) && (b.balance * usdcValue[b.address]?.price)-(a.balance * usdcValue[a.address]?.price))) || (b.balance - a.balance))
                                                    //.sort((a:any,b:any) => (b.balance - a.balance))
                                                    .map((item: any,key:number) => (   
                                                        <MenuItem value={item.associated_account} key={key}>
                                                            
                                                            <RenderTokenItem item={item} key={key} />
                                                            
                                                        </MenuItem>
                                                        
                                                    ))

                                                }
                                            </Select> 
                                        
                                    </FormControl>
                                </InputAdornment>,
                                inputProps: {
                                    style: { textAlign: 'right', fontSize:'16px', height:'none;' }, // Align text input to the right
                                },
                            }}
                            
                        />
                    </FormControl>

                    <FormControl fullWidth  sx={{mb:2}}>
                        <TextField
                            label="Recipient"
                            id="recipient"
                            variant="filled"
                            sx={{ m: 0.65 }}
                            value={tokenRecipient}
                            onChange={(e) => handleSetTokenRecipient(e.target.value)}
                            InputLabelProps={{
                                shrink: !!tokenRecipient, // Set shrink based on value existence
                            }}
                        />
                        <Grid sx={{textAlign:'right',}}>
                            {/*
                            <Tooltip title='Paste from clipboard'>
                                <IconButton 
                                        size="small"
                                        onClick={handlePasteFromClipboard}
                                        color='inherit'
                                        sx={{color:'#919EAB',textTransform:'none',ml:1}}
                                        onPaste={handlePasteFromClipboard}
                                        >
                                    <ContentPasteIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                            */}
                            <Tooltip title='Send to my Wallet'>
                                <IconButton 
                                        size="small"
                                        onClick={handleAddMyWallet}
                                        color='inherit'
                                        sx={{color:'#919EAB',textTransform:'none',ml:1}}>
                                    <PersonIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                    </FormControl>

                    {openAdvanced ? 
                        <>
                            <AdvancedProposalView 
                                proposalTitle={proposalTitle}
                                setProposalTitle={setProposalTitle}
                                proposalDescription={proposalDescription}
                                setProposalDescription={setProposalDescription}
                                toggleGoverningMintSelected={toggleGoverningMintSelected}
                                isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
                                isGoverningMintSelectable={isGoverningMintSelectable}
                                isDraft={isDraft}
                                setIsDraft={setIsDraft}
                            />
                            
                        </>
                    :
                        <></>
                    }


                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                        <Typography variant="caption">Made with ❤️ by Grape</Typography>
                    </Box>

                    <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p:0, pb:1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', p:0 }}>
                        {(publicKey && tokenAmount && tokenAmount > 0 && tokenRecipient && tokenSelected) &&
                                <Button
                                    disabled={!tokenRecipient && !loading}
                                    size='small'
                                    onClick={handleAdvancedToggle}
                                    sx={{
                                        borderRadius:'17px',
                                        justifyContent: 'flex-start',
                                        '&:hover .MuiSvgIcon-root.claimIcon': {
                                            color:'rgba(255,255,255,0.90)'
                                        }
                                    }}
                                    startIcon={
                                        <>
                                            <SettingsIcon 
                                                className="claimIcon"
                                                sx={{
                                                    color:'rgba(255,255,255,0.25)',
                                                    fontSize:"14px!important"}} />
                                        </>
                                    }
                                >
                                    Advanced
                                </Button>
                        }
                        </Box>

                        <Box sx={{ display: 'flex', p:0 }}>
                            {(publicKey && tokenAmount && tokenAmount > 0 && tokenRecipient && tokenSelected) &&
                                <Button 
                                    disabled={!tokenRecipient && !loading}
                                    autoFocus 
                                    onClick={handleProposalIx}
                                    sx={{
                                        borderRadius:'17px',
                                        '&:hover .MuiSvgIcon-root.claimNowIcon': {
                                            color:'rgba(255,255,255,0.90)'
                                        }
                                    }}
                                    startIcon={
                                    <>
                                        <SendIcon 
                                            sx={{
                                                color:'rgba(255,255,255,0.25)',
                                                fontSize:"14px!important"}}
                                        />
                                    </>
                                    }
                                >
                                    <>Send</>
                                </Button>
                            }
                        </Box>
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}