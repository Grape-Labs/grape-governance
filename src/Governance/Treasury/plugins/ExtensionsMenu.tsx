import * as React from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material/';

import ExtensionIcon from '@mui/icons-material/Extension';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import SettingsIcon from '@mui/icons-material/Settings';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import BadgeIcon from '@mui/icons-material/Badge';
import HubIcon from '@mui/icons-material/Hub';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import SendExtensionView from './SendView';
import JupDcaExtensionView from './JupDcaView';
import DirectoryExtensionView from './DirectoryView';
import MythicMetadataView from './MythicMetadataView';
import TokenMetadataView from './TokenMetadataView';
import CustomIxView from './CustomIxView';
import StakeValidatorView from './StakeValidatorView';
import ClaimExtensionView from './ClaimView';
import TokenManagerView from './TokenManagerView';
import TokenHousekeepingView from './TokenHousekeepingView';
import DemoExtensionView from './DemoView';
import GovernanceConfigView from './GovernanceConfigView';
import DraftProposalView from './DraftProposalView';
import CreatePollView from './CreatePollView';
import SnsDomainView from './SnsDomainView';
import MemoIxView from './MemoIxView';
import BatchSendView from './BatchSendView';
import JupiterSwapView from './JupiterSwapView';
import SanctumSwapView from './SanctumSwapView';
import StreamflowView from './StreamflowView';
import IntraDAOView from './IntraDAOView';
import DecommissionView from './DecommissionView';
import CreateTreasuryWalletProposalButton from '../CreateTreasuryWalletProposalButton';
import { IntegratedGovernanceProposalDialogView } from '../../IntegratedGovernanceProposal';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { PublicKey } from '@solana/web3.js';
import { shortenString } from '../../../utils/grapeTools/helpers';

