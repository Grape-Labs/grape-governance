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
 
import { GovernanceProposalV2View } from './GovernanceProposalV2';

import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
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

const GOVERNANCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing w/errors!',
}

export function GovernanceProposalDialog(props: any){
    const governanceAddress = props?.governanceAddress;
    const governanceProposal = props?.governanceProposal;
    const cachedGovernance = props?.cachedGovernance;
    const isCancelled = props.isCancelled || false;
    const governanceLookup = props?.governanceLookup;
    const tokenMap = props?.tokenMap;
    const memberMap = props?.memberMap;
    const governanceToken = props?.governanceToken;
    const thisitem = props?.item;
    const title = props?.title;
    const description = props?.description;
    const state = props?.state;
    const isCouncil = props?.isCouncil;
    const governanceType = props?.governanceType;
    //const [thisitem, setThisItem] = React.useState(props.item);
    const realm = props?.realm;
    
    const [open, setOpen] = React.useState(false);
    
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
        setOpen(false);
    }

    const handleClickOpen = () => {
        setOpen(true);
        //getVotingParticipants();
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>

            {title ? 
                <Tooltip title={description ? description : `Get Voting Details for this Proposal`}>
                    <Button 
                        onClick={handleClickOpen}
                        color='inherit'
                        sx={{textAlign:'left',textTransform:'none',borderRadius:'17px'}}>
                          <Typography variant="h6" 
                            color={(state === 2) ? `white` : `gray`}
                            sx={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>
                              {title}
                              {isCouncil &&
                                <Tooltip title='Council Vote'><Button color='inherit' sx={{ml:1,borderRadius:'17px'}}><AssuredWorkloadIcon sx={{ fontSize:16 }} /></Button></Tooltip>
                              }

                              {governanceType === 0 ?
                                  <></>
                              :
                                  <>
                                      {governanceType === 1 ?
                                          <></>
                                      :
                                      <Tooltip title='NFT Vote'><Button color='inherit' sx={{ml:1,borderRadius:'17px'}}><ImageOutlinedIcon sx={{ fontSize:16 }} /></Button></Tooltip>
                                      }
                                  </>
                              }
                        </Typography>
                    </Button>

                </Tooltip>
            :
              <Tooltip title='Get Voting Details for this Proposal'>
                  <IconButton 
                      onClick={handleClickOpen}
                      color={'inherit'}
                      sx={{  }}>
                      <ZoomOutMapIcon />
                      {/*
                      <FitScreenIcon />*/}
                  </IconButton>
              </Tooltip>
            }

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
                    Proposal Details
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <GovernanceProposalV2View 
                        governanceLookup={governanceLookup} 
                        isCancelled={isCancelled} 
                        governanceAddress={governanceAddress} 
                        governanceProposal={governanceProposal}
                        cachedGovernance={cachedGovernance} 
                        item={thisitem} 
                        realm={realm} 
                        tokenMap={tokenMap} 
                        memberMap={memberMap} 
                        governanceToken={governanceToken} />
                                            
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}