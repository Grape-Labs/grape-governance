import React, { useMemo, Suspense } from 'react';
import { ThemeProvider } from '@mui/material/styles';
//import {  } from "react-router";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AdminView } from "./Admin/Admin";
import { GovernanceRPCView } from "./GovernanceRPC/Governance";
import { MyGovernanceView } from "./GovernanceCached/MyGovernance";
import { GovernanceCachedView } from "./GovernanceCached/Governance";
import { PremiumView } from "./GovernanceCached/Premium";
import { GovernanceMetricsView } from "./GovernanceCached/GovernanceMetrics";
import { GovernanceMembersView } from "./GovernanceCached/GovernanceMembers";
import { GovernanceTreasuryView } from "./GovernanceCached/GovernanceTreasury";
import { GovernanceDirectoryView } from "./GovernanceCached/GovernanceDirectory";
import { GovernanceReputationView } from "./GovernanceCached/GovernanceReputation";
import { GovernanceProposalView } from "./GovernanceCached/GovernanceProposal";
import { GovernanceProposalWrapper } from "./GovernanceCached/GovernanceProposalWrapper";
import GovernanceCreateProposalView from "./GovernanceCached/GovernanceCreateProposal";
import TestEmbed from "./GovernanceCached/TestEmbed";
import { ApiView } from "./api/api";
import CssBaseline from '@mui/material/CssBaseline';
import { inject } from '@vercel/analytics';

//import ReactXnft, { AnchorDom, View, Text } from "react-xnft";

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
import {detectEmbeddedInSquadsIframe, SquadsEmbeddedWalletAdapter} from '@sqds/iframe-adapter';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { Helmet } from 'react-helmet';

