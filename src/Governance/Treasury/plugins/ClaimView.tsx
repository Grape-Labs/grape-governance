import MerkleDistributor from '@jup-ag/merkle-distributor-sdk';
import { PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, web3 } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';
import axios from "axios";

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';

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
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import SettingsIcon from '@mui/icons-material/Settings';
import GetAppIcon from '@mui/icons-material/GetApp';
import ParaglidingIcon from '@mui/icons-material/Paragliding';
import ExtensionIcon from '@mui/icons-material/Extension';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

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

export default function ClaimExtensionView(props: any){
    const setReload = props?.setReload;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const editProposalAddress = props?.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const governanceAddress = props.governanceAddress;
    
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
            setGoverningMint(realm?.account.config.councilMint);
        } else{
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

            //console.log("propIx: "+JSON.stringify(propIx))

            setInstructions(propIx);
            setExpandedLoader(true);
        }

        
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

    const checkClaimStatus = async(tokenAddress?:string) => {
        setLoading(true);
        setClaimMintInfo(null);
        setMintInfo(null);
        setClaimableAmount(null);
        const merkleDistributor = new MerkleDistributor(provider, {
            targetToken: new PublicKey(tokenAddress || claimTokenAddress), // the token to be distributed.
            claimProofEndpoint: 'https://worker.jup.ag/jup-claim-proof',
        });

        setDistributor(merkleDistributor);
        
        const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(tokenAddress || claimTokenAddress));
        if (mintInfo){
            setClaimMintInfo(mintInfo);
            //console.log("mintInfo: ",mintInfo);
            const mintInfoApi = await getMintFromApi(tokenAddress || claimTokenAddress);
            if (mintInfoApi)
                setMintInfo(mintInfoApi)
            // governanceNativeWallet
            const claimStatus = await merkleDistributor.getUser(new PublicKey(governanceNativeWallet));
            const amount = claimStatus?.amount;
            //const isClaimed = claimStatus?.proof. .isClaimed;
            console.log("claimStatus: "+JSON.stringify(claimStatus));

            setProposalTitle(`Claiming ${mintInfoApi?.name}`);
            setProposalDescription(`Claim ${(amount/10**mintInfo.decimals).toLocaleString()} ${mintInfoApi?.name} Tokens`)
            
            setClaimableAmount(amount);
        } else{

        }
        setLoading(false);
        
    }

    const fetchClaimForToken = (tokenAddress:string) => {
        setClaimTokenAddress(tokenAddress);
        checkClaimStatus(tokenAddress);
    }

    const handleCheckClaimStatus = () => {
        checkClaimStatus();
    }

    React.useEffect(() => { 
        if (realm && realm?.account.config?.councilMint){
            setGoverningMint(realm?.account.config.councilMint);
            setIsGoverningMintCouncilSelected(true);
            if (realm && realm?.communityMint){
                if (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) !== 18446744073709551615){
                    setGoverningMint(realm?.communityMint);
                    setIsGoverningMintSelectable(true);
                    setIsGoverningMintCouncilSelected(false);
                }
            }
        } else {
            if (realm && realm?.communityMint){
                setGoverningMint(realm?.communityMint);
                setIsGoverningMintCouncilSelected(false);
            }
        }

    }, []);

    
    return (
        <>
            <Tooltip title="Check Claim Status" placement="right">
                <MenuItem onClick={handleClickOpen}>
                <ListItemIcon>
                    <ParaglidingIcon fontSize="small" />
                </ListItemIcon>
                Claim
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
                    Claim Extension
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText>
                        Welcome to the first Governance Wallet Extension, check any merkle distribution, enter the address of the token
                    </DialogContentText>
                    
                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{mt:1,mb:1,textAlign:'center'}}>
                        <Stack direction="row" spacing={1}>
                            <Chip
                                disabled={loading}
                                variant="outlined"
                                label="WEN"
                                onClick={(e) => fetchClaimForToken("WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk")}
                                avatar={<Avatar alt="WEN" src="https://shdw-drive.genesysgo.net/GwJapVHVvfM4Mw4sWszkzywncUWuxxPd6s9VuFfXRgie/wen_logo.png" />}
                                />
                            
                            <Chip
                                disabled={loading}
                                variant="outlined"
                                label="JUP"
                                onClick={(e) => fetchClaimForToken("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN")}
                                avatar={<Avatar alt="WEN" src="https://static.jup.ag/jup/icon.png" />}
                                />
                        </Stack>
                    </Box>

                    
                    <TextField
                        autoFocus
                        required
                        margin="dense"
                        id="claim_token_address"
                        name="claim_token_address"
                        label="Token Address"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={claimTokenAddress}
                        InputLabelProps={{ shrink: true }}
                        onChange={(e) => setClaimTokenAddress(e.target.value)}
                        sx={{textAlign:"center"}}
                        />
                    

                    {(claimableAmount && governanceNativeWallet) ?
                        <Box  alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2,textAlign:'center'}}>
                            <Typography variant="h6">
                                This Governance can claim {(claimableAmount/10**claimMintInfo.decimals).toLocaleString()}&nbsp;
                                {mintInfo &&
                                <>
                                    {mintInfo.name}
                                </>}
                                {/*
                                <br/><br/>
                                
                                <Typography variant='body1'>Add your plugins now on governance.so - the most powerful Wallet on Solana by Grape - reach out to the Grape DAO on 
                                    <Button 
                                        target='_blank' href={`https://discord.gg/grapedao`}
                                        color='inherit'
                                        sx={{
                                        verticalAlign: 'middle',
                                        display: 'inline-flex',
                                        borderRadius:'17px',
                                        m:1,
                                        textTransform:'none'
                                    }}>
                                        <DiscordIcon sx={{mt:1,fontSize:27.5,color:'white'}} /> <strong>Discord</strong>
                                    </Button> to get started
                                    </Typography>
                                */}
                            </Typography>
                        </Box>
                    :<>
                        {(!claimableAmount && claimMintInfo && !loading) ?
                            <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2,textAlign:'center'}}>
                                <Typography variant="h6">
                                    Nothing to claim
                                </Typography>
                            </Box>
                        :<></>}
                    </>}

                    
                    {openAdvanced ? 
                        <>
                            <Box
                                sx={{
                                    border:'1px solid #333',
                                    borderRadius:'17px',
                                    p:2,
                                }}
                            >
                                <TextField
                                    autoFocus
                                    required
                                    margin="dense"
                                    id="proposal_title"
                                    name="proposal_title"
                                    label="Proposal TItle"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={proposalTitle}
                                    InputLabelProps={{ shrink: true }}
                                    onChange={(e) => setProposalTitle(e.target.value)}
                                    sx={{textAlign:"center"}}
                                    />
                                
                                <TextField
                                    autoFocus
                                    required
                                    margin="dense"
                                    id="proposal_dsecription"
                                    name="proposal_description"
                                    label="Proposal Description"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={proposalDescription}
                                    InputLabelProps={{ shrink: true }}
                                    onChange={(e) => setProposalDescription(e.target.value)}
                                    sx={{textAlign:"center"}}
                                    />

                                <FormControl fullWidth >
                                    <FormControlLabel 
                                    control={
                                        <Switch 
                                        checked={isGoverningMintCouncilSelected} //communitySupport ? false : true}
                                        onChange={
                                            (e) => {
                                                toggleGoverningMintSelected(e.target.checked)
                                            }
                                        }
                                        disabled={!isGoverningMintSelectable}
                                        />
                                    } 
                                    label="Council" />
                                </FormControl>

                                <FormControl fullWidth >
                                    <FormControlLabel 
                                    control={
                                        <Switch 
                                            checked={isDraft}
                                            onChange={
                                                (e) => {
                                                    setIsDraft(!isDraft)
                                                }
                                            }
                                        />
                                    } 
                                    label="Draft" />
                                </FormControl>
                            </Box>
                        </>
                    :
                        <></>
                    }


                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                        <Typography variant="caption">Made with ❤️ by Grape &amp; Jupiter #OPOS</Typography>
                    </Box>

                    <DialogActions sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {(publicKey && claimableAmount && claimableAmount > 0) &&
                                <Button
                                    disabled={!claimTokenAddress && !loading}
                                    size='small'
                                    onClick={handleAdvancedToggle}
                                    sx={{
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

                        <Box sx={{ display: 'flex' }}>
                            <Button 
                                disabled={!claimTokenAddress && !loading}
                                autoFocus 
                                onClick={handleCheckClaimStatus}
                                sx={{
                                    '&:hover .MuiSvgIcon-root.claimIcon': {
                                        color:'rgba(255,255,255,0.90)'
                                    }
                                }}
                                startIcon={
                                <>
                                    <ParaglidingIcon 
                                        className="claimIcon"
                                        sx={{
                                            color:'rgba(255,255,255,0.25)',
                                            fontSize:"14px!important"}} />
                                </>
                                }
                            >
                                {loading ?
                                    <>Checking...</>
                                :
                                    <>Check</>
                                }
                                
                            </Button>
                            {(publicKey && claimableAmount && claimableAmount > 0) &&
                            <Button 
                                disabled={!claimTokenAddress && !loading}
                                autoFocus 
                                onClick={handleProposalIx}
                                sx={{
                                    '&:hover .MuiSvgIcon-root.claimNowIcon': {
                                        color:'rgba(255,255,255,0.90)'
                                    }
                                }}
                                startIcon={
                                <>
                                    <GetAppIcon 
                                        className="claimNowIcon"
                                        sx={{
                                            color:'rgba(255,255,255,0.25)',
                                            fontSize:"14px!important"}} />
                                </>
                                }
                            >
                                <>Claim</>
                            </Button>
                            }
                        </Box>
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}