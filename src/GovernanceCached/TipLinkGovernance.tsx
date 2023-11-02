import React, { useState } from 'react';
import { TipLink } from '@tiplink/api';

import {
  Typography,
  Button,
  Grid,
  Box,
  TextField,
  FormControl,
  InputLabel,
} from '@mui/material/';

function OathTipLinkLogin() {
  const [loading, setLoading] = useState(false);
  const [openlogin, setSdk] = useState(undefined);
  const [account, setUserAccount] = useState(null);
  const [walletInfo, setUserAccountInfo] = useState(null);
  const [solanaPrivateKey, setPrivateKey] = useState(null);
  const [emailAddress, setEmailAddress] = useState(null);
  const [pinCode, setPinCode] = useState(null);
  const [generatedTipLink, setGeneratedTipLink] = useState(null)

  React.useEffect(() => {
    setLoading(true);
    async function initializeOpenlogin() {
      
      

      setLoading(false);
    }
    initializeOpenlogin();
  }, []);


  const getSolanaPrivateKey = (openloginKey)=>{
    //const  { sk } = getED25519Key(openloginKey);
    //return sk;
  }

  const getAccountInfo = async(secretKey) => {
    //const account = new Account(secretKey);
    //const accountInfo = await connection.getAccountInfo(account.publicKey);
    //setPrivateKey(bs58.encode(account.secretKey));
    //setUserAccount(account);
    //setUserAccountInfo(accountInfo);
    //return accountInfo;
  }

  async function handleLogin() {
    setLoading(true)
    try {
      // handle login...
      
      const tp = 'https://tiplink.io/i#'+emailAddress+pinCode+'';
      console.log("tp: "+tp);
      TipLink.fromLink(tp).then(tiplink => {
        console.log("converted publicKey: ", tiplink.keypair.publicKey.toBase58());
        setGeneratedTipLink(tiplink);
      });

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

  const handleLogout = async () => {
    setLoading(true)
    setGeneratedTipLink(null);
    //await openlogin.logout();
    setLoading(false)
  };
  return (
    <>
    {
    loading ?
      <div>
          <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "center", alignItems: "center", margin: 20 }}>
              <h1>....loading</h1>
          </div>
      </div> :
      <div>
        {
          (generatedTipLink) ?
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
                {/*
                <AccountInfo
                handleLogout={handleLogout}
                loading={loading}
                privKey={solanaPrivateKey}
                walletInfo={walletInfo}
                account={account}
                />*/}
                    
                    <Typography variant="h1" sx={{ textAlign: "center" }}>Frictionless Governance</Typography>
                    <Typography variant="h3" sx={{ textAlign: "center" }}>Grape x Solana</Typography>
                    <p>
                        <Typography variant="body2" sx={{ textAlign: "left" }}>Link: {generatedTipLink.url.toString()}</Typography>
                        <Typography variant="body2" sx={{ textAlign: "left" }}>Account Details: {generatedTipLink.keypair.publicKey.toBase58()}</Typography>
                    </p>

                    <Button 
                        variant="contained"
                        onClick={handleLogout}>
                        Disconnect
                    </Button>
                </Box>
            </>
             :
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
                <div className="loginContainer">
                    <Typography variant="h1" sx={{ textAlign: "center" }}>Frictionless Governance</Typography>
                    <Typography variant="h3" sx={{ textAlign: "center" }}>Grape x Solana</Typography>
                    
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
                          Create Tip Link
                      </Button>
                    </FormControl>
                </div>
                </Box>
        }

      </div>
    }
    </>
  );
}

export default OathTipLinkLogin;