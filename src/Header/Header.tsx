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

import { 
    PROXY,
    HELIUS_API,
    GGAPI_STORAGE_POOL,
    GGAPI_STORAGE_URI
} from '../utils/grapeTools/constants';

import { 
    APP_LOGO
} from '../utils/grapeTools/constants';

import {
    fetchGovernanceLookupFile,
} from '../GovernanceCached/CachedStorageHelpers'; 

import {
    WalletDialogProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-material-ui';

import { useTheme } from '@mui/material/styles';

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

import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';

import HomeIcon from '@mui/icons-material/Home';
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
    const [fetchType, setFetchType] = React.useState(currPath.includes("rpcgovernance") ? "rpcgovernance" : "cachedgovernance");
    
    const [anchorEl, setAnchorEl] = React.useState(null);
    const isWalletOpen = Boolean(anchorEl);
    const [newinputpkvalue, setNewInputPKValue] = React.useState("");
    const navigate = useNavigate();
    //const currPath = location?.pathname ?? "";
    const { enqueueSnackbar } = useSnackbar();
    
    const wallet = useWallet();
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

    const handleClickSnackbar = () => {
        enqueueSnackbar(`${t('Copied...')}`,{ variant: 'success' });
        
        handleMenuClose();
        //setSnackbarState(true);
    };

    const { t, i18n } = useTranslation();
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFetchType((event.target as HTMLInputElement).value);
      };

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
        if (governanceAddress && governanceAddress.length > 0){
            navigate({pathname: "/"+fetchType+"/"+governanceAddress,},{ replace: true });
        }
    }, [governanceAddress]);

    return (
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
                                sx={{ml:1,mr:1}}
                            >
                                <img src={APP_LOGO} height="40px" width="150px" className="header-logo" alt="SPL Governance | Powered by Solana" />
                            </Typography>
                        </Button>
                    
                        {/*
                        <Tooltip title={`Go to SPL Governance`}><IconButton sx={{borderRadius:'17px'}} component="a" href='https://realms.today/realms'><DashboardOutlinedIcon/></IconButton></Tooltip>
                        */}
                    </Box>
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
                                    sx={{ minWidth:'25ch',border:'none' }}
                                    disablePortal
                                    size="small"
                                    id="combo-box-demo"
                                    options={governanceAutocomplete}
                                    getOptionLabel={(option) => option.value}
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
                                    onChange={(e, sel) => setGovernanceAddress(sel?.value)} 
                                    renderInput={(params) => 
                                        <TextField 
                                            {...params} onChange={(e) => setGovernanceAddress(e.target.value)} label="" 
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
    );
}

export default Header;
