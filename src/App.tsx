import React, { useMemo, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
//import { SpeedInsights } from '@vercel/speed-insights/react';

//import '@ionic/react/css/core.css';
//import { setupIonicReact } from '@ionic/react';

//import GovernanceAppPageView from "./GovernanceCached/v2/page";
//import FrictionlessView from "./Frictionless/FrictionlessView";
import { MyGovernanceView } from "./Governance/MyGovernance";
import { GovernanceCachedView } from "./Governance/Governance";
import { GovernanceRealtimeView } from "./Admin/Realtime/Realtime";
import { PremiumView } from "./Governance/Premium";
import { GovernanceMetricsView } from "./Governance/GovernanceMetrics";
import { GovernanceStatsView } from "./Governance/GovernanceStats";
import { GovernanceMembersView } from "./Governance/GovernanceMembers";
import { GovernanceTreasuryView } from "./Governance/GovernanceTreasury";
import { GovernanceDirectoryView } from "./Governance/GovernanceDirectory";
import { GovernanceDirectoryTestView } from "./Governance/GovernanceDirectoryTest";
import { GovernanceReputationView } from "./Governance/GovernanceReputation";
import { GovernanceProposalV2View } from "./Governance/GovernanceProposalV2";
import { GovernanceProposalWrapper } from "./Governance/GovernanceProposalWrapper";
import GovernanceCreateProposalView from "./Governance/GovernanceCreateProposal";
import { GovernanceWalletView } from "./Governance/Treasury/SingleWalletWrapperView";
import PushNotificationTestView from "./Diagnostics/PushNotificationTestView";

//import CreateNewDAO from "./Governance/CreateNewDAO/CreateNewDAO";
//import MultiSigWizard from "./Governance/CreateNewDAO/CreateMultiSig";
//import CommunityTokenWizard from "./Governance/CreateNewDAO/CreateCommunity";

import TestEmbed from "./Governance/TestEmbed";
import { ApiView } from "./api/api";
import CssBaseline from '@mui/material/CssBaseline';
import { inject } from '@vercel/analytics';

//import { ThemeProvider } from '@mui/material/styles';
import ThemeProvider from './theme';

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
//import {detectEmbeddedInSquadsIframe, SquadsEmbeddedWalletAdapter} from '@sqds/iframe-adapter';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { Helmet } from 'react-helmet';

import { listenForForegroundMessages } from './firebaseNotifications/firebase';
import { enableRealmPushNotifications } from './firebaseNotifications/realmPush';

import { 
  CREATOR_LOGO,
  RPC_ENDPOINT,
  APP_CLUSTER,
} from './utils/grapeTools/constants';

import { useTranslation } from 'react-i18next';

import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  //GlowWalletAdapter,
  SolflareWalletAdapter,
  //SolletExtensionWalletAdapter,
  //SolletWalletAdapter,
  TorusWalletAdapter,
  CloverWalletAdapter,
  MathWalletAdapter,
  Coin98WalletAdapter,
  SolongWalletAdapter,
  BitKeepWalletAdapter,
  TokenPocketWalletAdapter,
  BitpieWalletAdapter,
  SafePalWalletAdapter,
  //ExodusWalletAdapter,
  //SlopeWalletAdapter,
} from '@solana/wallet-adapter-wallets';

//import { mainListItems, secondaryListItems } from './components/SidebarList/SidebarList';
import grapeTheme from  './utils/config/theme'
import { borderRadius } from '@mui/system';
import { migrate } from '@shadow-drive/sdk/dist/methods';
//import "./App.less";

