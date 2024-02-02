import * as React from 'react';

import {
    Typography,
    Card,
    CardHeader,
    CardMedia,
    CardContent,
    CardActions,
    Collapse,
    Button,
    Grid,
    Box,
    Paper,
    Avatar,
    Table,
    TableContainer,
    TableCell,
    TableHead,
    TableBody,
    TableFooter,
    TableRow,
    TablePagination,
    Tooltip,
    CircularProgress,
    LinearProgress,
    IconButton,
    Menu,
    MenuItem,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Skeleton,
    Badge,
    Divider,
    Chip,
    Snackbar,
    Alert,
    Dialog,
    DialogContentText,
    MobileStepper,
    Stepper,
    Step,
    StepButton,
    ListItemIcon,
  } from '@mui/material/';

import PersonAdd from '@mui/icons-material/PersonAdd';
import Settings from '@mui/icons-material/Settings';
import Logout from '@mui/icons-material/Logout';
import ExtensionIcon from '@mui/icons-material/Extension';

import ClaimExtensionView from './ClaimView';
import DemoExtensionView from './DemoView';

export default function ExtensionsMenuView(props: any) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  //const open = Boolean(anchorEl);
  const [open, setOpen] = React.useState(false);
  const governanceNativeWallet = props?.governanceNativeWallet;
  const expandedLoader = props?.expandedLoader;
  const setExpandedLoader = props?.setExpandedLoader;
  const instructions = props?.instructions;
  const setInstructions = props?.setInstructions;
  

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setOpen(true);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setOpen(false);
  };
  return (
    <React.Fragment>
        <Tooltip title="Extensions">
          <IconButton
            onClick={handleClick}
            size="small"
            aria-controls={open ? 'account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
          >
            <ExtensionIcon />
          </IconButton>
        </Tooltip>
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        //onClick={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&::before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <ClaimExtensionView
            handleCloseExtMenu={handleClose}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <DemoExtensionView
            handleCloseExtMenu={handleClose}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
      </Menu>
    </React.Fragment>
  );
}