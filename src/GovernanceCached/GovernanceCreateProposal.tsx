import { PublicKey, TokenAmount, Connection, Transaction } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
//import { useHistory } from "react-router";
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import Gist from 'react-gist';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Confetti from 'react-dom-confetti';
import { useSnackbar } from 'notistack';
import { createProposalInstructions } from './Proposals/createDAOProposalInstructions';
import { 
  getRealm, 
  createInstructionData, 
  getRealmConfig,
  } from '@solana/spl-governance';

import {
  Typography,
  Tooltip,
  Button,
  Grid,
  Box,
  ButtonGroup,
  TextField,
  Switch,
  FormControlLabel,
  FormGroup,
  FormControl,
  MenuItem,
  InputLabel,
  CircularProgress,
} from '@mui/material/';
import Select, { SelectChangeEvent } from '@mui/material/Select';

import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TextareaAutosize from '@mui/base/TextareaAutosize';
import { Title } from '@devexpress/dx-react-chart';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GitHubIcon from '@mui/icons-material/GitHub';

import { 
  PROXY, 
  RPC_CONNECTION,
  GGAPI_STORAGE_POOL, 
  GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';

  import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

const confettiConfig = {
  angle: 90,
  spread: 360,
  startVelocity: 40,
  elementCount: 200,
  dragFriction: 0.12,
  duration: 4000,
  stagger: 3,
  width: "10px",
  height: "10px",
  perspective: "500px",
  colors: ["#f00", "#0f0", "#00f"]
};

export default function GovernanceCreateProposalView(props: any){
    const navigate = useNavigate();  
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    
    const governanceAddress = urlParams;
    const showGovernanceTitle = true;
    const [title, setTitle] = React.useState(null);
    const [description, setDescription] = React.useState(null);
    const maxTitleLen = 130;
    const maxDescriptionLen = 512;
    const [proposalType, setProposalType] = React.useState(null);
    const [isCouncilVote, setIsCouncilVote] = React.useState(false);
    const [governanceWallet, setGovernanceWallet] = React.useState(null);
    const [isGistDescription, setIsGistDescription] = React.useState(false);
    const { publicKey, sendTransaction } = useWallet();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const connection = RPC_CONNECTION;
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [cachedGovernance, setCachedGovernance] = React.useState(null);
    const [cachedRealm, setCachedRealm] = React.useState(null);
    const [cachedTreasury, setCachedTreasury] = React.useState(null);
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    const [proposalMade, setProposalMade] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [realm, setRealm] = React.useState(null);
    const [realmName, setRealmName] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [cachedTimestamp, setCachedTimestamp] = React.useState(null);
    const [createDisabled, setCreateDisabled] = React.useState(false);

    const [governanceRules, setGovernanceRules] = React.useState(null);
    const [totalGovernanceValue, setTotalGovernanceValue] = React.useState(null);
    const [totalGovernanceSolValue, setTotalGovernanceSolValue] = React.useState(null);
    const [totalGovernanceSol, setTotalGovernanceSol] = React.useState(null);
    const [totalGovernanceNftFloorValue, setTotalGovernanceNftFloorValue] = React.useState(null);
    const [totalGovernanceStableCoinValue, setTotalGovernanceStableCoinValue] = React.useState(null);

    const wallet = useWallet();
    const anchorWallet = useAnchorWallet();

    const createProposal = async() => {
      
      // get governance settings
      setCreateDisabled(true);

      enqueueSnackbar(`Preparing Grape Governance Proposal`,{ variant: 'info' });
      // 1. Generate the instructions to pass to governance
      const transaction = new Transaction();
      
      //enqueueSnackbar(`Preparing Grape Governance Proposal`,{ variant: 'info' });
      // 2. call createDAOProposal.tsx with the respective variables to create the prop and return to execute
      // temporarily use a static program id, make it dynamic for more flexibility
      const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
      const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);

      //const governingTokenMint = new PublicKey('8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA');
      console.log("cachedRealm: "+JSON.stringify(cachedRealm));
      console.log("cachedRealm.pubkey: "+JSON.stringify(cachedRealm.pubkey));
      console.log("governanceWallet: "+JSON.stringify(governanceWallet));

      let governingTokenMint = new PublicKey(cachedRealm.account?.communityMint);
      if (isCouncilVote){
        governingTokenMint = new PublicKey(cachedRealm.account?.config?.councilMint);
      }


      if (publicKey){
        enqueueSnackbar(`Creating Grape Governance Proposal`,{ variant: 'info' });
        const propAddress = await createProposalInstructions(
          programId,
          new PublicKey(cachedRealm.pubkey),
          new PublicKey(governanceWallet),
          governingTokenMint,
          publicKey,
          title,
          description,
          connection,
          transaction,
          anchorWallet,//anchorWallet,
          null//sendTransaction
        );
        

        //await createProposalInstructions()
          
        if (propAddress){ // only move this route if we have a propTx returned (otherwise we are running in the function above)
          const snackaction = (key:any) => (
            <Button href={`https://spl-gov.vercel.app/proposal/${cachedRealm.pubkey}/${propAddress.toBase58()}`} target='_blank'  sx={{color:'white'}}>
                {propAddress.toBase58()}
            </Button>
          );
          enqueueSnackbar('Grape Governance Transaction completed - redirecting in 5 seconds to proposal',{ variant: 'success', action:snackaction });
          
          setProposalMade(true);

          // redirect to proposal
          const redirectTimer = setTimeout(() => {
            //navigate(`/proposal/${cachedRealm.pubkey}/${propAddress.toBase58()}`, { replace: true });
            navigate(`/cachedgovernance/${cachedRealm.pubkey}`, {replace: true});
          }, 5000); // 5000 milliseconds = 5 seconds
          return () => clearTimeout(redirectTimer);
        } else{
          enqueueSnackbar(`An error occured...`,{ variant: 'error' });
          setCreateDisabled(false);
        }

        /*
          const signedTransaction2 = await sendTransaction(propTx, connection);
              
          const snackprogress = (key:any) => (
              <CircularProgress sx={{padding:'10px'}} />
          );
          const cnfrmkey = enqueueSnackbar('Confirming transaction',{ variant: 'info', action:snackprogress, persist: true });
          const latestBlockHash = await connection.getLatestBlockhash();
          await connection.confirmTransaction({
              blockhash: latestBlockHash.blockhash,
              lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
              signature: signedTransaction2}, 
              'processed'
          );
          closeSnackbar(cnfrmkey);
          const snackaction = (key:any) => (
              <Button href={`https://explorer.solana.com/tx/${signedTransaction2}`} target='_blank'  sx={{color:'white'}}>
                  {signedTransaction2}
              </Button>
          );
          enqueueSnackbar('Transaction completed',{ variant: 'success', action:snackaction });
        */
      } else{
        enqueueSnackbar(`No Wallet Connected!`,{ variant: 'error' });
        setCreateDisabled(false);
      }

    }
      
    function handleDescriptionChange(text:string){
      setDescription(text);
      setIsGistDescription(false);
      try{
        const url = new URL(text);
        const pathname = url.pathname;
        const parts = pathname.split('/');
        //console.log("pathname: "+pathname)
        let tGist = null;
        if (parts.length > 1)
            tGist = parts[2];
        
        //setGist(tGist);

        //const rpd = await resolveProposalDescription(thisitem.account?.descriptionLink);
        //setProposalDescription(rpd);
        setIsGistDescription(true);
      
        
    } catch(e){
        console.log("ERR: "+e)
    }
      
    }

    function ProposalSelect() {
      
      const handleProposalTypeChange = (event: SelectChangeEvent) => {
        setProposalType(event.target.value as string);
      };
    
      return (
        <Box sx={{ minWidth: 120, ml:1 }}>
          <FormControl fullWidth>
            <InputLabel id="proposal-select-label">Proposal Instructions</InputLabel>
            <Select
              labelId="proposal-select-label"
              id="proposal-select"
              value={proposalType}
              label="Proposal Instructions"
              onChange={handleProposalTypeChange}
            >
              <MenuItem value={1}>None</MenuItem>
              {/*<MenuItem value={2} disabled>Custom</MenuItem>*/}
              <MenuItem value={3} disabled>Import from base58</MenuItem>
              <MenuItem value={4}>Token Transfer</MenuItem>
              <MenuItem value={5}>Swap</MenuItem>
            </Select>
          </FormControl>
        </Box>
      );
    }

    const getGovernanceRules = async (realmConfigPk: string) => {
      try{
        const govRules = await getRealmConfig(connection, new PublicKey(realmConfigPk));

        console.log("govRules: "+JSON.stringify(govRules))

        setGovernanceRules(govRules);
      }catch(e){
        console.log("ERR: "+e)
      }
    }

    function GovernanceSelect() {
      
      const handleGovernanceWalletChange = (event: SelectChangeEvent) => {
        console.log("menu item: "+event.target.value)
        setGovernanceWallet(event.target.value as string);
        getGovernanceRules(event.target.value)

      };
    
      return (
        <>
          <Box sx={{ minWidth: 120, ml:1 }}>
            <FormControl fullWidth>
              <InputLabel id="governance-wallet-select-label">Governance Wallet</InputLabel>
              <Select
                labelId="governance-wallet-select-label"
                id="governance-wallet-select"
                value={governanceWallet}
                label="Governance Wallet"
                onChange={handleGovernanceWalletChange}
              > 
                {cachedTreasury && cachedTreasury
                  .sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                  .map((item: any, key: number) => {
                    if (item.vault?.nativeTreasuryAddress) {
                      return (
                        <MenuItem key={key} value={item.vault.pubkey}>
                            {/*console.log("wallet: "+JSON.stringify(item))*/}
                            
                            <Grid container>
                              <Grid item xs={12}>
                                <Grid container>
                                  <Grid item sm={8}>
                                    <Grid
                                      container
                                      direction="row"
                                      justifyContent="left"
                                      alignItems="left"
                                    >
                                      <AccountBalanceWalletIcon fontSize='inherit' sx={{mr:1}}/>
                                      {item.vault?.nativeTreasury?.vault.pubkey}
                                    </Grid>
                                  </Grid>
                                  <Grid item xs sx={{textAlign:'right'}}>
                                    <Typography variant="caption">
                                      {item.vault?.nativeTreasury?.solBalance/(10 ** 9)} sol - {item.vault?.nativeTreasury?.tokens?.value.length} tokens
                                    </Typography>
                                  </Grid>
                                </Grid>  
                              </Grid>
                              
                              <Grid item xs={12}>
                                <Grid container>
                                  <Grid item sm={8}>
                                    <Grid
                                      container
                                      direction="row"
                                      justifyContent="left"
                                      alignItems="left"
                                    >
                                      <Typography variant="caption">
                                        <SubdirectoryArrowRightIcon fontSize='inherit' sx={{ml:1, mr:1}}/>
                                        {item.vault.pubkey} - {item.vault.isGovernanceVault && `rules wallet`}
                                      </Typography>
                                    </Grid>

                                  </Grid>
                                  <Grid item xs sx={{textAlign:'right'}}>
                                    <Typography variant="caption">
                                      {item.solBalance/(10 ** 9)} sol - {item?.tokens?.value.length} tokens
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Grid>

                            </Grid>
                        </MenuItem>
                      );
                    } else {
                      return null; // Don't render anything for items without nativeTreasuryAddress
                    }
                  })}
              </Select>
            </FormControl>
          </Box>
        </>
      );
    }

    function MinHeightTextarea() {
        const blue = {
          100: '#DAECFF',
          200: '#b6daff',
          400: '#3399FF',
          500: '#007FFF',
          600: '#0072E5',
          900: '#003A75',
        };
      
        const grey = {
          50: '#f6f8fa',
          100: '#eaeef2',
          200: '#d0d7de',
          300: '#afb8c1',
          400: '#8c959f',
          500: '#6e7781',
          600: '#57606a',
          700: '#424a53',
          800: '#32383f',
          900: '#24292f',
        };
      
        const StyledTextarea = styled(TextareaAutosize)(
          ({ theme }) => `
          width: 100%;
          font-family: IBM Plex Sans, sans-serif;
          font-size: 0.875rem;
          font-weight: 400;
          line-height: 1.5;
          padding: 12px;
          //border-radius: 17px 17px 0 17px;
          color: ${theme.palette.mode === 'dark' ? grey[300] : grey[900]};
          background: none;//${theme.palette.mode === 'dark' ? grey[900] : '#fff'};
          //border: 1px solid #fff;
          border: 1px solid ${theme.palette.mode === 'dark' ? grey[700] : grey[200]};
          //box-shadow: 0px 2px 2px ${theme.palette.mode === 'dark' ? grey[900] : grey[50]};
        
          &:hover {
            border-color: ${blue[400]};
          }
        
          &:focus {
            border-color: ${blue[400]};
            box-shadow: 0 0 0 3px ${theme.palette.mode === 'dark' ? blue[500] : blue[200]};
          }
        
          // firefox
          &:focus-visible {
            outline: 0;
          }
        `,
        );
      
        return (
          <StyledTextarea
            aria-label="minimum height"
            minRows={3}
            placeholder="Minimum 3 rows"
          />
        );
      }

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            let tmap  = null;
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tokenMp = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map());
                setTokenMap(tokenMp);
                setTokenArray(tarray);
                tmap = tokenMp;
            });
            return tmap;
        } catch(e){console.log("ERR: "+e); return null;}
    }

    const getRealmDetails = async () => {
        let grealm = null;
        if (cachedRealm){
            console.log("Realm from cache")
            grealm = cachedRealm;
        } else{
            grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
        }
        const realmPk = new PublicKey(grealm.pubkey);
        setRealm(grealm);
        setRealmName(grealm.account.name);
    }

    const getCachedGovernanceFromLookup = async () => {
        
        let cached_governance = new Array();
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){

                    if (glitem?.realm){
                        setCachedRealm(glitem?.realm);
                    }

                    if (glitem?.governanceVaultsFilename){
                        const cached_treasury = await getFileFromLookup(glitem.governanceVaultsFilename, storagePool);
                        // merge treasury with only the wallet rules addresses
                        for (let item of cached_treasury) {
                          if (item.vault.nativeTreasuryAddress) {
                            for (let citem of cached_treasury) {
                              if (citem.vault.pubkey === item.vault.nativeTreasuryAddress) {
                                // push native treasury holdings to an object
                                console.log("citem "+JSON.stringify(citem))
                                if (!item.vault?.nativeTreasury)
                                  item.vault.nativeTreasury = citem;
                              }
                            }
                          }
                        }

                        console.log("merged_treasury: "+JSON.stringify(cached_treasury))

                        setCachedTreasury(cached_treasury);
                    }

                    setRealmName(glitem.governanceName);

                    setTotalGovernanceValue(glitem?.totalVaultValue);
                    setTotalGovernanceSolValue(glitem?.totalVaultSolValue);
                    setTotalGovernanceSol(glitem?.totalVaultSol);
                    setTotalGovernanceNftFloorValue(glitem?.totalVaultNftValue);
                    setTotalGovernanceStableCoinValue(glitem?.totalVaultStableCoinValue);

                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);
                    setCachedTimestamp(glitem.timestamp);
                }
            }
        }

        
        setCachedGovernance(cached_governance);
        endTimer();
    }

    const startTimer = () => {
        setStartTime(Date.now());
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    React.useEffect(() => {
        if (governanceLookup){
            getCachedGovernanceFromLookup();
        }
    }, [governanceLookup, governanceAddress]);
    
    React.useEffect(() => { 
        if (tokenMap){  
            startTimer();
            callGovernanceLookup();
        }
    }, [tokenMap]);

    React.useEffect(() => { 
        if (!loading){
            if (!tokenMap){
                getTokens();
            }
        }
    }, []);

    return (
        <>
            <Box
                    sx={{
                        mt:6,
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '17px',
                        overflow: 'hidden',
                        p:4
                    }} 
                > 
            <>
                    {showGovernanceTitle && realmName && 
                        <Grid container>
                            <Grid item xs={12} sm={6} container justifyContent="flex-start">
                                <Grid container>
                                    <Grid item xs={12}>
                                        <Typography variant="h4">
                                            Create Proposal
                                        </Typography>
                                    </Grid>
                                    
                                    
                                    <Grid item xs={12}>
                                      <ButtonGroup    
                                          variant="outlined" 
                                          color='inherit'
                                      >
                                        <Tooltip title={`Back to ${governanceAddress} Governance`}>
                                          <Button
                                                sx={{
                                                  borderRadius:'17px',
                                                  borderColor:'rgba(255,255,255,0.05)',
                                                  fontSize:'10px'}}
                                                component={Link}
                                                to={'/cachedgovernance/'+governanceAddress}
                                            >
                                                <ArrowBackIcon fontSize='inherit' sx={{mr:1}} /> Back
                                            </Button>
                                          </Tooltip>
                                          <Button
                                              sx={{
                                                borderRadius:'17px',
                                                borderColor:'rgba(255,255,255,0.05)',
                                                fontSize:'10px'}}
                                              href={`https://realms.today/dao/${governanceAddress}`}
                                              target='blank'
                                          >
                                            <OpenInNewIcon fontSize='inherit' sx={{mr:1}} /> Realms
                                          </Button>
                                        </ButtonGroup>
                                    </Grid>
                                    
                                </Grid>
                            </Grid>
                        </Grid>
                    }
                </>

              <Grid 
                  xs={12}
                  sx={{
                      '& .MuiTextField-root': { m: 1 },
                      '& .MuiSwitch-root': { m: 1 }
                  }}
              >
                  <Box
                      sx={{
                          borderRadius:'17px',
                          backgroundColor:'rgba(0,0,0,0.2)', 
                          p:1,pr:3,mt:2}}
                  >
                      <FormControl fullWidth  sx={{mb:2}}>
                          <TextField 
                              fullWidth 
                              label="Title" 
                              id="fullWidth"
                              value={title}
                              onChange={(e) => {
                                  if (!title || title.length < maxTitleLen)
                                      setTitle(e.target.value)
                                  }}
                              sx={{borderRadius:'17px', maxlength:maxTitleLen}} 
                          />
                          <Grid sx={{textAlign:'right',}}>
                          <Typography variant="caption">{title ? title.length > 0 ? maxTitleLen - title.length : maxTitleLen : maxTitleLen} characters remaining</Typography>
                          </Grid>
                      </FormControl>

                      <FormControl fullWidth  sx={{mb:2}}>
                          <TextField 
                              fullWidth
                              label="Description"
                              multiline
                              rows={4}
                              maxRows={4}
                              value={description}
                              onChange={(e) => {
                                  if (!description || description.length < maxDescriptionLen)
                                      handleDescriptionChange(e.target.value)
                                  }}
                              
                              sx={{maxlength:maxDescriptionLen}}
                              />
                          <Grid sx={{textAlign:'right',}}>

                            {isGistDescription ?
                              <Button
                                  color='inherit'
                                  size='small'
                                  href={description}
                                  sx={{borderRadius:'17px'}}
                              >
                                  <GitHubIcon sx={{mr:1}} /> GIST
                              </Button>
                            :

                              <Typography variant="caption">{description ? description.length > 0 ? maxDescriptionLen - description.length : maxDescriptionLen : maxDescriptionLen} characters remaining</Typography>
                            }
                          </Grid>
                          
                      </FormControl>
                      
                      <FormControl fullWidth  sx={{mb:2}}>
                          <GovernanceSelect />
                      </FormControl>
                      
                      {governanceWallet && 
                      <>
                        <FormControl fullWidth sx={{mb:2}}>
                            <ProposalSelect />
                        </FormControl>
                        
                      </>
                      }
                      <FormControl fullWidth >
                          <FormControlLabel  disabled={true} required control={<Switch />} label="Multiple Choice Vote" />
                      </FormControl>
                      
                      <FormControl fullWidth >
                          <FormControlLabel 
                            required 
                            control={
                              <Switch 
                                onChange={
                                  (e) => {
                                    setIsCouncilVote(e.target.checked)
                                  }
                                }
                              />
                            } 
                            label="Council Vote" />
                      </FormControl>

                      <Grid sx={{textAlign:'right'}}>
                        <Button 
                          disabled={!(
                            (title && title.length > 0) &&
                            (description && description.length > 0) &&
                            (proposalType) &&
                            (!createDisabled)
                            )
                          }
                          onClick={createProposal}
                          variant="contained"
                          color="success"
                          sx={{borderRadius:'17px'}}>
                            <Confetti
                                active={ proposalMade }
                                config={ confettiConfig }
                            />        
                            Create Proposal</Button>
                      </Grid>
                      
                  </Box>

              </Grid>
            </Box>

        </>
    );

}