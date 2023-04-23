import * as React from 'react';

import {
    Box,
    Typography,
    Button,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogActions,
    DialogContent,
    DialogContentText,
} from '@mui/material';

import InfoIcon from '@mui/icons-material/Info';

export default function AboutDialog() {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
       <Tooltip title={`About`}>
            <IconButton sx={{mt:1,mb:1,borderRadius:'17px'}} onClick={handleClickOpen}>
                <InfoIcon sx={{mr:1}} /> About
            </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"About"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
                <p>
                    <Typography variant='subtitle1'>An increbibly fast DAO Tooling infrastrastructure to improve the experience of SPL Governance via decentralized cached storage & introducing new ways to view historical data & extract important governance metrics which currently is difficult to achieve efficiently, and finally to provide an API where composing on SPL Governance will be accessible to any developer (even a new developer) with a minimum RPC burden. Ultimately we have achieved Web2 load speeds, with an incredible Web3 DAO primitive (SPL Governance), and this is the path to build tools for the next billion users that will board crypto by making their experience of crypto seamless & transparent.</Typography>
                    <Typography variant='subtitle1' sx={{textAlign:'center'}}>
                    <i>"Building the Web3 infrustructure at Web2 Native Speeds!"</i>
                    </Typography>
                </p>
                <p>           
                    <Typography variant='h6'>
                        What we built
                    </Typography>
                    <Typography variant='body2'>
                        <ul>
                            <li>UI Interfaces for simulating RPC/Cached experience for realms (created)</li>
                            <li>Administrator UI for for fetching historical and up to date SPL Governance proposals along with participation (created)</li>
                            <li>Proof of speed improvements in the respective UIs (cached storage can be fetched in less than 1 second)</li>
                        </ul>
                    </Typography>
                </p>
                <p>
                    <Typography variant='h6'>
                        Why did we build it
                    </Typography>
                    <Typography variant='body2'>
                        <ul>
                            <li>SPL Governance is slow for the average governance user (30+ seconds to load a governance), this results to a diminished user experience and potentially drives away participation</li>
                            <li>Most importantly this delay potentially reduces the ability to onboard traditional Web2 businesses to Web3, and secure mass adoption</li>
                            <li>If we are to board the next billion users, we need to speed things up</li>
                            <li>Historical data is by nature historic on the blockchain and as a result via traditional fetching methods are expensive, significantly slow, RPC heavy, and redundant</li>
                        </ul>
                    </Typography>
                </p>
                <p>
                    <Typography variant='h6'>
                        Next Steps...
                    </Typography>
                    <Typography variant='body2'>
                        <ul>
                            <Typography variant='subtitle1'>Phase 1</Typography>
                            <li>Continue to focus on building a unique, and incredibly fast SPL Governance experience</li>
                            <li>Build a directory to view active DAOs on Solana accessible via our cached storage</li>
                            <li>Display easy to understand exportable metrics to add an understanding on SPL Governance participation, trends, activity</li>
                            <li>Provide metrics solutions run by the unique cached storage</li>
                            <li>Show members in any given Governance and a summary of the holders</li>
                            <li>Treasury cached per governance</li>
                            <li>Automate the caching process with smart webhooks (upon proposal creation, completion and participation)</li>
                        </ul>
                        <ul>     
                            <Typography variant='subtitle1'>Phase 2</Typography>
                            <li>Improve NFT Governance, reliability & speed</li>
                            <li>Create an improved NFT SPL Governance Experience for mass adoption</li>
                            <li>Create SPL Governance plugins and begin working to capture true web2 companies to convert and use SPL Governance in the most transparent possible way</li>
                            <li>API Access for improved composability over SPL Governance</li>
                            <li>Add more decentralized storage pools</li>
                        </ul>
                    
                    </Typography>
                </p>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} autoFocus>
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}