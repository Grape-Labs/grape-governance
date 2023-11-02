import React, { useEffect, useState } from "react";
import OpenLogin from "@toruslabs/openlogin";
//import AccountInfo  from "../../components/AccountInfo";
import { Account, Connection, clusterApiUrl } from "@solana/web3.js";
import { getED25519Key } from "@toruslabs/openlogin-ed25519";
import * as bs58 from "bs58";

import {
    Typography,
    Button,
    Grid,
    Box,
  } from '@mui/material/';

//import "./style.scss";

const networks = {
  mainnet: { url: "https://solana-api.projectserum.com", displayName: "Mainnet Beta" },
  devnet: { url: clusterApiUrl("devnet"), displayName: "Devnet" },
  testnet: { url: clusterApiUrl("testnet"), displayName: "Testnet" },
};

const solanaNetwork = networks.devnet;
const connection = new Connection(solanaNetwork.url);

function OathLogin() {
  const [loading, setLoading] = useState(false);
  const [openlogin, setSdk] = useState(undefined);
  const [account, setUserAccount] = useState(null);
  const [walletInfo, setUserAccountInfo] = useState(null);
  const [solanaPrivateKey, setPrivateKey] = useState(null)

  useEffect(() => {
    setLoading(true);
    async function initializeOpenlogin() {
      const sdkInstance = new OpenLogin({
        clientId: "BH6rsnhb8TsZZ99iZVYiyOXYiHlCUWGYhLfzIRQ_wq3Nziv_3U-TiofvaFoC1ERRedHa5sWddtPN0YQ7UrQbdnc", // your project id
        network: "mainnet",
      });
      await sdkInstance.init();
      if (sdkInstance.privKey) {
        const privateKey = sdkInstance.privKey;
        const secretKey = getSolanaPrivateKey(privateKey);
        await getAccountInfo(secretKey);
      }
      setSdk(sdkInstance);
      setLoading(false);
    }
    initializeOpenlogin();
  }, []);


  const getSolanaPrivateKey = (openloginKey)=>{
    const  { sk } = getED25519Key(openloginKey);
    return sk;
  }

  const getAccountInfo = async(secretKey) => {
    const account = new Account(secretKey);
    const accountInfo = await connection.getAccountInfo(account.publicKey);
    setPrivateKey(bs58.encode(account.secretKey));
    setUserAccount(account);
    setUserAccountInfo(accountInfo);
    return accountInfo;
  }

  async function handleLogin() {
    setLoading(true)
    try {
      const privKey = await openlogin.login({
        loginProvider: "google",
        redirectUrl: `${window.origin}/oath`,
      });
      const solanaPrivateKey = getSolanaPrivateKey(privKey);
      await getAccountInfo(solanaNetwork.url,solanaPrivateKey);
      setLoading(false)
    } catch (error) {
      console.log("error", error);
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    await openlogin.logout();
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
          (openlogin && openlogin.privKey) ?
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
                        <Typography variant="body2" sx={{ textAlign: "left" }}>PublicKey: {solanaPrivateKey}</Typography>
                        <Typography variant="body2" sx={{ textAlign: "left" }}>Account Details: {JSON.stringify(account)}</Typography>
                        <Typography variant="body2" sx={{ textAlign: "left" }}>Account Info: {JSON.stringify(walletInfo)}</Typography>
                    </p>

                    <Button 
                        variant="contained"
                        onClick={handleLogout}>
                        Logout
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
                    <Button 
                        variant="contained"
                        onClick={handleLogin}>
                        Login
                    </Button>
                </div>
                </Box>
        }

      </div>
    }
    </>
  );
}

export default OathLogin;