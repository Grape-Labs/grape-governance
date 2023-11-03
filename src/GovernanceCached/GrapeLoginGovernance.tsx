import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
//import { Client } from "discord.js";

import {
  Typography,
  ButtonGroup,
  Button,
  Grid,
  Box,
  TextField,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material/';

import { 
  getGovernanceProgramVersion,
  withDepositGoverningTokens,
  getRealm,
  getRealms,
  getAllProposals,
  getTokenOwnerRecordsByOwner,
  getAllTokenOwnerRecords,
  serializeInstructionToBase64,
} from '@solana/spl-governance';

import { RPC_CONNECTION } from '../utils/grapeTools/constants';

import ExplorerView from '../utils/grapeTools/Explorer';

function GrapeLogin() {
  const [loading, setLoading] = useState(false);
  const [openlogin, setSdk] = useState(undefined);
  const [account, setUserAccount] = useState(null);
  const [walletInfo, setUserAccountInfo] = useState(null);
  const [solanaPrivateKey, setPrivateKey] = useState(null);
  const [emailAddress, setEmailAddress] = useState(null);
  const [pinCode, setPinCode] = useState(null);
  const [generatedPk, setGeneratedPk] = useState(null)

  React.useEffect(() => {
    setLoading(true);
    async function initializeOpenlogin() {
      /*
      const client = new Client(null);

      client.on("ready", () => {
        //this.setState({ isLoggedIn: true });
        console.log("User is logged in to Discord")
      });
      client.on("loggedIn", () => {
        //this.setState({ userId: client.user.id });
      });
      */
      setLoading(false);
    }
    initializeOpenlogin();
  }, []);


  const generatePublicKeyFromString = async (seedStr:string) => {
    const seed = Buffer.from(seedStr, 'utf8');
    //const programId = PublicKey.programId;
    const keypair = await PublicKey.createWithSeed(new PublicKey('G1k3mtwhHC6553zzEM8qgU8qzy6mvRxkoRTrwdcsYkxL'), seedStr, new PublicKey('G1k3mtwhHC6553zzEM8qgU8qzy6mvRxkoRTrwdcsYkxL'));
    setGeneratedPk(keypair);
    //return keypair.publicKey.toString();
  };

  async function handleLogin() {
    setLoading(true)
    try {
      // handle login...
      
      generatePublicKeyFromString(emailAddress+pinCode);

      /*
      TipLink.create().then(tiplink => {
        console.log("link: ", tiplink.url.toString());
        console.log("publicKey: ", tiplink.keypair.publicKey.toBase58());
        setGeneratedTipLink(tiplink);
        //return tiplink;
      });
      */
      setLoading(false)
    } catch (error) {
      console.log("error", error);
      setLoading(false)
    }
  }

  const handleEmailChange = (text:string) => {
    
    const regex = /[^\w]+/g;
    const filteredInput = text.replace(regex, '');
    setEmailAddress(filteredInput)
  };

  function ViewActiveProposalsForDAO(props:any) {
    const realmPk = props.address;
    const [proposalLoading, setProposalLoading] = React.useState(false);
    const [participatingGovernanceProposalsRecordRows, setParticipatingGovernanceProposalsRecordRows] = React.useState(null);
    const [realm, setRealm] = React.useState(null);
    const fetchGovernanceProposals = async () => {
      setProposalLoading(true);

      const rlm = await getRealm(RPC_CONNECTION, new PublicKey(realmPk));

      setRealm(rlm);
      const gprops = await getAllProposals(RPC_CONNECTION, rlm.owner, new PublicKey(realmPk))

      const rpcprops = new Array();
      for (const props of gprops){
          for (const prop of props){
              if (prop){
                  if (prop.account.state === 2){
                      rpcprops.push(prop);
                      //console.log("prop: "+JSON.stringify(prop))
                      /*
                      if (prop.account.governingTokenMint.toBase58() === selectedCommunityMint){
                          rpcprops.push(prop);
                      } else if (prop.account.governingTokenMint.toBase58() === selectedCouncilMint){
                          rpcprops.push(prop);
                      }*/
                  }
              }
          }
      }
      const sortedRPCResults = rpcprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
      
      setParticipatingGovernanceProposalsRecordRows(sortedRPCResults);
      //console.log("sortedRPCResults: "+JSON.stringify(sortedRPCResults));
      setProposalLoading(false);
  } 

  React.useEffect(() => {
    if (realmPk && !proposalLoading){
        //console.log("here we go!");
        fetchGovernanceProposals();
    }
}, [realmPk]);


    return (
      <Box
          sx={{
              width:'100%',
              mt: 6,
              background: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '17px',
              p: 4,
              alignItems: 'center', textAlign: 'center'
          }} 
      > 
        {proposalLoading ?
          <><CircularProgress /></>
        :
        <>
          {realm ?
            <>
              <Typography variant="h4">{realm.account.name}</Typography>
            </>
          :
            <>
              <Typography variant="h4">{realmPk}</Typography>
            </>
          }

          {participatingGovernanceProposalsRecordRows && (participatingGovernanceProposalsRecordRows
            //.filter((item: any) => 
            //    item.account.data?.parsed?.info?.tokenAmount?.amount > 0
            //)
            //.sort((a: any, b: any) => 
            //    b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
            //)
            .map((item: any, key: number) => {
                
                return (
                        <Grid container
                            key={key}
                            alignItems="center"
                        >
                            <Grid item xs={12}>
                            <Grid container>
                                <Grid item sm={8}>
                                <Grid
                                    container
                                    direction="row"
                                    justifyContent="left"
                                    alignItems="left"
                                >
                                  <Typography variant="h5">
                                    {item.account.name}
                                  </Typography>
                                  <Typography variant="caption">
                                    {item.account.descriptionLink}
                                  </Typography>
                                </Grid>
                                </Grid>
                                <Grid item xs sx={{textAlign:'center'}}>
                                    <ButtonGroup>
                                      <Button
                                        color="success"
                                      >VOTE YES</Button>
                                      <Button
                                        color="error"
                                      >VOTE NO</Button>

                                    </ButtonGroup>
                                </Grid>
                            </Grid>  
                            </Grid>
                        </Grid>
                );
            }))}
        </>
        }


      </Box>
    );
  }

  const handleLogout = async () => {
    setLoading(true)
    setPinCode(null);
    setEmailAddress(null);
    setGeneratedPk(null);
    //await openlogin.logout();
    setLoading(false)
  };
  return (
    <>
    <Box
        sx={{
            width:'100%',
            mt: 6,
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '17px',
            p: 4,
            alignItems: 'center', textAlign: 'center'
        }} 
    > 
        
        <Typography variant="h1" sx={{ textAlign: "center" }}>Frictionless Governance</Typography>
        <Typography variant="h3" sx={{ textAlign: "center" }}>Grape x Solana</Typography>
    {
    loading ?
      <div>
          <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "center", alignItems: "center", margin: 20 }}>
              <CircularProgress />
          </div>
      </div> :
      <div>
        {
          (generatedPk) ?
            <>
                    <p>
                        <Typography variant="body2" sx={{ textAlign: "left" }}>PublicKey: {generatedPk.toBase58()}</Typography>
                    </p>

                    <Button 
                        variant="contained"
                        onClick={handleLogout}>
                        Disconnect
                    </Button>

                    <p>
                      <ViewActiveProposalsForDAO address={'Hr6PtVoKHTZETmJtjiYu9YeAFCMNUkDTv4qQV2kdDF2C'} />
                    </p>
            </>
             :
                
                <div className="loginContainer">
                    <FormControl fullWidth  sx={{mt:1,mb:2}}>
                      <TextField
                        label="Email"
                        onChange={(e) => handleEmailChange(e.target.value)}
                        type="email"
                      />
                    </FormControl>
                    <FormControl fullWidth  sx={{mb:2}}>
                      <TextField
                        label="Pin"
                        onChange={(e) => setPinCode(e.target.value)}
                        type="number"
                      />
                    </FormControl>
                    <FormControl fullWidth>
                      <Button 
                          variant="contained"
                          onClick={handleLogin}
                          disabled={!emailAddress || !pinCode}  
                        >
                          Generate PublicKey
                      </Button>
                    </FormControl>
                </div>
        }

      </div>
    }
    </Box>
    </>
  );
}

export default GrapeLogin;