import { 
  CREATOR_LOGO,
  RPC_ENDPOINT
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
import { migrate } from '@shadow-drive/sdk/dist/methods';
//import "./App.less";

function Copyright(props: any): JSX.Element {
  const { t, i18n } = useTranslation();
    return (
    
      <Box
      sx={{
        mt:2
        /*
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
                variant="caption"
                sx={{verticalAlign:'middle', textAlign:'center'}}>
              {/*
                Developed by
                </Typography>
              </Grid>
              <Grid item>
                <img src={CREATOR_LOGO} height="50px" className="main-logo" alt="Grape Developer DAO" />
              </Grid>
              <Grid item>
              <Typography 
                align="center"
                variant="body2"
                sx={{verticalAlign:'middle'}}>

    Web3 Labs | */}Governance by Grape on Solana
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
  //const endpoint =  useMemo(() => clusterApiUrl(network), [network]);
  const endpoint =  RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
  const wallets = useMemo(() => 
  //detectEmbeddedInSquadsIframe() ? 
  //[new SquadsEmbeddedWalletAdapter("https://iframe-preview.squads.so")] :
  [
    new SolflareWalletAdapter(),
    new PhantomWalletAdapter(),
    new GlowWalletAdapter(),
    new LedgerWalletAdapter(),
  ], [network]);
  
  const renderLoader = () => <p>Loading</p>;

  React.useEffect(() => {
    inject();
}, []);

  return (
    <>
      <SnackbarProvider>
        <Router>
            <Routes>
              
              <Route path="api/*" element={<ApiView />} >
                <Route path=":handlekey/:querytype/:queryvar1/:queryvar2/:queryvar3" element={<ApiView />} />
              </Route>

              <Route path="embedproposal/*" element={<GovernanceProposalView showGovernanceTitle={true} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'} />} >
                <Route path=":governance/:proposal" element={<GovernanceProposalView showGovernanceTitle={true} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'}  />} />
              </Route>

              <Route path="embedgovernance/*" element={<GovernanceCachedView showGovernanceTitle={true} showGovernanceNavigation={false} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'} />} >
                <Route path=":handlekey" element={<GovernanceCachedView showGovernanceTitle={true} showGovernanceNavigation={false} test={1} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'}  />} />
              </Route>

              <Route path="testembed" element={<TestEmbed />} />

              <Route path="/*" element={
                <Suspense fallback={renderLoader()}>
                  <ThemeProvider theme={grapeTheme}>
                      <div className="app-body">
                          
                          <ConnectionProvider endpoint={endpoint}>
                              <WalletProvider wallets={wallets} autoConnect>
                              
                              <Grid 
                                  sx={{ 
                                    flex: 1
                                  }}>
                                  <CssBaseline />
                                  
                                  <Header
                                      open={open} 
                                      toggleDrawer={toggleDrawer}
                                  />
                                  
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
                                            {/*
                                            <Route path="api/*" element={<ApiView />} >
                                                <Route path=":handlekey" element={<ApiView />} />
                                            </Route>
                                            */}
                                              <Route path="profile/*" element={<MyGovernanceView />} >
                                                <Route path=":handlekey" element={<MyGovernanceView />} />
                                              </Route>

                                              <Route path="rpcgovernance/*" element={<GovernanceRPCView />} >
                                                  <Route path=":handlekey" element={<GovernanceRPCView />} />
                                              </Route>

                                              <Route path="governance/*" element={<GovernanceCachedView />} >
                                                  <Route path=":handlekey" element={<GovernanceCachedView />} />
                                              </Route>

                                              <Route path="dao/*" element={<GovernanceCachedView />} >
                                                  <Route path=":handlekey" element={<GovernanceCachedView />} />
                                              </Route>

                                              <Route path="cachedgovernance/*" element={<GovernanceCachedView />} >
                                                  <Route path=":handlekey" element={<GovernanceCachedView />} />
                                              </Route>

                                              <Route path="newproposal/*" element={<GovernanceCreateProposalView />} >
                                                  <Route path=":handlekey" element={<GovernanceCreateProposalView />} />
                                              </Route>

                                              <Route path="proposal/*" element={<GovernanceProposalWrapper />} >
                                                  <Route path=":governance/:proposal" element={<GovernanceProposalWrapper />} />
                                              </Route>

                                              <Route path="metrics/*" element={<PremiumView />} >
                                                  <Route path=":handlekey" element={<PremiumView />} />
                                              </Route>
                                              {/*
                                              <Route path="metrics/*" element={<GovernanceMetricsView />} >
                                                  <Route path=":handlekey" element={<GovernanceMetricsView />} />
                                              </Route>
                                              */}
                                              <Route path="members/*" element={<GovernanceMembersView />} >
                                                  <Route path=":handlekey" element={<GovernanceMembersView />} />
                                              </Route>
                                              <Route path="treasury/*" element={<GovernanceTreasuryView />} >
                                                  <Route path=":handlekey" element={<GovernanceTreasuryView />} />
                                              </Route>
                                              {/*
                                              <Route path="reputation/*" element={<GovernanceReputationView />} >
                                                  <Route path=":handlekey" element={<GovernanceReputationView />} />
                                              </Route>
                                              */}
                                              <Route path="admin/*" element={<AdminView />} >
                                                  <Route path=":handlekey" element={<AdminView />} />
                                              </Route>
                                              
                                              <Route path="*" element={<NotFound />} />
                                            </Routes>
                                          <Copyright sx={{ mt: 4 }} />
                                      </Container>
                                    </Grid>
                              </Grid>
                              
                              </WalletProvider>
                          </ConnectionProvider>
                      </div>
                  </ThemeProvider>
                </Suspense>
            }>
            </Route>
          </Routes>
        </Router>
        </SnackbarProvider>
    </>
  );
}

export const NotFound = () => {
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <GovernanceDirectoryView children={undefined} />
    </div>
  )
}

//export const Dashboard: FC<{ children: ReactNode }> = ({ children }) => {
export default function Dashboard() {
  return <DashboardContent />;
}
/*
ReactXnft.render(
  <AnchorDom>
    <DashboardContent />
  </AnchorDom>
);*/