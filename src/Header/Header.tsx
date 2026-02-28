import * as React from 'react';
import { styled, alpha } from '@mui/material/styles';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useNavigate } from 'react-router';
import {CopyToClipboard} from 'react-copy-to-clipboard';

import { useSnackbar } from 'notistack';

import MuiAlert, { AlertProps } from '@mui/material/Alert';
import Snackbar, { SnackbarOrigin } from '@mui/material/Snackbar';

import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

import '@khmyznikov/pwa-install';

import { 
    APP_LOGO,
    APP_ICON,
    APP_CLUSTER,
    getPreferredRpc,
    getPreferredCluster,
    setPreferredCluster,
    setPreferredRpc,
    type AppCluster,
    RPC_OPTIONS,
} from '../utils/grapeTools/constants';

import {
    buildDirectoryFromGraphQL,
    getRealmsIndexed,
    govOwners,
} from '../Governance/api/queries';

import {
    WalletDialogProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-material-ui';

import { useAddToHomescreenPrompt } from "./useAddToHomeScreen";

import {
    Box,
    Toolbar,
    Typography,
    Button,
    Menu,
    Tooltip,
    Drawer,
    Dialog,
    DialogTitle,
    DialogActions,
    DialogContent,
    Divider,
    InputBase,
    Paper,
    Container,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Autocomplete,
    TextField,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    MenuItem,
    ToggleButtonGroup,
    ToggleButton,
    Chip,
    Stack,
} from '@mui/material';

import ClickAwayListener from '@mui/material/ClickAwayListener';

import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';

import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import MenuIcon from '@mui/icons-material/Menu';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import BurstModeIcon from '@mui/icons-material/BurstMode';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BookIcon from '@mui/icons-material/Book';

import AboutDialog from '../About/AboutDialog';

import { ValidateAddress } from '../utils/grapeTools/WalletAddress'; // global key handling

import { useTranslation } from 'react-i18next';

export interface State extends SnackbarOrigin {
    open: boolean;
}

type GovernanceAutocompleteOption = {
    label: string;
    value: string;
    totalProposals: number;
    totalProposalsVoting: number;
};

const DEFAULT_GOVERNANCE_PROGRAM_NAME = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

function governanceKey(value: any): string {
    return value?.toBase58?.() || (typeof value === 'string' ? value : String(value || ''));
}

function normalizeName(value: any): string {
    return String(value || '').trim();
}

function hasNamedGovernance(governanceName: string, governanceAddress?: string): boolean {
    const name = normalizeName(governanceName);
    if (!name) return false;
    if (name.toLowerCase() === 'governance') return false;

    if (governanceAddress) {
        const fallbackLabel = `Governance ${governanceAddress.slice(0, 6)}...`;
        if (name === fallbackLabel) return false;
    }

    return true;
}

declare global {
    namespace JSX {
      interface IntrinsicElements {
        'pwa-install': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      }
    }
}

function getParam(param: string) {
    //return new URLSearchParams(document.location.search).get(param);
    return new URLSearchParams(window.location.search).get(param);
}

interface HeaderProps{
    children?:React.ReactNode;
}

const drawerWidth = 275;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
}

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
  })<AppBarProps>(({ theme, open }) => ({
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
      width: `calc(100% - ${drawerWidth}px)`,
      marginLeft: `${drawerWidth}px`,
      transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
    }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));

