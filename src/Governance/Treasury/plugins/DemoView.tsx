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
    Stack,
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DiscordIcon from '../../../components/static/DiscordIcon';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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

export default function DemoExtensionView(props: any){
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

    

    
    return (
        <>
            <Tooltip title="Extensions" placement="right">
                <MenuItem onClick={handleClickOpen}>
                <ListItemIcon>
                    <AddCircleOutlineIcon fontSize="small" />
                </ListItemIcon>
                    Extensions
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
                    Extensions
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText>
                    Add your extension plugins now on governance.so - the most powerful DAO Wallet on Solana by Grape - reach out to the Grape DAO to get started
                    </DialogContentText>
                    
                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                        <Typography variant="caption">Made with ❤️ by Grape #OPOS</Typography>
                    </Box>

                    <DialogActions>
                        <Button 
                        //    disabled={!loading}
                            target='_blank' href={`https://discord.gg/grapedao`}
                        >
                            
                            <DiscordIcon sx={{mt:1,fontSize:27.5,color:'white'}} /> <strong>Discord</strong>
                            
                        </Button>
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}