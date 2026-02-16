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
    Switch,
  } from '@mui/material/';

import PersonAdd from '@mui/icons-material/PersonAdd';
import Settings from '@mui/icons-material/Settings';
import Logout from '@mui/icons-material/Logout';
import ExtensionIcon from '@mui/icons-material/Extension';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import SendExtensionView from './SendView';
import JupDcaExtensionView from './JupDcaView';
import DirectoryExtensionView from './DirectoryView';
import DistributorExtensionView from './DistributorView';
import CustomIxView from './CustomIxView';
import StakeValidatorView from './StakeValidatorView';
import ClaimExtensionView from './ClaimView';
import TokenManagerView from './TokenManagerView';
import DemoExtensionView from './DemoView';
import GovernanceConfigView from './GovernanceConfigView';
import DraftProposalView from './DraftProposalView';
import CreatePollView from './CreatePollView';
import SnsDomainView from './SnsDomainView';
import MemoIxView from './MemoIxView';
import BatchSendView from './BatchSendView';
import JupiterSwapView from './JupiterSwapView';
import DecommissionView from './DecommissionView';
import CreateTreasuryWalletProposalButton from '../CreateTreasuryWalletProposalButton';

export default function ExtensionsMenuView(props: any) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [governanceToolsAnchorEl, setGovernanceToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  //const open = Boolean(anchorEl);
  const [open, setOpen] = React.useState(false);
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceWallets = props?.governanceWallets;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const expandedLoader = props?.expandedLoader;
  const setExpandedLoader = props?.setExpandedLoader;
  const instructions = props?.instructions;
  const setInstructions = props?.setInstructions;
  const instructionQueue = props?.instructionQueue;
  const clearInstructionQueue = props?.clearInstructionQueue;
  const queueOnlyMode = !!props?.queueOnlyMode;
  const setQueueOnlyMode = props?.setQueueOnlyMode;
  const masterWallet = props?.masterWallet;
  const usdcValue = props?.usdcValue;

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setOpen(true);
  };

  const handleOpenGovernanceTools = (event: React.MouseEvent<HTMLElement>) => {
    setGovernanceToolsAnchorEl(event.currentTarget);
  };

  const handleCloseGovernanceTools = () => {
    setGovernanceToolsAnchorEl(null);
  };

  const handleCloseAllMenus = () => {
    handleCloseGovernanceTools();
    handleClose();
  };

  const handleClose = () => {
    setAnchorEl(null);
    setGovernanceToolsAnchorEl(null);
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
        <DemoExtensionView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <Divider />
        <MenuItem
          onClick={handleOpenGovernanceTools}
          aria-haspopup="true"
          aria-expanded={Boolean(governanceToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Governance Tools</ListItemText>
          <KeyboardArrowRightIcon fontSize="small" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            if (typeof setQueueOnlyMode === 'function') {
              setQueueOnlyMode(!queueOnlyMode);
            }
          }}
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Queue Instructions Only</ListItemText>
          <Switch
            size="small"
            checked={queueOnlyMode}
            onChange={(event) => {
              event.stopPropagation();
              if (typeof setQueueOnlyMode === 'function') {
                setQueueOnlyMode(event.target.checked);
              }
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </MenuItem>
        <Divider />
        <DraftProposalView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader}
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <CreatePollView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader}
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
            instructionQueue={instructionQueue}
            clearInstructionQueue={clearInstructionQueue}
        />
        <Divider />
        <SendExtensionView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
            masterWallet={masterWallet}
            usdcValue={usdcValue}
        />
        <BatchSendView
          realm={realm}
          handleCloseExtMenu={handleClose}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
          masterWallet={masterWallet}
          usdcValue={usdcValue}
        />
        {/*(governanceNativeWallet === '614CZK9HV9zPcKiCFnhaCL9yX5KjAVNPEK9GJbBtxUZ8' ||
          governanceNativeWallet === '6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD'  ||
          governanceNativeWallet === 'AWaMVkukciGYPEpJbnmSXPJzVxuuMFz1gWYBkznJ2qbq' 
        ) && */}
        <TokenManagerView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <MemoIxView
          realm={realm}
          rulesWallet={rulesWallet}
          handleCloseExtMenu={handleClose}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader} 
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <SnsDomainView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader}
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        
        {/*(governanceNativeWallet === '614CZK9HV9zPcKiCFnhaCL9yX5KjAVNPEK9GJbBtxUZ8' ||
          governanceNativeWallet === '3BEvopNQ89zkM4r6ADva18i5fao1sqR1pmswyQyfj838'
         ) && */}
          <JupDcaExtensionView
              realm={realm}
              handleCloseExtMenu={handleClose}
              rulesWallet={rulesWallet}
              governanceNativeWallet={governanceNativeWallet}
              expandedLoader={expandedLoader} 
              setExpandedLoader={setExpandedLoader}
              instructions={instructions}
              setInstructions={setInstructions}
              masterWallet={masterWallet}
              usdcValue={usdcValue}
          />
        
        <JupiterSwapView
          realm={realm}
          handleCloseExtMenu={handleClose}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <DirectoryExtensionView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <CustomIxView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <StakeValidatorView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <ClaimExtensionView
            realm={realm}
            handleCloseExtMenu={handleClose}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
      </Menu>
      <Menu
        anchorEl={governanceToolsAnchorEl}
        id="governance-tools-submenu"
        open={Boolean(governanceToolsAnchorEl)}
        onClose={handleCloseGovernanceTools}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <GovernanceConfigView 
            realm={realm}
            handleCloseExtMenu={handleCloseAllMenus}
            rulesWallet={rulesWallet}
            governanceWallets={governanceWallets}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader} 
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <DecommissionView
            realm={realm}
            handleCloseExtMenu={handleCloseAllMenus}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader}
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
        />
        <CreateTreasuryWalletProposalButton
            realm={realm}
            governanceAddress={props?.governanceAddress || realm?.pubkey?.toBase58?.()}
            governanceWallets={governanceWallets}
            handleCloseExtMenu={handleCloseAllMenus}
            renderAsMenuItem
        />
      </Menu>
    </React.Fragment>
  );
}