const Search = styled('div')(({ theme }) => ({
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: alpha(theme.palette.common.white, 0.25),
    },
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(1),
      width: 'auto',
    },
  }));
  
  const SearchIconWrapper = styled('div')(({ theme }) => ({
    padding: theme.spacing(0, 2),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }));

  const StyledInputBase = styled(InputBase)(({ theme }) => ({
    color: 'inherit',
    '& .MuiInputBase-input': {
      padding: theme.spacing(1, 1, 1, 0),
      // vertical padding + font size from searchIcon
      paddingLeft: `calc(1em + ${theme.spacing(4)})`,
      transition: theme.transitions.create('width'),
      width: '100%',
      [theme.breakpoints.up('sm')]: {
        width: '12ch',
        '&:focus': {
          width: '20ch',
        },
      },
    },
  }));

  const StyledTextField = styled(TextField)(({ theme }) => ({
    color: 'inherit',
    border:'none',
    '& .MuiInputBase-input': {
      border: 'none',
        padding: theme.spacing(1, 1, 1, 0),
      // vertical padding + font size from searchIcon
      paddingLeft: `calc(1em + ${theme.spacing(4)})`,
      transition: theme.transitions.create('width'),
      width: '100%',
      [theme.breakpoints.up('sm')]: {
        width: '20ch',
        '&:focus': {
          width: '25ch',
        },
      },
    },
  }));

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref,
    ) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export function Header(props: any) {
    const { open_menu } = props;
    const [open_snackbar, setSnackbarState] = React.useState(false);
    const [tokenParam, setTokenParam] = React.useState(getParam('token'));
    const [providers, setProviders] = React.useState(['Sollet', 'Sollet Extension', 'Phantom','Solflare']);
    const [open_wallet, setOpenWallet] = React.useState(false);
    const [governanceAutocomplete, setGovernanceAutocomplete] = React.useState<GovernanceAutocompleteOption[] | null>(null);
    const [governanceAddress, setGovernanceAddress] = React.useState(null);
    const location = useLocation();
    const currPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    //const [fetchType, setFetchType] = React.useState(currPath.includes("rpcgovernance") ? "rpcgovernance" : currPath.includes("metrics") ? "metrics" : currPath.includes("members") ? "members" : currPath.includes("treasury") ? "treasury" : "cachedgovernance");
    const [fetchType, setFetchType] = React.useState(currPath.includes("rpcgovernance") ? "rpcgovernance" : "dao");
    
    const [prompt, promptToInstall] = useAddToHomescreenPrompt();
    const [showInstallAppButton, setShowInstallAppButton] = React.useState(false);
    const [anchorEl, setAnchorEl] = React.useState(null);
    const isWalletOpen = Boolean(anchorEl);
    const [newinputpkvalue, setNewInputPKValue] = React.useState("");
    const navigate = useNavigate();
    //const currPath = location?.pathname ?? "";
    const { enqueueSnackbar } = useSnackbar();
    
    const { publicKey, disconnect } = useWallet();
    const theme: 'dark' | 'light' = 'dark';
    
    //Menu
    const menuId = 'primary-wallet-account-menu';
    const menuWalletId = 'primary-fullwallet-account-menu';

    const [open, setOpen] = React.useState(false);

    const [rpcSettingsOpen, setRpcSettingsOpen] = React.useState(false);
    const handleOpenRpcSettings = () => setRpcSettingsOpen(true);
    const handleCloseRpcSettings = () => setRpcSettingsOpen(false);
    const [rpcSelectionMode, setRpcSelectionMode] =React.useState('predefined');
    const [customRpcInput, setCustomRpcInput] = React.useState('');

    const sectionCardSX = {
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 2,
        p: 2,
        };

const sectionHeaderSX = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  mb: 1.5,
};

