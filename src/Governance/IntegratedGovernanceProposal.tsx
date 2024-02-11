import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';


import {
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
  MenuItem,
  ListItemIcon,
} from '@mui/material/';


import { useSnackbar } from 'notistack';
 
import GovernanceCreateProposalView from './GovernanceCreateProposal';

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

export function IntegratedGovernanceProposalDialogView(props: any){
    const setReload = props?.setReload;
    const proposalAuthor = props?.proposalAuthor;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const editProposalAddress = props?.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const tokenMap = props.tokenMap;
    const memberMap = props.memberMap;
    const governanceAddress = props.governanceAddress;
    const intraDao = props?.intraDao;
    const governanceProposal = props?.governanceProposal;
    const title = props?.title || "Proposal";
    const usePlugin = props?.usePlugin;
    const governanceWallets = props?.governanceWallets;

    // HOLDINGS CAN BE PASSED ALONG WITH ALL GOV WALLETS


    //const [thisitem, setThisItem] = React.useState(props.item);
    const realm = props?.realm;
    const useButtonType = props?.useButton; // null = default edit, 1 = Send
    const useButtonText = props?.useButtonText || "Create";

    const [open, setPropOpen] = React.useState(false);
    
    const [expanded, setExpanded] = React.useState<string | false>(false);
    const handleChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

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
            <Tooltip title={title}>
                {(useButtonType && useButtonType === 1) ?
                    <Button onClick={handleClickOpen} fullWidth color='primary' size="large" variant="contained" sx={{backgroundColor:'rgba(255,255,255,0.05)',pl:2,pr:2,ml:1,mr:1}}>{useButtonText}</Button>
                :
                    <>
                        {(useButtonType === 2 || useButtonType === 3) ? 
                            <>
                                <Tooltip title="Send">
                                    <Button color={'inherit'} variant='text' 
                                        onClick={handleClickOpen} 
                                        sx={{m:0,p:0,
                                            '&:hover .MuiSvgIcon-root': {
                                                opacity: 1,
                                            },
                                        }}
                                        startIcon={
                                            <SendIcon 
                                                fontSize={'small'} 
                                                sx={{
                                                    color:'rgba(255,255,255,0.25)',
                                                    opacity: 0,
                                                    pl:1,
                                                    fontSize:"10px"}} />
                                        }>
                                        <Typography variant={useButtonType === 2 ? `h5`:`subtitle1`} sx={{color:'white'}}>
                                            {useButtonText}
                                        </Typography>
                                    </Button>
                                </Tooltip>
                            </>
                        :
                            <>
                                {useButtonType === 4 ? 
                                    <>
                                        <MenuItem onClick={handleClickOpen} >
                                            <ListItemIcon>
                                                <AddCircleIcon fontSize="small" />
                                            </ListItemIcon>
                                            Create Proposal</MenuItem>
                                    </>
                                :
                                    <Button 
                                        onClick={handleClickOpen}
                                        sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                                        Draft <EditIcon fontSize="small" sx={{ml:1}}/>
                                    </Button>
                                }
                            </>
                        }
                    </>
                }

            </Tooltip>

            <BootstrapDialog 
                maxWidth={"xl"}
                fullWidth={true}
                open={open} onClose={handleClose}
                PaperProps={{
                    style: {
                        p:0,
                        background: '#13151C',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px'
                    }
                    }}
                >
                <BootstrapDialogTitle id="create-storage-pool" onClose={handleCloseDialog}>
                    {title} {editProposalAddress && editProposalAddress.toBase58()}
                </BootstrapDialogTitle>
                <DialogContent sx={{m:0,p:0}}>
                    <GovernanceCreateProposalView 
                        governanceWallets={governanceWallets}
                        governanceAddress={governanceAddress} 
                        intraDao={intraDao}
                        governanceProposal={governanceProposal}
                        governanceRulesWallet={governanceRulesWallet} 
                        governingTokenMint={governingTokenMint}
                        proposalAuthor={proposalAuthor}
                        usePlugin={usePlugin}
                        //payerWallet={publicKey} 
                        //governanceWallet={governanceWallet?.vault.pubkey} 
                        //setInstructionsObject={setInstructionsObject} 
                        governanceLookup={governanceLookup} 
                        editProposalAddress={editProposalAddress} 
                        setEditPropOpen={setPropOpen} 
                        setReload={setReload}
                        fromDialog={true}
                    />
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}