import * as React from 'react';
import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
} from '@mui/material/';

import ExtensionIcon from '@mui/icons-material/Extension';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import SettingsIcon from '@mui/icons-material/Settings';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import BadgeIcon from '@mui/icons-material/Badge';
import HubIcon from '@mui/icons-material/Hub';

import SendExtensionView from './SendView';
import JupDcaExtensionView from './JupDcaView';
import DirectoryExtensionView from './DirectoryView';
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
import StreamflowView from './StreamflowView';
import IntraDAOView from './IntraDAOView';
import DecommissionView from './DecommissionView';
import CreateTreasuryWalletProposalButton from '../CreateTreasuryWalletProposalButton';

export default function ExtensionsMenuView(props: any) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [governanceToolsAnchorEl, setGovernanceToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [proposalToolsAnchorEl, setProposalToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [treasuryToolsAnchorEl, setTreasuryToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [defiToolsAnchorEl, setDefiToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [identityToolsAnchorEl, setIdentityToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [intraDaoToolsAnchorEl, setIntraDaoToolsAnchorEl] = React.useState<null | HTMLElement>(null);

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

  const closeSubmenus = () => {
    setGovernanceToolsAnchorEl(null);
    setProposalToolsAnchorEl(null);
    setTreasuryToolsAnchorEl(null);
    setDefiToolsAnchorEl(null);
    setIdentityToolsAnchorEl(null);
    setIntraDaoToolsAnchorEl(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    closeSubmenus();
  };

  const handleCloseAllMenus = () => {
    handleClose();
  };

  const handleOpenSubmenu =
    (setter: React.Dispatch<React.SetStateAction<HTMLElement | null>>) =>
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      closeSubmenus();
      setter(event.currentTarget);
    };

  const menuOpen = Boolean(anchorEl);
  const submenuPosition = {
    transformOrigin: { horizontal: 'left' as const, vertical: 'top' as const },
    anchorOrigin: { horizontal: 'right' as const, vertical: 'top' as const },
  };

  return (
    <React.Fragment>
      <Tooltip title="Extensions">
        <IconButton
          onClick={handleClick}
          size="small"
          aria-controls={menuOpen ? 'account-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? 'true' : undefined}
        >
          <ExtensionIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={menuOpen}
        onClose={handleClose}
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
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />

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
            <SettingsIcon fontSize="small" />
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

        <MenuItem
          onClick={handleOpenSubmenu(setGovernanceToolsAnchorEl)}
          aria-haspopup="true"
          aria-expanded={Boolean(governanceToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Governance Tools</ListItemText>
          <KeyboardArrowRightIcon fontSize="small" />
        </MenuItem>

        <MenuItem
          onClick={handleOpenSubmenu(setProposalToolsAnchorEl)}
          aria-haspopup="true"
          aria-expanded={Boolean(proposalToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <HowToVoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Proposal Builder</ListItemText>
          <KeyboardArrowRightIcon fontSize="small" />
        </MenuItem>

        <MenuItem
          onClick={handleOpenSubmenu(setTreasuryToolsAnchorEl)}
          aria-haspopup="true"
          aria-expanded={Boolean(treasuryToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <AccountBalanceWalletIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Treasury Operations</ListItemText>
          <KeyboardArrowRightIcon fontSize="small" />
        </MenuItem>

        <MenuItem
          onClick={handleOpenSubmenu(setDefiToolsAnchorEl)}
          aria-haspopup="true"
          aria-expanded={Boolean(defiToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <AutoGraphIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>DeFi & Automation</ListItemText>
          <KeyboardArrowRightIcon fontSize="small" />
        </MenuItem>

        <MenuItem
          onClick={handleOpenSubmenu(setIdentityToolsAnchorEl)}
          aria-haspopup="true"
          aria-expanded={Boolean(identityToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <BadgeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Identity & Claims</ListItemText>
          <KeyboardArrowRightIcon fontSize="small" />
        </MenuItem>

        <MenuItem
          onClick={handleOpenSubmenu(setIntraDaoToolsAnchorEl)}
          aria-haspopup="true"
          aria-expanded={Boolean(intraDaoToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <HubIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>IntraDAO</ListItemText>
          <KeyboardArrowRightIcon fontSize="small" />
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={governanceToolsAnchorEl}
        id="governance-tools-submenu"
        open={Boolean(governanceToolsAnchorEl)}
        onClose={() => setGovernanceToolsAnchorEl(null)}
        {...submenuPosition}
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

      <Menu
        anchorEl={proposalToolsAnchorEl}
        id="proposal-tools-submenu"
        open={Boolean(proposalToolsAnchorEl)}
        onClose={() => setProposalToolsAnchorEl(null)}
        {...submenuPosition}
      >
        <DraftProposalView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <CreatePollView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
          instructionQueue={instructionQueue}
          clearInstructionQueue={clearInstructionQueue}
        />
        <CustomIxView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
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
          handleCloseExtMenu={handleCloseAllMenus}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
      </Menu>

      <Menu
        anchorEl={treasuryToolsAnchorEl}
        id="treasury-tools-submenu"
        open={Boolean(treasuryToolsAnchorEl)}
        onClose={() => setTreasuryToolsAnchorEl(null)}
        {...submenuPosition}
      >
        <SendExtensionView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
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
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
          masterWallet={masterWallet}
          usdcValue={usdcValue}
        />
        <TokenManagerView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <StakeValidatorView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
      </Menu>

      <Menu
        anchorEl={defiToolsAnchorEl}
        id="defi-tools-submenu"
        open={Boolean(defiToolsAnchorEl)}
        onClose={() => setDefiToolsAnchorEl(null)}
        {...submenuPosition}
      >
        <JupDcaExtensionView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
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
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <StreamflowView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
      </Menu>

      <Menu
        anchorEl={identityToolsAnchorEl}
        id="identity-tools-submenu"
        open={Boolean(identityToolsAnchorEl)}
        onClose={() => setIdentityToolsAnchorEl(null)}
        {...submenuPosition}
      >
        <SnsDomainView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <DirectoryExtensionView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <ClaimExtensionView
          realm={realm}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
      </Menu>

      <Menu
        anchorEl={intraDaoToolsAnchorEl}
        id="intradao-tools-submenu"
        open={Boolean(intraDaoToolsAnchorEl)}
        onClose={() => setIntraDaoToolsAnchorEl(null)}
        {...submenuPosition}
      >
        <IntraDAOView
          realm={realm}
          governanceAddress={props?.governanceAddress || realm?.pubkey?.toBase58?.()}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
          instructionQueue={instructionQueue}
          clearInstructionQueue={clearInstructionQueue}
        />
      </Menu>
    </React.Fragment>
  );
}