const rowSX = { display: "flex", alignItems: "center", gap: 1 };


    const handleDrawerOpen = () => {
        setOpen(true);
    };

    const handleDrawerClose = () => {
        setOpen(false);
    };


    const handleProfileMenuOpen = (event: any) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        // this.props.parentCallback("Data from child");
    };

    const handleCloseWallet = (value: any) => {
        setOpenWallet(false);

    };

    function SimpleDialog(props: any) {
        const { onClose, selectedValue, open_wallet } = props;

        const handleCloseWallet = () => {
            onClose(selectedValue);
        };

        const handleListItemClick = (value: any) => {
            onClose(value);
        };

        return (
            <Dialog onClose={handleCloseWallet} aria-labelledby="simple-dialog-title" open={open_wallet}>
                <DialogTitle id="simple-dialog-title">{t('Select Wallet')}</DialogTitle>
                <List>
                    {providers.map((provider) => (
                        <ListItem button onClick={() => handleListItemClick(provider)} key={provider}>
                            <ListItemText primary={provider} />
                        </ListItem>
                    ))}
                </List>
            </Dialog>
        );
    }

    const testNotification = () => {
        console.log("Testing notification...");
        if (!("Notification" in window)) {
          // Check if the browser supports notifications
          alert("This browser does not support desktop notification");
        } else if (Notification.permission === "granted") {
          // Permission granted, create notification with simulated payload
          console.log("Notification permission granted");
          const notificationData = {
            title: "Test Notification",
            body: "This is a simulated push notification!",
            icon: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governanceicon.png", // Replace with your icon URL
          };
          const notification = new Notification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
          });
        } else if (Notification.permission !== "denied") {
          // Request permission and create notification if granted
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              console.log("Notification permission granted after request");
              // Same setup as above for creating the notification with payload
            }
          });
        }
      };

    const handleClickSnackbar = () => {
        enqueueSnackbar(`${t('Copied...')}`,{ variant: 'success' });
        
        handleMenuClose();
        //setSnackbarState(true);
    };

    const { t, i18n } = useTranslation();
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFetchType((event.target as HTMLInputElement).value);
      };

    const handleGovernanceSelect = (address:string) => {
        if (address && address.length >= 40){ // check if publickey){
            setGovernanceAddress(address);
            setOpen(false);
        }
    }

    const navigateToGovernance = () => {
        navigate({pathname: "/"+fetchType+"/"+governanceAddress,},{ replace: true });
    }

    const getGovernanceAutocompleteFromGraphQL = async () => {
        try {
            const realmProgramNames = Array.from(
                new Set([
                    DEFAULT_GOVERNANCE_PROGRAM_NAME,
                    ...(govOwners || []).map((owner) => owner?.name).filter((name): name is string => !!name),
                ])
            );

            const fetchAllIndexedRealms = async () => {
                const realmBatches = await Promise.all(
                    realmProgramNames.map((programName) => getRealmsIndexed(programName).catch(() => []))
                );

                const flattened: any[] = [];
                for (const batch of realmBatches) {
                    if (!Array.isArray(batch)) continue;
                    for (const entry of batch) {
                        if (Array.isArray(entry)) flattened.push(...entry);
                        else if (entry) flattened.push(entry);
                    }
                }
                return flattened;
            };

            const [graphQLDirectoryResult, indexedRealmsRaw] = await Promise.all([
                buildDirectoryFromGraphQL({ includeMembers: false, proposalScanLimit: 1500 }),
                fetchAllIndexedRealms().catch(() => []),
            ]);

            const directory = Array.isArray(graphQLDirectoryResult?.directory)
                ? graphQLDirectoryResult.directory
                : [];
            const indexedRealms = Array.isArray(indexedRealmsRaw) ? indexedRealmsRaw : [];
            const gqlByGovernance = new Map<string, any>();
            for (const item of directory) {
                const key = governanceKey(item?.governanceAddress);
                if (key) gqlByGovernance.set(key, item);
            }

            const dedupedAutocomplete = new Map<string, GovernanceAutocompleteOption>();
            for (const realmItem of indexedRealms) {
                const realmAddress = governanceKey(realmItem?.pubkey || realmItem?.account?.realm);
                if (!realmAddress || dedupedAutocomplete.has(realmAddress)) continue;
                const realmName = normalizeName(realmItem?.account?.name);

                dedupedAutocomplete.set(realmAddress, {
                    label: realmName || `Realm ${realmAddress.slice(0, 6)}...`,
                    value: realmAddress,
                    totalProposals: 0,
                    totalProposalsVoting: 0,
                });
            }

            if (dedupedAutocomplete.size === 0) {
                for (const [governanceAddress, gqlEntry] of gqlByGovernance.entries()) {
                    dedupedAutocomplete.set(governanceAddress, {
                        label: `Governance ${governanceAddress.slice(0, 6)}...`,
                        value: governanceAddress,
                        totalProposals: Number(gqlEntry?.totalProposals || 0),
                        totalProposalsVoting: Number(gqlEntry?.totalProposalsVoting || 0),
                    });
                }
            }

            const lookupAutocomplete = Array.from(dedupedAutocomplete.values()).sort((a, b) => {
                if (b.totalProposalsVoting !== a.totalProposalsVoting) {
                    return b.totalProposalsVoting - a.totalProposalsVoting;
                }
                if (b.totalProposals !== a.totalProposals) {
                    return b.totalProposals - a.totalProposals;
                }
                return (a.label || '').localeCompare(b.label || '');
            });

            if (lookupAutocomplete.length > 0) {
                setGovernanceAutocomplete(lookupAutocomplete);
            } else {
                setGovernanceAutocomplete(null);
            }
        } catch (error) {
            console.warn('Failed to load governance autocomplete from GraphQL', error);
            setGovernanceAutocomplete(null);
        }
    }

    React.useEffect(() => {
        void getGovernanceAutocompleteFromGraphQL();
    }, []);

    React.useEffect(() => {
        if (prompt) {
            setShowInstallAppButton(true);
        }
    }, [prompt]);

    React.useEffect(() => {
        if (governanceAddress && governanceAddress.length > 0){
            navigate({pathname: "/"+fetchType+"/"+governanceAddress,},{ replace: true });
        }
    }, [governanceAddress]);

    return (
        <>
            <ClickAwayListener onClickAway={handleDrawerClose}>
                <Box sx={{ display: 'flex' }}>
                
                    <AppBar position="fixed" 
                        open={open}
                        className="app-header"
                        sx={{background:'rgba(0,0,0,0.25)'}}>
                        <Toolbar
                            color="inherit"
                            >
                            
                            <IconButton
                                color="inherit"
                                aria-label="open drawer"
                                onClick={handleDrawerOpen}
                                edge="start"
                                sx={{ mr: 2, ...(open && { display: 'none' }) }}
                            >
                                <MenuIcon />
                            </IconButton>

                            <Box display='flex' flexGrow={1}>
                                <Button
                                    variant="text"
                                    color="inherit" 
                                    href='/'
                                    sx={{borderRadius:'17px',pl:1,pr:1}}
                                >
                                    <Typography
                                        component="h1"
                                        variant="h6"
                                        color="inherit"
                                        display='flex'
                                        sx={{
                                            ml:1,
                                            mr:1, 
                                            maxHeight:'40px',
                                            maxWidth:'150px'}}
                                    >
                                        <img src={APP_LOGO} className="header-logo" alt="Governance.so | Powered by Grape" />
                                    </Typography>
                                </Button>
                            </Box>
                            
                            {/*
                            <pwa-install
                                //manual-apple="true"
                                //manual-chrome="true"
                                //disable-chrome="true"
                            
                                install-description="Custom call to install text"
                                disable-install-description="true"
                                disable-screenshots="true"
                                manifest-url="/up_/manifest.webmanifest"
                                name="Governance"
                                description="Governance by Grape | Making Governance faster, better and more efficient for DAOs #OPOS"         
                                icon={APP_ICON}
                            ></pwa-install>
                            */}
                            
                            {showInstallAppButton &&
                                <div onClick={() => setShowInstallAppButton(false)}>
                                    <Tooltip title="Install Governance" sx={{mr:1}}>
                                        <IconButton
                                            onClick={promptToInstall}
                                        >
                                            <InstallMobileIcon />
                                        </IconButton>
                                    </Tooltip>
                                </div>
                            }

                            {/*(Notification && Notification.permission === "granted") ?
                                <Tooltip title="Test Notification" sx={{mr:1}}>
                                    <IconButton
                                        onClick={testNotification}
                                    >
                                        <NotificationsActiveIcon />
                                    </IconButton>
                                </Tooltip>
                        :<></>*/}                        

                            <Tooltip title="RPC Settings">
                                <IconButton onClick={handleOpenRpcSettings} sx={{ ml: 1 }}>
                                    <SettingsSuggestIcon />
                                </IconButton>
                            </Tooltip>
                            <div className="grape-wallet-adapter">
                                <WalletDialogProvider className="grape-wallet-provider">
                                    <WalletMultiButton className="grape-wallet-button" />
                                </WalletDialogProvider>
                            </div>
                        </Toolbar>
                    </AppBar>
                
                    <Drawer
                        sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            boxSizing: 'border-box',
                        },
                        }}
                        variant="persistent"
                        anchor="left"
                        open={open}
                    >
                        <DrawerHeader>
                            <IconButton onClick={handleDrawerClose}>
                                {/*theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />*/}
                                <ChevronLeftIcon />
                            </IconButton>
                            </DrawerHeader>
                            <Divider />
                            <List>
                                
                            <ListItem disablePadding>
                                <Tooltip title={`back to Directory`} placement="right" arrow>
                                    <ListItemButton 
                                        component={Link}
                                        to={'/'}
                                    >
                                    <ListItemIcon><HomeIcon/></ListItemIcon>
                                    <Typography variant="h6">Directory</Typography>
                                    </ListItemButton>
                                </Tooltip>
                            </ListItem>
                            {publicKey &&
                                <ListItem disablePadding>
                                    <Tooltip title={`View your Governance Profile`} placement="right" arrow>
                                        <ListItemButton 
                                            component={Link}
                                            to={'/profile'}
                                        >
                                        <ListItemIcon><PersonIcon /></ListItemIcon>
                                            <Typography variant="h6">Profile</Typography>
                                        </ListItemButton>
                                    </Tooltip>
                                </ListItem>
                            }

                            <ListItem disablePadding>
                                <Tooltip title={`Realtime Proposals`} placement="right" arrow>
                                    <ListItemButton 
                                        component={Link}
                                        to={'/realtime'}
                                    >
                                    <ListItemIcon><PodcastsIcon/></ListItemIcon>
                                    <Typography variant="h6">Realtime</Typography>
                                    </ListItemButton>
                                </Tooltip>
                            </ListItem>

                            <ListItem disablePadding>
                                <Tooltip title={`Governance & GSPL Documentation`} placement="right" arrow>
                                    <a
                                        href="https://grape-governance.gitbook.io/gspl"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                        >
                                        <ListItemButton>
                                            <ListItemIcon><BookIcon /></ListItemIcon>
                                            <Typography variant="h6">Documentation</Typography>
                                        </ListItemButton>
                                    </a>
                                </Tooltip>
                            </ListItem>

                            <ListItem disablePadding>
                                <AboutDialog /> 
                            </ListItem>

                            {governanceAutocomplete ? (
                                <ListItem disablePadding>
                                    <Search sx={{ mt: 1, mb: 1, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                    <Autocomplete
                                        sx={{ minWidth: '25ch', border: 'none' }}
                                        disablePortal
                                        size="small"
                                        id="combo-box-demo"
                                        options={governanceAutocomplete}
                                        getOptionLabel={(option) => option.label}
                                        onChange={(e, sel) => {
                                        if (sel?.value) handleGovernanceSelect(sel.value);
                                        }}
                                        renderOption={(props, option) => (
                                        <Box
                                            component="li"
                                            sx={{ '& > img': { mr: 2, flexShrink: 0 }, border: 'none' }}
                                            {...props}
                                        >
                                            {option.label}
                                            &nbsp;
                                            <small>
                                            (
                                            {option.totalProposalsVoting ? (
                                                <>
                                                <HowToVoteIcon sx={{ fontSize: 10 }} />{' '}
                                                <strong>{option.totalProposalsVoting}</strong> of{' '}
                                                </>
                                            ) : (
                                                ''
                                            )}
                                            {option.totalProposals})
                                            </small>
                                        </Box>
                                        )}
                                        renderInput={(params) => <TextField {...params} label="" />}
                                    />
                                    </Search>
                                </ListItem>
                                ) : (
                                <ListItem disablePadding>
                                    <Search sx={{ mt: 1, ml: 2, mb: 1 }}>
                                    <SearchIconWrapper>
                                        <SearchIcon />
                                    </SearchIconWrapper>
                                    <StyledInputBase
                                        placeholder="Enter a governance address"
                                        inputProps={{ 'aria-label': 'search' }}
                                        onChange={(e) => setGovernanceAddress(e.target.value)}
                                    />
                                    </Search>
                                </ListItem>
                                )}
                            </List>
                    </Drawer>
                </Box>
            </ClickAwayListener>
<Dialog
  open={rpcSettingsOpen}
  onClose={handleCloseRpcSettings}
  fullWidth
  maxWidth="sm"
  PaperProps={{
    sx: {
      borderRadius: 6,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.10)",
      background: "#13151C", // matches your other dialogs
    },
  }}
>
  {/* Header */}
  <DialogTitle
    sx={{
      px: 2.25,
      py: 1.75,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <SettingsIcon fontSize="small" />
      </Box>

      <Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>
          Settings
        </Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.75, mt: 0.25 }}>
          RPC endpoint & wallet tools
        </Typography>
      </Box>
    </Box>

    <IconButton onClick={handleCloseRpcSettings} sx={{ opacity: 0.8 }}>
      <CloseIcon />
    </IconButton>
  </DialogTitle>

  <DialogContent sx={{ px: 2.25, pb: 2.25 }}>
    {/* ===== RPC Selection ===== */}
    <Box sx={sectionCardSX}>
      <Box sx={sectionHeaderSX}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>RPC Selection</Typography>

        {/* show current mode */}
        <Chip
          size="small"
          variant="outlined"
          label={rpcSelectionMode === "predefined" ? "Predefined" : "Custom"}
          sx={{ opacity: 0.85 }}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 12, opacity: 0.75, mb: 1 }}>Cluster</Typography>
        <ToggleButtonGroup
          exclusive
          value={APP_CLUSTER}
          onChange={(_, value) => {
            const nextCluster = value as AppCluster | null;
            if (!nextCluster || nextCluster === getPreferredCluster()) return;
            setPreferredCluster(nextCluster);
            handleCloseRpcSettings();
            window.location.reload();
          }}
          sx={{
            width: "100%",
            "& .MuiToggleButton-root": {
              flex: 1,
              textTransform: "none",
              borderRadius: 6,
              py: 0.8,
            },
          }}
        >
          <ToggleButton value="mainnet">Mainnet</ToggleButton>
          <ToggleButton value="devnet">Devnet</ToggleButton>
        </ToggleButtonGroup>
        <Typography sx={{ fontSize: 11, opacity: 0.65, mt: 1 }}>
          Switching cluster reloads the app.
        </Typography>
      </Box>

      {/* Segmented control */}
      <FormControl fullWidth>
        <ToggleButtonGroup
          exclusive
          value={rpcSelectionMode}
          onChange={(_, v) => v && setRpcSelectionMode(v)}
          sx={{
            width: "100%",
            "& .MuiToggleButton-root": {
              flex: 1,
              textTransform: "none",
              borderRadius: 6,
              py: 1,
            },
          }}
        >
          <ToggleButton value="predefined">Predefined</ToggleButton>
          <ToggleButton value="custom">Custom URL</ToggleButton>
        </ToggleButtonGroup>
      </FormControl>

      {/* Predefined */}
        {rpcSelectionMode === "predefined" && (
        <Box sx={{ mt: 2 }}>
            <TextField
            select
            fullWidth
            label="RPC Provider"
            value={getPreferredRpc()}
            onChange={(e) => {
                setPreferredRpc(e.target.value);
                handleCloseRpcSettings();
                window.location.reload();
            }}
            size="small"
            variant="outlined"
            helperText={
                <Typography sx={{ fontSize: 12, opacity: 0.75 }}>
                Switching RPC reloads the app to reinitialize connections.
                </Typography>
            }
            FormHelperTextProps={{ sx: { mt: 1 } }}
            >
            {Object.entries(RPC_OPTIONS)
              .filter(([, url]) => typeof url === 'string' && url.trim().length > 0)
              .map(([label, url]) => (
                <MenuItem key={label} value={url as string}>
                <Box
                    sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    }}
                >
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                    {label}
                    </Typography>

                    {/* Optional future badges */}
                    {/* <Chip size="small" label="Recommended" /> */}
                </Box>
                </MenuItem>
            ))}
            </TextField>
        </Box>
        )}

      {/* Custom */}
      {rpcSelectionMode === "custom" && (
        <Box sx={{ mt: 2 }}>
          {(() => {
            const val = String(customRpcInput || "").trim();
            const isHttps = val.startsWith("https://");
            const showWarn = val.length > 0 && !isHttps;

            return (
              <>
                <TextField
                  fullWidth
                  label="Custom RPC Endpoint"
                  value={customRpcInput}
                  onChange={(e) => setCustomRpcInput(e.target.value)}
                  size="small"
                  variant="outlined"
                  placeholder="https://your-custom-rpc.solana.com"
                  error={showWarn}
                  helperText={
                    showWarn ? (
                      <Box sx={rowSX}>
                        <WarningAmberIcon sx={{ fontSize: 16 }} />
                        <span>Must start with https://</span>
                      </Box>
                    ) : (
                      "Enter a full HTTPS endpoint (recommended)."
                    )
                  }
                />

                <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
                  <Button
                    variant="contained"
                    startIcon={<RestartAltIcon />}
                    onClick={() => {
                      if (String(customRpcInput || "").trim().startsWith("https://")) {
                        setPreferredRpc(customRpcInput.trim());
                        handleCloseRpcSettings();
                        window.location.reload();
                      } else {
                        alert("Please enter a valid URL starting with https://");
                      }
                    }}
                    sx={{
                      borderRadius: 6,
                      textTransform: "none",
                      px: 2,
                    }}
                  >
                    Save & Reload
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={() => setCustomRpcInput("")}
                    sx={{ borderRadius: 6, textTransform: "none" }}
                  >
                    Clear
                  </Button>
                </Stack>
              </>
            );
          })()}
        </Box>
      )}
    </Box>

    {/* ===== Wallet Tools ===== */}
    <Box sx={{ ...sectionCardSX, mt: 2 }}>
      <Box sx={sectionHeaderSX}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Wallet Tools</Typography>
      </Box>

      <Typography sx={{ fontSize: 12, opacity: 0.75, mb: 1.5 }}>
        Manage wallet connection for this session.
      </Typography>

      <Button
        variant="outlined"
        color="error"
        startIcon={<PowerSettingsNewIcon />}
        onClick={async () => {
          await disconnect();
          handleCloseRpcSettings();
        }}
        sx={{ borderRadius: 6, textTransform: "none" }}
      >
        Disconnect Wallet
      </Button>
    </Box>
  </DialogContent>

  <DialogActions sx={{ px: 2.25, pb: 2 }}>
    <Button onClick={handleCloseRpcSettings} sx={{ borderRadius: 6, textTransform: "none" }}>
      Close
    </Button>
  </DialogActions>
</Dialog>
        </>
    );
}

export default Header;
