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
            <Typography variant="body1" gutterBottom>
              <strong>Grape Governance</strong> delivers a lightning-fast DAO infrastructure that enhances the SPL Governance experience on Solana. Our intuitive interface simplifies the process of viewing historical proposals and extracting key governance metrics—tasks that were once complex and slow.
            </Typography>

            <Typography variant="body1" gutterBottom>
              Built using a robust API that allows developers to build on SPL Governance with minimal RPC overhead. The result: Web2-like speeds, powered entirely by the decentralized Web3 stack.
            </Typography>

            <Typography variant="body1" gutterBottom>
              But we don’t stop there. With tools like <strong>Realtime</strong> and <strong>Frictionless</strong>, Governance.so introduces innovative workflows for DAOs. Our comprehensive plugin system supports everything from proposal simulations to cross-DAO participation.
            </Typography>

            <Typography variant="body1" gutterBottom>
              Our <strong>IntraDAO</strong> tooling enables DAOs to create, join, and vote on proposals across organizational boundaries—unlocking new levels of interoperability in governance.
            </Typography>

            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', mt: 2 }}>
              “Building the Web3 infrastructure at Web2 native speeds.”
            </Typography>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                color="primary"
                href="https://grape-governance.gitbook.io/gspl"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<i className="fas fa-book" />}
              >
                Open Documentation
              </Button>
            </Box>
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