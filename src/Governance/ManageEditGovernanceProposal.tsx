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
} from '@mui/material/';


import { useSnackbar } from 'notistack';
 
import GovernanceCreateProposalView from './GovernanceCreateProposal';

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

export function EditGovernanceProposalDialog(props: any){
    const cachedGovernance = props.cachedGovernance;
    const isCancelled = props.isCancelled || false;
    const setReload = props?.setReload;
    const proposalAuthor = props.proposalAuthor;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const editProposalAddress = props.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const tokenMap = props.tokenMap;
    const memberMap = props.memberMap;
    const governanceAddress = props.governanceAddress;
    const governanceToken = props.governanceToken;
    const thisitem = props.item;
    const title = props?.title;
    const description = props?.description;
    const state = props?.state;
    const isCouncil = props?.isCouncil;
    const governanceType = props?.governanceType;
    //const [thisitem, setThisItem] = React.useState(props.item);
    const realm = props.realm;
    
    const [open, setEditPropOpen] = React.useState(false);
    
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
        setEditPropOpen(false);
    }

    const handleClickOpen = () => {
        setEditPropOpen(true);
        //getVotingParticipants();
    };

    const handleClose = () => {
        setEditPropOpen(false);
    };

    return (
        <>
            <Tooltip title='Edit Proposal'>
                <Button 
                    onClick={handleClickOpen}
                    sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                    Draft <EditIcon fontSize="small" sx={{ml:1}}/>
                </Button>
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
                <BootstrapDialogTitle id="create-storage-pool" onClose={handleCloseDialog}>
                    Edit Proposal {editProposalAddress.toBase58()}
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <GovernanceCreateProposalView 
                        governanceAddress={governanceAddress} 
                        governanceRulesWallet={governanceRulesWallet} 
                        governingTokenMint={governingTokenMint}
                        proposalAuthor={proposalAuthor}
                        //payerWallet={publicKey} 
                        //governanceWallet={governanceWallet?.vault.pubkey} 
                        //setInstructionsObject={setInstructionsObject} 
                        governanceLookup={governanceLookup} 
                        editProposalAddress={editProposalAddress} 
                        setEditPropOpen={setEditPropOpen} 
                        setReload={setReload}
                    />
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}