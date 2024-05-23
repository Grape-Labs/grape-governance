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
    PROXY,
    HELIUS_API,
    GGAPI_STORAGE_POOL,
    GGAPI_STORAGE_URI
} from '../utils/grapeTools/constants';

import { 
    APP_LOGO,
    APP_ICON
} from '../utils/grapeTools/constants';

import {
    fetchGovernanceLookupFile,
} from '../Governance/CachedStorageHelpers'; 

import {
    WalletDialogProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-material-ui';

import { useAddToHomescreenPrompt } from "./useAddToHomeScreen";

import {
    Box,
    Toolbar,
    MenuItem,
    Typography,
    Button,
    Menu,
    Tooltip,
    Drawer,
    Dialog,
    DialogTitle,
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
    FormControlLabel
} from '@mui/material';

import ClickAwayListener from '@mui/material/ClickAwayListener';

import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';

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

import AboutDialog from '../About/AboutDialog';

import { ValidateAddress } from '../utils/grapeTools/WalletAddress'; // global key handling

import { useTranslation } from 'react-i18next';

export interface State extends SnackbarOrigin {
    open: boolean;
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
    const [governanceAutocomplete, setGovernanceAutocomplete] = React.useState(null);
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
    
    const { publicKey, wallet } = useWallet();
    const theme: 'dark' | 'light' = 'dark';
    
    //Menu
    const menuId = 'primary-wallet-account-menu';
    const menuWalletId = 'primary-fullwallet-account-menu';

    const [open, setOpen] = React.useState(false);

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

    const getGovernanceLookupFile = async () => {
        const fglf = await fetchGovernanceLookupFile(GGAPI_STORAGE_POOL);
        
        if (fglf && fglf.length > 0){
            //const sorted = fglf.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
            const sorted = fglf.sort((a:any, b:any) => (a?.totalVaultValue < b?.totalVaultValue && b?.totalVaultValue > 1) ? 1 : -1); 
            
            const lookupAutocomplete = new Array();
            for (var item of sorted){
                lookupAutocomplete.push({
                    label: item.governanceName,
                    value: item.governanceAddress,
                    totalProposals: item.totalProposals,
                    totalProposalsVoting: item.totalProposalsVoting,
                });
            }
            setGovernanceAutocomplete(lookupAutocomplete);
        }
    }

    React.useEffect(() => { 
        if (!governanceAutocomplete){
            getGovernanceLookupFile();
        }
        
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
                                    <img src={APP_LOGO} className="header-logo" alt="SPL Governance | Powered by Solana" />
                                </Typography>
                            </Button>
                        
                            {/*
                            <Tooltip title={`Go to SPL Governance`}><IconButton sx={{borderRadius:'17px'}} component="a" href='https://realms.today/realms'><DashboardOutlinedIcon/></IconButton></Tooltip>
                            */}
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
                            <Tooltip title={`*tools for whitelisted addresses`} placement="right" arrow>
                                <ListItemButton 
                                    component={Link}
                                    to={'/admin'}
                                >
                                <ListItemIcon><SettingsSuggestIcon /></ListItemIcon>
                                <Typography variant="h6">Admin Tools</Typography>
                                </ListItemButton>
                            </Tooltip>
                        </ListItem>

                        <ListItem disablePadding>
                            <AboutDialog /> 
                        </ListItem>

                        {governanceAutocomplete ?
                            
                            <ListItem disablePadding>
                                <Search
                                    sx={{ mt:1,mb:1, backgroundColor:'rgba(255,255,255,0.05)' }}
                                >
                                    <Autocomplete
                                        sx={{ minWidth:'25ch',border:'none'}}
                                        disablePortal
                                        size="small"
                                        id="combo-box-demo"
                                        options={governanceAutocomplete}
                                        getOptionLabel={(option) => option.label}
                                        renderOption={(props, option) => (
                                            <Box sx={{border:'none'}} component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
                                            {option.label}
                                            &nbsp;
                                            <small>(
                                                {option.totalProposalsVoting ? <><HowToVoteIcon sx={{fontSize:10}} /> <strong>{option.totalProposalsVoting}</strong> of </> : ``}
                                                {option.totalProposals})
                                            </small>
                                            
                                            </Box>
                                        )}
                                        onChange={(e, sel) => handleGovernanceSelect(sel?.value)}
                                        renderInput={(params) => 
                                            <TextField 
                                                sx={{fontSize:'14px'}}
                                                {...params} onChange={(e) => handleGovernanceSelect(e.target.value)} label="" 
                                            />
                                        }
                                    />
                                </Search>
                                {/*
                                <Autocomplete
                                    sx={{ mt:1,ml:2, minWidth: 300 }}
                                    disablePortal
                                    size="small"
                                    id="combo-box-demo"
                                    options={governanceAutocomplete}
                                    getOptionLabel={(option) => option.value}
                                    renderOption={(props, option) => (
                                        <Box component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
                                        {option.label}
                                        &nbsp;
                                        <small>(
                                            {option.totalProposalsVoting ? <><strong>{option.totalProposalsVoting} voting</strong> of </> : ``}
                                            {option.totalProposals})
                                        </small>
                                        
                                        </Box>
                                    )}
                                    onChange={(e, sel) => setGovernanceAddress(sel?.value)} 
                                    renderInput={(params) => 
                                        <TextField {...params} onChange={(e) => setGovernanceAddress(e.target.value)} label="Governance" />
                                    }
                                />
                                */}
                            </ListItem>
                        :
                            <ListItem disablePadding>
                                <Search
                                    sx={{ mt:1,ml:2,mb:1 }}
                                >
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
                        }
                            {/*
                            <ListItem disablePadding>
                                <RadioGroup
                                        row
                                        aria-labelledby="demo-row-radio-buttons-group-label"
                                        name="row-radio-buttons-group"
                                        value={fetchType}
                                        onChange={handleChange}
                                        sx={{ml:2,display:'none'}}
                                    >

                                        <FormControlLabel value="cachedgovernance" control={<Radio />} label="Cached" />
                                        <FormControlLabel value="rpcgovernance" control={<Radio />} label="RPC" />
                                </RadioGroup>
                            </ListItem>
                            */}
                        </List>
                </Drawer>
            
            </Box>
        </ClickAwayListener>
    );
}

export default Header;
