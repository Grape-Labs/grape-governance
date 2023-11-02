import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';

import {
  Typography,
  Button,
  Grid,
  Box,
  TextField,
  FormControl,
  InputLabel,
} from '@mui/material/';

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
      
      

      setLoading(false);
    }
    initializeOpenlogin();
  }, []);


  const generatePublicKeyFromString = async (seedStr:string) => {
    const seed = Buffer.from(seedStr, 'utf8');
    //const programId = PublicKey.programId;
    const keypair = await PublicKey.createWithSeed(new PublicKey('KirkNf6VGMgc8dcbp5Zx3EKbDzN6goyTBMKN9hxSnBT'), seedStr, new PublicKey('KirkNf6VGMgc8dcbp5Zx3EKbDzN6goyTBMKN9hxSnBT'));
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

  const handleLogout = async () => {
    setLoading(true)
    setGeneratedPk(null);
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
          (generatedPk) ?
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
                    <p>
                        <Typography variant="body2" sx={{ textAlign: "left" }}>PublicKey: {generatedPk.toBase58()}</Typography>
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

export default GrapeLogin;