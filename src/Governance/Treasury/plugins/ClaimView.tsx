import MerkleDistributor from '@jup-ag/merkle-distributor-sdk';
import { PublicKey } from '@solana/web3.js';
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
} from '@mui/material/';

import { useSnackbar } from 'notistack';

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
    const title = props?.title || "Proposal";
    const realm = props?.realm;
    const governanceNativeWallet = props?.governanceNativeWallet;
    const wallet = useWallet();

    const [claimTokenAddress, setClaimTokenAddress] = React.useState(null);
    const [claimableAmount, setClaimableAmount] = React.useState(null);
    const [claimMintInfo, setClaimMintInfo] = React.useState(null);
    const [mintInfo, setMintInfo] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [open, setPropOpen] = React.useState(false);
    
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

    const handleCloseDialog = () => {
        setPropOpen(false);
    }

    const handleClickOpen = () => {
        setPropOpen(true);
    };

    const handleClose = () => {
        setPropOpen(false);
    };

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
        const merkleDistributor = new MerkleDistributor(provider, {
            targetToken: new PublicKey(claimTokenAddress || tokenAddress), // the token to be distributed.
            claimProofEndpoint: 'https://worker.jup.ag/jup-claim-proof',
        });
        // WEN WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk
        
        const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(claimTokenAddress || tokenAddress));
        if (mintInfo){
            setClaimMintInfo(mintInfo);
            //console.log("mintInfo: ",mintInfo);
            const mintInfoApi = await getMintFromApi(claimTokenAddress || tokenAddress);
            if (mintInfoApi)
                setMintInfo(mintInfoApi)
            // governanceNativeWallet
            const claimStatus = await merkleDistributor.getUser(new PublicKey(governanceNativeWallet));
            const amount = claimStatus?.amount;
            //const isClaimed = claimStatus?.proof. .isClaimed;

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

    
    return (
        <>
            <Tooltip title="Extensions">
                <MenuItem onClick={handleClickOpen}>
                <ListItemIcon>
                    <ParaglidingIcon fontSize="small" />
                </ListItemIcon>
                Claim
                </MenuItem>
            </Tooltip>
            
            <BootstrapDialog 
                maxWidth={"xl"}
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
                    Merkle Claim Extension
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText>
                        Welcome to the first Governance Wallet Extension, check any merkle distribution, enter the address of the token
                    </DialogContentText>

                    <Grid container alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2}}>
                        <Chip
                            label="WEN"
                            onClick={(e) => fetchClaimForToken("WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk")}
                            avatar={<Avatar alt="WEN" src="https://shdw-drive.genesysgo.net/GwJapVHVvfM4Mw4sWszkzywncUWuxxPd6s9VuFfXRgie/wen_logo.png" />}
                            />
                    </Grid>

                    <Grid container alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2}}>
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
                            onChange={(e) => setClaimTokenAddress(e.target.value)}
                            />
                    </Grid>

                    {(claimableAmount && governanceNativeWallet) ?
                        <Grid container alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2}}>
                            <Typography variant="h6">
                                This Governance can claim {(claimableAmount/10**claimMintInfo.decimals).toLocaleString()}
                                {mintInfo &&
                                <>
                                    {mintInfo.name}
                                </>}
                            </Typography>

                        </Grid>
                    :<></>}

                    <Grid container alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2}}>
                        <Typography variant="caption">Made with ❤️ by Grape &amp; Jupiter #OPOS</Typography>
                    </Grid>

                    <DialogActions>
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
                                <>Check Claim Status</>
                            }
                            
                        </Button>
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}