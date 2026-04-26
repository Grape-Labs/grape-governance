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
import ForumIcon from '@mui/icons-material/Forum';
import LanguageIcon from '@mui/icons-material/Language';
import BookIcon from '@mui/icons-material/Book';
import { APP_VERSION } from '../appVersion';

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
          {"About Governance.so"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.75, mb: 2 }}>
            Version {APP_VERSION}
          </Typography>
          <DialogContentText id="alert-dialog-description">
            <Typography variant="body1" gutterBottom>
              <strong>Governance.so</strong> is a faster, richer interface for SPL Governance on Solana. It gives DAOs and contributors a clean place to discover organizations, inspect proposals, follow live voting activity, and act on governance without feeling like they are navigating raw on-chain data.
            </Typography>

            <Typography variant="body1" gutterBottom>
              The product combines indexed governance data with direct on-chain context so proposal pages load quickly while still surfacing the details that matter: proposal author, state, voting progress, participation, instructions, treasury actions, and execution context.
            </Typography>

            <Typography variant="body1" gutterBottom>
              Governance.so is more than a proposal viewer. The platform includes a DAO directory, wallet-based governance profiles, a cross-DAO <strong>Realtime</strong> feed, and proposal tooling that supports treasury workflows, instruction-aware actions, and plugin-based governance extensions.
            </Typography>

            <Typography variant="body1" gutterBottom>
              It also pushes toward more accessible participation with flows like <strong>Frictionless Governance</strong>, helping governance feel easier to follow, easier to understand, and easier to execute for both power users and everyday contributors.
            </Typography>

            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', mt: 2 }}>
              “Governance infrastructure that feels live, legible, and usable.”
            </Typography>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                color="primary"
                href="https://grapedao.gitbook.io"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<BookIcon />}
                sx={{ mr: 1, mb: 1 }}
              >
                Open Documentation
              </Button>
              <Button
                variant="outlined"
                color="primary"
                href="https://grapedao.org"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<LanguageIcon />}
                sx={{ mr: 1, mb: 1 }}
              >
                Visit Grape DAO
              </Button>
              <Button
                variant="outlined"
                color="primary"
                href="https://discord.gg/grapedao"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<ForumIcon />}
                sx={{ mb: 1 }}
              >
                Join Discord
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