//setupIonicReact();

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
  const REALM_PUSH_REALM = 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
  
  const toggleDrawer = () => {
    setOpen(!open);
  };

  // You can also provide a custom RPC endpoint
  const network = APP_CLUSTER === 'devnet' ? WalletAdapterNetwork.Devnet : WalletAdapterNetwork.Mainnet;
  // You can also provide a custom RPC endpoint
  //const endpoint =  useMemo(() => clusterApiUrl(network), [network]);
  const endpoint =  RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
  const wallets = useMemo(() => 
  //detectEmbeddedInSquadsIframe() ? 
  //[new SquadsEmbeddedWalletAdapter("https://iframe-preview.squads.so")] :
  [
    new SolflareWalletAdapter(),
    new PhantomWalletAdapter(),
   // new GlowWalletAdapter(),
    new LedgerWalletAdapter(),
  ], [network]);
  
  const renderLoader = () => <p>Loading</p>;

  React.useEffect(() => {
    let unsubscribe: null | (() => void) = null;

    void (async () => {
      try {
        await enableRealmPushNotifications(REALM_PUSH_REALM);
      } catch (error) {
        console.warn('Failed to enable realm push notifications', error);
      }

      try {
        unsubscribe = listenForForegroundMessages((payload: any) => {
          const title = payload?.notification?.title || 'Governance Update';
          const body = payload?.notification?.body || '';
          const icon = payload?.notification?.image || '/icons/icon-192x192.png';
          const link = payload?.data?.link || payload?.fcmOptions?.link || null;

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const notification = new Notification(title, {
              body,
              icon,
              data: link ? { link } : undefined,
            });

            if (link) {
              notification.onclick = () => {
                window.location.assign(link);
              };
            }
          }
        });
      } catch (error) {
        console.warn('Failed to bind foreground message listener', error);
      }
    })();

    inject();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  return (
    <>
      
      <SnackbarProvider>
        <Router>
            <Routes>
              
              <Route path="api/*" element={<ApiView />} >
                <Route path=":handlekey/:querytype/:queryvar1/:queryvar2/:queryvar3" element={<ApiView />} />
              </Route>

              <Route path="embedproposal/*" element={<GovernanceProposalV2View showGovernanceTitle={true} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'} />} >
                <Route path=":governance/:proposal" element={<GovernanceProposalV2View showGovernanceTitle={true} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'}  />} />
              </Route>

              <Route path="embedgovernance/*" element={<GovernanceCachedView showGovernanceTitle={true} showGovernanceNavigation={false} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'} />} >
                <Route path=":handlekey" element={<GovernanceCachedView showGovernanceTitle={true} showGovernanceNavigation={false} test={1} background={'rgba(0,0,0)'} textColor={'rgba(255, 255, 255)'}  />} />
              </Route>

              <Route path="testembed" element={<TestEmbed />} />

              <Route path="daowallet/*" element={<GovernanceWalletView/>} >
                  <Route path=":governance/:wallet" element={<GovernanceWalletView />} />
              </Route>

              {/*
              <Route path="/frictionless/*" element={
                <Suspense fallback={renderLoader()}>
                  <ThemeProvider theme={grapeTheme}>
                  <div className="frictionless-body">
                        <ConnectionProvider endpoint={endpoint}>
                            <WalletProvider wallets={wallets} autoConnect>
                            
                              <CssBaseline />
                              
                              <Routes>

                                <Route path="/*" element={<FrictionlessView />} >
                                    <Route path=":handlekey" element={<FrictionlessView />} />
                                </Route>
                              </Routes>
                            
                          </WalletProvider>
                          </ConnectionProvider>
                        
                    </div>
                    </ThemeProvider>
                  </Suspense>
              }></Route>
              */}

              <Route path="/realtime/*" element={
                <Suspense fallback={renderLoader()}>
                  <ThemeProvider theme={grapeTheme}>
                  <div className="realtime-body">
                        <ConnectionProvider endpoint={endpoint}>
                            <WalletProvider wallets={wallets} autoConnect>
                            
                              <CssBaseline />
                              
                              <Routes>

                                <Route path="/*" element={<GovernanceRealtimeView />} >
                                    <Route path=":handlekey" element={<GovernanceRealtimeView />} />
                                </Route>
                                
                              </Routes>
                            
                          </WalletProvider>
                          </ConnectionProvider>
                        
                    </div>
                    </ThemeProvider>
                  </Suspense>
              }></Route>

              <Route path="*" element={
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
                                              
                                            {/*
                                              <Route path="/new/create" element={<CreateNewDAO />} />
                                              <Route path="/new/create/multisig" element={<MultiSigWizard />} />
                                              <Route path="/new/create/community" element={<CommunityTokenWizard />} />
                                              */}
                                              
                                              <Route path="gspl/*" element={<GovernanceDirectoryTestView />} >
                                                <Route path=":handlekey" element={<GovernanceDirectoryTestView />} />
                                              </Route>

                                              <Route path="/profile/*" element={<MyGovernanceView />} >
                                                  <Route path=":walletAddress" element={<MyGovernanceView />} />
                                              </Route>

                                              <Route path="governance/*" element={<GovernanceCachedView />} >
                                                  <Route path=":handlekey" element={<GovernanceCachedView />} />
                                                  <Route path=":handlekey/:proposal" element={<GovernanceCachedView />} />
                                              </Route>
                                              
                                              <Route path="dao/*" element={<GovernanceCachedView />} >
                                                  <Route path=":handlekey" element={<GovernanceCachedView />} />
                                                  <Route path=":handlekey/:proposal" element={<GovernanceCachedView />} />
                                              </Route>
                                              
                                              <Route path="newproposal/*" element={<GovernanceCreateProposalView />} >
                                                  <Route path=":handlekey" element={<GovernanceCreateProposalView />} />
                                              </Route>

                                              <Route path="proposal/*" element={<GovernanceProposalWrapper/>} >
                                                  <Route path=":governance/:proposal" element={<GovernanceProposalWrapper />} />
                                              </Route>

                                              <Route path="pushtest" element={<PushNotificationTestView />} />
                                              
                                              <Route path="proposals/*" element={<GovernanceRealtimeView />} >
                                                  <Route path=":handlekey" element={<GovernanceRealtimeView />} />
                                              </Route>
                                              
                                              <Route path="metrics/*" element={<PremiumView />} >
                                                  <Route path=":handlekey" element={<PremiumView />} />
                                              </Route>
                                              <Route path="members/*" element={<GovernanceMembersView />} >
                                                  <Route path=":handlekey" element={<GovernanceMembersView />} />
                                              </Route>
                                              <Route path="stats/*" element={<GovernanceStatsView />} >
                                                  <Route path=":handlekey" element={<GovernanceStatsView />} />
                                              </Route>
                                              <Route path="treasury/*" element={<GovernanceTreasuryView />} >
                                                  <Route path=":address" element={<GovernanceTreasuryView />} />
                                                  <Route path=":address/:rules" element={<GovernanceTreasuryView />} />
                                              </Route>
                                              {/*
                                              <Route path="reputation/*" element={<GovernanceReputationView />} >
                                                  <Route path=":handlekey" element={<GovernanceReputationView />} />
                                              </Route>
                                              */}
                                              
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
