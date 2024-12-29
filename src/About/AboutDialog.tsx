import * as React from 'react';

import {
    Box,
    Typography,
    Button,
    IconButton,
    ListItemButton,
    ListItemIcon,
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
       <Tooltip title={`About`} placement="right" arrow>
          <ListItemButton
              sx={{}} 
              onClick={handleClickOpen}>
                <ListItemIcon><InfoIcon /> </ListItemIcon>
                <Typography variant="h6">About</Typography>
            </ListItemButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Governance by Grape"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
                <p>
                    <Typography variant='body1'>
                    Grape offers an incredibly fast DAO tooling infrastructure designed to enhance the SPL Governance experience. We introduce innovative ways to utilize SPL Governance through an easy-to-use interface, enabling users to view historical data and extract essential governance metrics—tasks that have been challenging to perform efficiently. Additionally, we provide an API that allows any developer to compose on SPL Governance with minimal RPC overhead. Our platform achieves Web2-like load speeds while leveraging the powerful Web3 DAO primitive (SPL Governance). This seamless and transparent experience paves the way for building tools that can onboard the next billion users to crypto.
                    <br/><br/>
                    Our development doesn’t stop there. We showcase tools like "Realtime" and demonstrate real-world use cases for organizations through simulations using "Frictionless" proposal authors. DAOs require even more tools, and Governance.so delivers a comprehensive suite of plugins. Our full IntraDAO tooling enables existing DAOs to join and participate in voting processes within other DAOs. Moreover, our groundbreaking IntraDAO proposal creation leverages Grape and Integration Partners' extensive plugin suite to craft proposals, revolutionizing DAO tooling within the Solana ecosystem.
                    <br/><br/>
                    <i>“Building the Web3 infrastructure at Web2 Native Speeds!”</i>
                    </Typography>
                </p>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
          variant='outlined'
          onClick={handleClose} autoFocus>
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}