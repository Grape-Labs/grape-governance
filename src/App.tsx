import React, { useMemo, Suspense } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AdminView } from "./Admin/Admin";
import { GovernanceRPCView } from "./GovernanceRPC/Governance";
import { GovernanceCachedView } from "./GovernanceCached/Governance";
import CssBaseline from '@mui/material/CssBaseline';

import {
  Box,
  Grid,
  Paper,
  Container,
  Typography,
  AppBar,
} from '@mui/material';

import Header from './Header/Header';
import { SnackbarProvider } from 'notistack';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { Helmet } from 'react-helmet';

import { 
  CREATOR_LOGO
} from './utils/grapeTools/constants';

import { useTranslation } from 'react-i18next';

import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  GlowWalletAdapter,
  SolflareWalletAdapter,
  SolletExtensionWalletAdapter,
  SolletWalletAdapter,
  TorusWalletAdapter,
  CloverWalletAdapter,
  MathWalletAdapter,
  Coin98WalletAdapter,
  SolongWalletAdapter,
  BitKeepWalletAdapter,
  TokenPocketWalletAdapter,
  BitpieWalletAdapter,
  SafePalWalletAdapter,
  ExodusWalletAdapter,
  SlopeWalletAdapter,
} from '@solana/wallet-adapter-wallets';

//import { mainListItems, secondaryListItems } from './components/SidebarList/SidebarList';
import grapeTheme from  './utils/config/theme'
import { borderRadius } from '@mui/system';
//import "./App.less";

function Copyright(props: any): JSX.Element {
  const { t, i18n } = useTranslation();
    return (
    
      <Box
      sx={{/*
        backgroundColor: '#222',
        '&:hover': {
          backgroundColor: '#ddd',
          opacity: [0.9, 0.8, 0.7],
        },
        borderRadius:'24px'
      */}}
    >
        <Grid
          container
          direction="row"
          justifyContent="center"
          alignItems="center"
        >
            <Grid item>
              <Typography 
                align="center"
                variant="body2"
                sx={{verticalAlign:'middle'}}>

                Developed by
                </Typography>
              </Grid>
              <Grid item>
                <img src={CREATOR_LOGO} height="50px" className="main-logo" alt="OMG Labs" />
              </Grid>
              <Grid item>
              <Typography 
                align="center"
                variant="body2"
                sx={{verticalAlign:'middle'}}>

                labs | Powered by Solana
                </Typography>
              </Grid>
              
        </Grid>
      </Box>
    
  );
}


function DashboardContent() {
  const [open, setOpen] = React.useState(true);
  const toggleDrawer = () => {
    setOpen(!open);
  };

  // You can also provide a custom RPC endpoint
  const network = WalletAdapterNetwork.Devnet; //.Devnet; //.Mainnet;
  // You can also provide a custom RPC endpoint
  //const endpoint =  useMemo(() => clusterApiUrl(network), [network]); // GRAPE_RPC_ENDPOINT;
  //const endpoint =  GRAPE_RPC_ENDPOINT;
  const endpoint =  'https://api.devnet.solana.com';
  const wallets = useMemo(() => [
    new SolflareWalletAdapter(),
    new PhantomWalletAdapter(),
    new GlowWalletAdapter(),
    new LedgerWalletAdapter(),
    new ExodusWalletAdapter(),
    new SolletWalletAdapter({ network }),
    new SolletExtensionWalletAdapter({ network }),
    new TorusWalletAdapter(),
    new CloverWalletAdapter(),
    new MathWalletAdapter(),
    new Coin98WalletAdapter(),
    new SolongWalletAdapter(),
    new BitKeepWalletAdapter(),
    new TokenPocketWalletAdapter(),
    new BitKeepWalletAdapter(),
    new BitpieWalletAdapter(),
    new SafePalWalletAdapter(),
    new SlopeWalletAdapter(),
  ], [network]);
  
  const renderLoader = () => <p>Loading</p>;

  return (
    <>
      <Suspense fallback={renderLoader()}>
          <ThemeProvider theme={grapeTheme}>
              <div className="grape-gradient-background">
              <SnackbarProvider>
                  <ConnectionProvider endpoint={endpoint}>
                      <WalletProvider wallets={wallets} autoConnect>
                      
                      <Grid 
                          sx={{ 
                            flex: 1
                          }}>
                          <CssBaseline />
                          <Router>
                          <AppBar position="fixed" color="primary" style={{ background: 'rgba(0,0,0,0.5)' }}>
                              <Header
                                  open={open} 
                                  toggleDrawer={toggleDrawer}
                              />
                          </AppBar>
                          
                            <Grid
                              component="main"
                              sx={{
                                  mt: 6,
                                  display: 'flex',
                                  flexGrow: 1
                              }}
                              >
                              <Container maxWidth="xl" sx={{ mb: 4 }}>
                                  <Routes>
                                    
                                    <Route path="rpcgovernance/*" element={<GovernanceRPCView />} >
                                        <Route path=":handlekey" element={<GovernanceRPCView />} />
                                    </Route>

                                    <Route path="cachedgovernance/*" element={<GovernanceCachedView />} >
                                        <Route path=":handlekey" element={<GovernanceCachedView />} />
                                    </Route>

                                    <Route path="admin/*" element={<AdminView />} >
                                        <Route path=":handlekey" element={<AdminView />} />
                                    </Route>
                                    
                                    <Route path="*" element={<NotFound />} />
                                  </Routes>
                                  
                                  <Copyright sx={{ mt: 4 }} />
                              </Container>
                            </Grid>
                          </Router>
                      </Grid>
                      
                      </WalletProvider>
                  </ConnectionProvider>
              </SnackbarProvider>
              </div>
          </ThemeProvider>
        </Suspense>
    </>
  );
}

export const NotFound = () => {
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <Paper sx={{
        mt:5,
        p:5,
        borderRadius:'24px'}}>
        <Grid 
          className="grape-paper" 
          container
          alignContent="center"
          justifyContent="center"
          direction="column">
          <Grid item>
            <Typography 
              align="center"
              variant="h3">
                Select a governance above to get started
            </Typography>

            <Typography 
              align="center"
              variant="caption">
                NOTE:
                <br/>
                *Cached method will fetch Governance will load all proposals & proposal details
                <br/>
                *RPC method will fetch Governance via RPC calls (additional RPC calls are needed per proposal, significantly increasing the load time)
            </Typography>
            
          </Grid>
        </Grid>
      </Paper>
  </div>
  )
}

//export const Dashboard: FC<{ children: ReactNode }> = ({ children }) => {
export default function Dashboard() {
  return <DashboardContent />;
}