export default function ExtensionsMenuView(props: any) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [governanceToolsAnchorEl, setGovernanceToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [proposalToolsAnchorEl, setProposalToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [treasuryToolsAnchorEl, setTreasuryToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [defiToolsAnchorEl, setDefiToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [identityToolsAnchorEl, setIdentityToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [intraDaoToolsAnchorEl, setIntraDaoToolsAnchorEl] = React.useState<null | HTMLElement>(null);
  const [infoToolsAnchorEl, setInfoToolsAnchorEl] = React.useState<null | HTMLElement>(null);

  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceWallets = props?.governanceWallets;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const connectedWallet = props?.connectedWallet;
  const tokenMap = props?.tokenMap;
  const communityMintDecimals = props?.communityMintDecimals;
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
  const triggerLabel =
    typeof props?.triggerLabel === 'string' ? props.triggerLabel.trim() : '';
  const useAddTrigger = !!props?.useAddTrigger;
  const triggerTooltip = useAddTrigger ? 'Create Action' : 'Extensions';
  const hasSanctumApiKey = !!process.env.APP_SANCTUM_API_KEY?.trim();
  const toBase58Safe = (value: any): string => {
    try {
      if (!value) return '';
      if (typeof value === 'string') return new PublicKey(value).toBase58();
      if (typeof value?.toBase58 === 'function') return value.toBase58();
      return new PublicKey(value).toBase58();
    } catch {
      return '';
    }
  };
  const rulesWalletAddress = rulesWallet?.pubkey
    ? new PublicKey(rulesWallet.pubkey).toBase58()
    : '';
  const realmName = `${realm?.account?.name || realm?.name || ''}`.trim() || 'N/A';
  const councilMintAddress = toBase58Safe(realm?.account?.config?.councilMint);
  const communityMintAddress = toBase58Safe(realm?.account?.communityMint || realm?.communityMint);
  const shortRulesWalletAddress = rulesWalletAddress
    ? shortenString(rulesWalletAddress, 5, 5)
    : 'N/A';
  const shortNativeWalletAddress = governanceNativeWallet
    ? shortenString(governanceNativeWallet, 5, 5)
    : 'N/A';
  const shortConnectedWalletAddress = connectedWallet
    ? shortenString(connectedWallet, 5, 5)
    : 'N/A';
  const shortCouncilMintAddress = councilMintAddress
    ? shortenString(councilMintAddress, 5, 5)
    : 'N/A';
  const shortCommunityMintAddress = communityMintAddress
    ? shortenString(communityMintAddress, 5, 5)
    : 'N/A';
  const baseVotingHours = rulesWallet?.account?.config?.baseVotingTime
    ? ((Number(rulesWallet.account.config.baseVotingTime) / 60) / 60).toFixed(0)
    : 'N/A';
  const holdUpHours =
    rulesWallet?.account?.config?.minInstructionHoldUpTime &&
    Number(rulesWallet.account.config.minInstructionHoldUpTime) > 0
      ? ((Number(rulesWallet.account.config.minInstructionHoldUpTime) / 60) / 60).toFixed(0)
      : null;
  const coolOffHours =
    rulesWallet?.account?.config?.votingCoolOffTime &&
    Number(rulesWallet.account.config.votingCoolOffTime) > 0
      ? ((Number(rulesWallet.account.config.votingCoolOffTime) / 60) / 60).toFixed(0)
      : null;
  const councilThreshold = rulesWallet?.account?.config?.councilVoteThreshold?.value ?? null;
  const communityThreshold = rulesWallet?.account?.config?.communityVoteThreshold?.value ?? null;
  const minCouncilRaw = `${rulesWallet?.account?.config?.minCouncilTokensToCreateProposal ?? ''}`;
  const councilCreationDisabled = minCouncilRaw === '' || minCouncilRaw === '18446744073709551615';
  const councilCreationMinDisplay = councilCreationDisabled
    ? 'N/A'
    : (() => {
        const n = Number(minCouncilRaw);
        if (!Number.isFinite(n)) return minCouncilRaw || 'N/A';
        return n.toLocaleString();
      })();
  const minCommunityRaw = `${rulesWallet?.account?.config?.minCommunityTokensToCreateProposal ?? ''}`;
  const communityCreationDisabled = minCommunityRaw === '' || minCommunityRaw === '18446744073709551615';
  const communityCreationMinDisplay = communityCreationDisabled
    ? 'N/A'
    : (() => {
        const n = Number(minCommunityRaw);
        if (!Number.isFinite(n)) return minCommunityRaw || 'N/A';
        if (communityMintDecimals) return (n / 10 ** Number(communityMintDecimals)).toLocaleString();
        return n.toLocaleString();
      })();
  const queuedInstructionSetsCount = Array.isArray(instructionQueue) ? instructionQueue.length : 0;
  const allowedLegacyProposalDaos = React.useMemo(
    () =>
      new Set<string>([
        'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2',
        'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip',
      ]),
    []
  );
  const showLegacyCreateProposalButton =
    !!connectedWallet && !!rulesWalletAddress && allowedLegacyProposalDaos.has(governanceAddress);

  const closeSubmenus = () => {
    setGovernanceToolsAnchorEl(null);
    setProposalToolsAnchorEl(null);
    setTreasuryToolsAnchorEl(null);
    setDefiToolsAnchorEl(null);
    setIdentityToolsAnchorEl(null);
    setIntraDaoToolsAnchorEl(null);
    setInfoToolsAnchorEl(null);
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
      <Tooltip title={triggerTooltip}>
        {triggerLabel ? (
          <Button
            onClick={handleClick}
            size="small"
            variant="outlined"
            startIcon={useAddTrigger ? <AddIcon fontSize="small" /> : <ExtensionIcon fontSize="small" />}
            aria-controls={menuOpen ? 'account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              borderColor: 'rgba(255,255,255,0.24)',
              color: 'white',
              minWidth: 0,
              px: 1.2,
            }}
          >
            {triggerLabel}
          </Button>
        ) : (
          <IconButton
            onClick={handleClick}
            size={useAddTrigger ? 'medium' : 'small'}
            aria-controls={menuOpen ? 'account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
            sx={
              useAddTrigger
                ? {
                    width: 34,
                    height: 34,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  }
                : undefined
            }
          >
            {useAddTrigger ? <AddIcon fontSize="small" /> : <ExtensionIcon />}
          </IconButton>
        )}
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
        {showLegacyCreateProposalButton && (
          <Box>
            <IntegratedGovernanceProposalDialogView
              governanceAddress={governanceAddress}
              intraDao={false}
              governanceRulesWallet={new PublicKey(rulesWalletAddress)}
              realm={realm}
              tokenMap={tokenMap}
              governanceWallets={governanceWallets}
              useButton={4}
              useButtonText={'Create Proposal (Legacy Builder)'}
              title="Create Proposal"
            />
          </Box>
        )}

        {showLegacyCreateProposalButton && <Divider />}

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
          onClick={handleOpenSubmenu(setInfoToolsAnchorEl)}
          aria-haspopup="true"
          aria-expanded={Boolean(infoToolsAnchorEl) ? 'true' : undefined}
        >
          <ListItemIcon>
            <InfoOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Info</ListItemText>
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
        <TokenHousekeepingView
          realm={realm}
          governanceAddress={props?.governanceAddress || realm?.pubkey?.toBase58?.()}
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
        {hasSanctumApiKey && (
          <SanctumSwapView
            realm={realm}
            governanceAddress={props?.governanceAddress || realm?.pubkey?.toBase58?.()}
            handleCloseExtMenu={handleCloseAllMenus}
            rulesWallet={rulesWallet}
            governanceNativeWallet={governanceNativeWallet}
            expandedLoader={expandedLoader}
            setExpandedLoader={setExpandedLoader}
            instructions={instructions}
            setInstructions={setInstructions}
          />
        )}
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
        <TokenMetadataView
          realm={realm}
          governanceAddress={props?.governanceAddress || realm?.pubkey?.toBase58?.()}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
        <MythicMetadataView
          realm={realm}
          governanceAddress={props?.governanceAddress || realm?.pubkey?.toBase58?.()}
          handleCloseExtMenu={handleCloseAllMenus}
          rulesWallet={rulesWallet}
          governanceNativeWallet={governanceNativeWallet}
          expandedLoader={expandedLoader}
          setExpandedLoader={setExpandedLoader}
          instructions={instructions}
          setInstructions={setInstructions}
        />
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

      <Menu
        anchorEl={infoToolsAnchorEl}
        id="info-tools-submenu"
        open={Boolean(infoToolsAnchorEl)}
        onClose={() => setInfoToolsAnchorEl(null)}
        {...submenuPosition}
      >
        <Box sx={{ minWidth: 340, px: 2, pt: 1.5, pb: 1 }}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              px: 1.25,
              py: 1,
              bgcolor: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Wallet Summary
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Realm: {realmName}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Governance: {governanceAddress ? shortenString(governanceAddress, 5, 5) : 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Connected: {shortConnectedWalletAddress}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Voting: {baseVotingHours}h
              {holdUpHours ? ` | HoldUp: ${holdUpHours}h` : ''}
              {coolOffHours ? ` | CoolOff: ${coolOffHours}h` : ''}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Thresholds: Council {councilThreshold ?? 'N/A'}%
              {communityThreshold !== null ? ` | Community ${communityThreshold}%` : ''}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Proposal Min: Council {councilCreationMinDisplay} | Community {communityCreationMinDisplay}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Mints: Council {shortCouncilMintAddress} | Community {shortCommunityMintAddress}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>
              Queue: {queueOnlyMode ? 'Queue Only' : 'Direct Proposal'} | Pending Sets: {queuedInstructionSetsCount}
            </Typography>
          </Box>
        </Box>

        <CopyToClipboard text={governanceNativeWallet || ''}>
          <MenuItem disabled={!governanceNativeWallet} sx={{ mx: 1, borderRadius: 1.5 }}>
            <ListItemIcon>
              <AccountBalanceWalletIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Native Wallet"
              secondary={
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {shortNativeWalletAddress} (click to copy)
                </Typography>
              }
            />
          </MenuItem>
        </CopyToClipboard>

        <CopyToClipboard text={rulesWalletAddress || ''}>
          <MenuItem disabled={!rulesWalletAddress} sx={{ mx: 1, borderRadius: 1.5 }}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Rules Wallet"
              secondary={
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {shortRulesWalletAddress} (click to copy)
                </Typography>
              }
            />
          </MenuItem>
        </CopyToClipboard>
      </Menu>
    </React.Fragment>
  );
}
