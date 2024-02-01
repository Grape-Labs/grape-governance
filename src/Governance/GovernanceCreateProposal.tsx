import { PublicKey, TokenAmount, Connection, Transaction, TransactionInstruction } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError, TransactionOrVersionedTransaction } from '@solana/wallet-adapter-base';
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
//import { useHistory } from "react-router";
import { styled, useTheme } from '@mui/material/styles';
import Confetti from 'react-dom-confetti';
import { useSnackbar } from 'notistack';
import { createProposalInstructionsLegacy } from './Proposals/createProposalInstructionsLegacy';
import { createProposalInstructionsV0, InstructionDataWithHoldUpTime } from './Proposals/createProposalInstructionsV0';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import ExplorerView from '../utils/grapeTools/Explorer';

import {
  Typography,
  Tooltip,
  Button,
  Grid,
  Box,
  ButtonGroup,
  TextField,
  TextareaAutosize,
  Switch,
  FormControlLabel,
  FormGroup,
  FormControl,
  MenuItem,
  InputLabel,
  CircularProgress,
  List,
  ListItem,
  IconButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  LinearProgress,
  Divider,
} from '@mui/material/';

import TollIcon from '@mui/icons-material/Toll';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GavelIcon from '@mui/icons-material/Gavel';
import FlakyIcon from '@mui/icons-material/Flaky';
import DeleteIcon from '@mui/icons-material/Delete';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LanguageIcon from '@mui/icons-material/Language';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GitHubIcon from '@mui/icons-material/GitHub';
import DiscordIcon from '../components/static/DiscordIcon';

import Select, { SelectChangeEvent } from '@mui/material/Select';

import { GovernanceGistDialog } from './GovernanceGistDialog';

//import StreamflowPaymentsView from './plugins/instructions/StreamflowPaymentsView';
import IntraDAOProposalView from './plugins/instructions/IntraDAOProposalView';
import IntraDAOGrantView from './plugins/instructions/IntraDAOGrantView';
import IntraDAOGrantV0View from './plugins/instructions/versioned/IntraDAOGrantV0View';
import IntraDAOJoinView from './plugins/instructions/IntraDAOJoinView';
import IntraDAOVoteView from './plugins/instructions/IntraDAOVoteView';
import LookupTableView from './plugins/instructions/LookupTableView';
import SNSView from './plugins/instructions/SNSView';
import CloseTokenView from './plugins/instructions/CloseTokenView';
import TokenTransferView from './plugins/instructions/TokenTransferView';
import TokenTransferV0View from './plugins/instructions/versioned/TokenTransferV0View';
import JupiterDCAView from './plugins/instructions/JupiterDCAView';
//import JupiterSwapView from './plugins/instructions/JupiterSwapView';
import JupiterSwapView from './plugins/instructions/versioned/JupiterSwapV6View';
import PhoenixSwapView from './plugins/instructions/PhoenixSwapView';
import BuyOnMEView from './plugins/instructions/BuyOnMEView';
import ListOnMEView from './plugins/instructions/ListOnMEView';
import ListOnTensorView from './plugins/instructions/ListOnTensorView';
import { Title } from '@devexpress/dx-react-chart';

import { 
  PROXY, 
  RPC_CONNECTION,
  GGAPI_STORAGE_POOL, 
  GGAPI_STORAGE_URI,
  PROP_TOKEN
} from '../utils/grapeTools/constants';

import { 
  shortenString,
  isGated,
  findObjectByGoverningTokenOwner,
  convertSecondsToLegibleFormat,
} from '../utils/grapeTools/helpers';

import { 
  getRealm, 
  createInstructionData, 
  getRealmConfig,
  getVoterWeightRecord,
  getVoterWeightRecordAddress,
  getMaxVoterWeightRecord,
} from '@solana/spl-governance';
import { 
  getRealmIndexed,
  getProposalIndexed,
  getProposalNewIndexed,
  getAllProposalsIndexed,
  getGovernanceIndexed,
  getAllGovernancesIndexed,
  getAllTokenOwnerRecordsIndexed,
  getTokenOwnerRecordsByRealmIndexed,
  getProposalInstructionsIndexed
} from './api/queries';


import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

const CustomTextarea = styled(TextareaAutosize)(({ theme }) => ({
  width: '100%', // Make it full width
  backgroundColor: '#333', // Change the background color to dark
  color: '#fff', // Change the text color to white or another suitable color
  border: 'none', // Remove the border (optional)
  padding: theme.spacing(1), // Add padding (optional)
}));

const enum GoverningTokenType {
  Liquid = 0,
  Membership = 1,
  Dormant = 2,
}

const enum GovernanceAccountType {
  Uninitialized = 0,
  RealmV1 = 1,
  TokenOwnerRecordV1 = 2,
  GovernanceV1 = 3,
  ProgramGovernanceV1 = 4,
  ProposalV1 = 5,
  SignatoryRecordV1 = 6,
  VoteRecordV1 = 7,
  ProposalInstructionV1 = 8,
  MintGovernanceV1 = 9,
  TokenGovernanceV1 = 10,
  RealmConfig = 11,
  VoteRecordV2 = 12,
  ProposalTransactionV2 = 13,
  ProposalV2 = 14,
  ProgramMetadata = 15,
  RealmV2 = 16,
  TokenOwnerRecordV2 = 17,
  GovernanceV2 = 18,
  ProgramGovernanceV2 = 19,
  MintGovernanceV2 = 20,
  TokenGovernanceV2 = 21,
  SignatoryRecordV2 = 22,
  ProposalDeposit = 23,
}

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
  perspective: "285px",
  colors: ["#f00", "#0f0", "#00f"]
};

export default function GovernanceCreateProposalView(props: any){
    const navigate = useNavigate();  
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    //const governanceAddress = urlParams;
    const setReload = props?.setReload;
    const editProposalAddress = props?.editProposalAddress;
    const governanceAddress = props?.governanceAddress || urlParams;
    const governanceWallets = props?.governanceWallets;
    const sentRulesAddress = props?.governanceRulesWallet;
    const sentGovernanceWallet = props?.governanceWallet;
    const setEditPropOpen = props?.setEditPropOpen;
    const setSentInstructionsObject = props?.setInstructionsObject;
    const intraDAO = props?.governanceAddress ? true : false;
    const usePlugin = props?.usePlugin;
    const fromDialog = props?.fromDialog;
    const showGovernanceTitle = true;
    const [title, setTitle] = React.useState(null);
    const [description, setDescription] = React.useState(null);
    const maxTitleLen = 130;
    const maxDescriptionLen = 350;//512;
    const [proposalType, setProposalType] = React.useState(usePlugin || null);
    const sentGoverningTokenMint = props?.governingTokenMint;
    const [isCouncilVote, setIsCouncilVote] = React.useState(false);
    const [governanceWallet, setGovernanceWallet] = React.useState(null);
    const [governanceWalletMinInstructHoldUpTime, setGovernanceRulesWalletMinInstructHoldUpTime] = React.useState(null);
    const [instructionsDataWithHoldUpTime, setInstructionsDataWithHoldUpTime] = React.useState(null);
    const [governanceRulesWallet, setGovernanceRulesWallet] = React.useState(null);
    const [isGistDescription, setIsGistDescription] = React.useState(false);
    const { publicKey, sendTransaction } = useWallet();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const connection = RPC_CONNECTION;
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [realtimeGovernance, setRealtimeGovernance] = React.useState(null);
    const [cachedGovernance, setCachedGovernance] = React.useState(null);
    const [tokenInfo, setTokenInfo] = React.useState(null);
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
    const [instructionsObject, setInstructionsObject] = React.useState(null);
    const [instructionsArray, setInstructionsArray] = React.useState([]);
    const [communitySupport, setCommunitySupport] = React.useState(false);

    const [governanceRules, setGovernanceRules] = React.useState(null);
    const [totalGovernanceValue, setTotalGovernanceValue] = React.useState(null);
    const [totalGovernanceSolValue, setTotalGovernanceSolValue] = React.useState(null);
    const [totalGovernanceSol, setTotalGovernanceSol] = React.useState(null);
    const [totalGovernanceNftFloorValue, setTotalGovernanceNftFloorValue] = React.useState(null);
    const [totalGovernanceStableCoinValue, setTotalGovernanceStableCoinValue] = React.useState(null);

    const proposalAuthor=props?.proposalAuthor;
    const [proposalSimulation, setProposalSimulation] = React.useState(null);
    const [proposalSimulationUnitsConsumed, setProposalSimulationUnitsConsumed] = React.useState(null);
    const [proposalSimulationLogs, setProposalSimulationLogs] = React.useState(null);
    const [proposalSimulationErr, setProposalSimulationErr] = React.useState(null);
    const [proposalInstructions, setProposalInstructions] = React.useState(null);
    const [verified, setVerified] = React.useState(false);
    const [isProposer, setIsProposer] = React.useState(false);
    const [isCopied, setIsCopied] = React.useState(false);

    const anchorWallet = useAnchorWallet();

    const handleCopy = () => {
      setIsCopied(true);
    };

    /*
    function getTokenTypeString(tokenTypeValue: any) {
      const tokenTypeEnumKey = Object.keys(GoverningTokenType).find(
        (key) => GoverningTokenType[key] === tokenTypeValue
      );
    
      if (tokenTypeEnumKey !== undefined) {
        return tokenTypeEnumKey;
      } else {
        return "Unknown"; // Or handle the case where the value is not found in the enum
      }
    }

    function getAccountTypeString(accountTypeValue: any) {
      const accountTypeEnumKey = Object.keys(GovernanceAccountType).find(
        (key) => GovernanceAccountType[key] === accountTypeValue
      );
    
      if (accountTypeEnumKey !== undefined) {
        return accountTypeEnumKey;
      } else {
        return "Unknown"; // Or handle the case where the value is not found in the enum
      }
    }
    */

    const SECONDS_PER_DAY = 86400
    
     function getTimestampFromDays(days: number) {
       return days * SECONDS_PER_DAY
     }
    

    const calculateProposalFee = async() => {
      // get governance settings
      // 1. Generate the instructions to pass to governance
      const transaction = new Transaction();
      const authTransaction = new Transaction();
      // using instructionsArray iterate and generate the transaction
      if (instructionsArray && instructionsArray.length > 0){
        for (let instructionItem of instructionsArray){
          if (instructionItem?.authorInstructions)
            authTransaction.add(instructionItem.authorInstructions);
          if (instructionItem.governanceInstructions)
            transaction.add(instructionItem.governanceInstructions);
        }
      }

      //enqueueSnackbar(`Preparing Governance Proposal`,{ variant: 'info' });
      // 2. call createDAOProposal.tsx with the respective variables to create the prop and return to execute
      // temporarily use a static program id, make it dynamic for more flexibility
      const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

      const programId = new PublicKey(cachedRealm?.owner || GOVERNANCE_PROGRAM_ID);
      let governingTokenMint = new PublicKey(cachedRealm.account?.communityMint);
      
      let councilVote = isCouncilVote;

      if (sentGoverningTokenMint){
        if (new PublicKey(cachedRealm.account?.councilMint).toBase58() === new PublicKey(sentGoverningTokenMint).toBase58()){
          councilVote = true;
        } else{
          councilVote = false;
        }
      }

      if (councilVote){
        governingTokenMint = new PublicKey(cachedRealm.account?.config?.councilMint);
      }

      if (publicKey){
        let propSimulation = null;
        
        if (instructionsDataWithHoldUpTime){
          console.log("Creating Proposal using v0 tx")
          propSimulation = await createProposalInstructionsV0(
            programId,
            new PublicKey(cachedRealm.pubkey),
            new PublicKey(governanceRulesWallet),
            governingTokenMint,
            publicKey,
            title,
            description,
            connection,
            transaction,
            authTransaction,
            anchorWallet,//anchorWallet,
            null,
            instructionsDataWithHoldUpTime,
            true,
            null,
            editProposalAddress,
          );
        } else{
          console.log("Creating Proposal using legacy tx")
          propSimulation = await createProposalInstructionsLegacy(
            programId,
            new PublicKey(cachedRealm.pubkey),
            new PublicKey(governanceRulesWallet),
            governingTokenMint,
            publicKey,
            title,
            description,
            connection,
            transaction,
            authTransaction,
            anchorWallet,//anchorWallet,
            null,
            true,
            null,
            editProposalAddress,
          );
        }
        //console.log("Simulation: ",propSimulation);
        //console.log("Simulation string: "+JSON.stringify(propSimulation));
        
        if (propSimulation){
          if (propSimulation?.err)
            setProposalSimulationErr(JSON.stringify(propSimulation?.err));
          setProposalSimulationLogs(propSimulation?.logs);
          setProposalSimulationUnitsConsumed(propSimulation?.unitsConsumed);
        } else{
          setProposalSimulationErr("Could not simulate...");
        }

        //setProposalSimulation((JSON.stringify(propSimulation)));
      }  
    }

    const simulateProposal = async() => {
      calculateProposalFee();
    }
    
    const createProposal = async(isDraft: boolean, returnTx?: boolean) => {
      
      // get governance settings
      setCreateDisabled(true);
      
      enqueueSnackbar(`Assembling Governance Transactions`,{ variant: 'info' });
      // 1. Generate the instructions to pass to governance
      const transaction = new Transaction();
      const authTransaction = new Transaction();
      // using instructionsArray iterate and generate the transaction
      if (instructionsArray && instructionsArray.length > 0){
        for (let instructionItem of instructionsArray){
          if (instructionItem.governanceInstructions){
            transaction.add(instructionItem.governanceInstructions);
          }if (instructionItem?.authorInstructions)
            authTransaction.add(instructionItem.authorInstructions);
        }
      }

      //enqueueSnackbar(`Preparing Governance Proposal`,{ variant: 'info' });
      // 2. call createDAOProposal.tsx with the respective variables to create the prop and return to execute
      // temporarily use a static program id, make it dynamic for more flexibility
      const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
      const programId = new PublicKey(cachedRealm?.owner || GOVERNANCE_PROGRAM_ID);

      //const governingTokenMint = new PublicKey('8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA');
      /*
      console.log("cachedRealm: "+JSON.stringify(cachedRealm));
      console.log("cachedRealm.pubkey: "+JSON.stringify(cachedRealm.pubkey));
      console.log("governanceWallet: "+JSON.stringify(governanceWallet));
      console.log("governanceRulesWallet: "+JSON.stringify(governanceRulesWallet));
      */
      let governingTokenMint = new PublicKey(cachedRealm.account?.communityMint);
      
      let councilVote = isCouncilVote;

      if (sentGoverningTokenMint){
        if (governingTokenMint.toBase58() === new PublicKey(sentGoverningTokenMint).toBase58()){
          councilVote = false;
        } else{
          councilVote = true;
        }
      }

      if (councilVote){
        governingTokenMint = new PublicKey(cachedRealm.account?.config?.councilMint);
      }
      
      if (publicKey){
        // check if !whitelisted otherwise add a memo:
        const memoText = "Created on Governance by Grape - Building a new DAO Experience on Solana";
        const whitelisted = false;
        /*
        if (!whitelisted){
          if (memoText && memoText.length > 0){
            transaction.add(
                new TransactionInstruction({
                    keys: [{ pubkey: new PublicKey(governanceRulesWallet), isSigner: true, isWritable: true }],
                    data: Buffer.from(JSON.stringify(memoText || ''), 'utf-8'),
                    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
                })
            );
          }
        }
        */
        
        const snackprogress = (key:any) => (
          <CircularProgress sx={{padding:'10px'}} />
        );
        const cnfrmkey = enqueueSnackbar('Creating Governance Proposal',{ variant: 'info', action:snackprogress, persist: true });
        
        let propResponse = null;

        if (instructionsDataWithHoldUpTime){
          console.log("in v0")
          propResponse = await createProposalInstructionsV0(
            programId,
            new PublicKey(cachedRealm.pubkey),
            new PublicKey(governanceRulesWallet),
            governingTokenMint,
            publicKey,
            title,
            description,
            connection,
            transaction,
            authTransaction,
            anchorWallet,
            null,//sendTransaction,
            instructionsDataWithHoldUpTime, //instructionsArray //nstructions,
            isDraft,
            returnTx,
            intraDAO ? new PublicKey(sentGovernanceWallet || publicKey) : publicKey,
            editProposalAddress
          );
        } else{
          console.log("in legacy")
          propResponse = await createProposalInstructionsLegacy(
            programId,
            new PublicKey(cachedRealm.pubkey),
            new PublicKey(governanceRulesWallet),
            governingTokenMint,
            intraDAO ? new PublicKey(sentGovernanceWallet || publicKey) : publicKey,
            title,
            description,
            connection,
            transaction,
            authTransaction,
            anchorWallet,//anchorWallet,
            null,//sendTransaction,
            isDraft,
            returnTx,
            intraDAO ? new PublicKey(sentGovernanceWallet || publicKey) : publicKey,
            editProposalAddress
          );
        }
        
        closeSnackbar(cnfrmkey);
        
        if (returnTx){
          console.log("returnTx: "+JSON.stringify(propResponse));
          if (setSentInstructionsObject){
            //setSentInstructionsObject(propResponse);
            let tdescription = '';
            tdescription = `Creating DAO Proposal at ${cachedRealm.pubKey} using ${governingTokenMint} Governing Token Mint`;
            
            setSentInstructionsObject({
                "type":`Create DAO Proposal`,
                "description":tdescription,
                "governanceInstructions":propResponse,
                "authorInstructions":null,
                "transactionEstimatedFee":null,
            });
          }
        } else{
          //await createProposalInstructions()
            
          console.log("propAddress: "+JSON.stringify(propResponse));
          
          if (propResponse && propResponse?.address && (propResponse?.response || propResponse?.transactionSuccess)){ // only move this route if we have a propTx returned (otherwise we are running in the function above)
            
            const snackaction = (key:any) => (
              <Button href={`https://governance.so/proposal/${cachedRealm.pubkey}/${propResponse.address.toBase58()}`} target='_blank'  sx={{color:'white'}}>
                  {propResponse.proposalAddress.toBase58()}
              </Button>
            );
            
            //enqueueSnackbar('Governance Transaction completed - redirecting in 5 seconds to proposal',{ variant: 'success', action:snackaction });
            
            const snackprogress = (key:any) => (
              <CircularProgress sx={{padding:'10px'}} />
            );
            const cnfrmkey = enqueueSnackbar('Redirecting in a few seconds to the proposal',{ variant: 'success', action:snackprogress, persist: true });

            setProposalMade(true);
            if (setEditPropOpen)
              setEditPropOpen(false);

            if (setReload) 
              setReload(true);

            // redirect to proposal
            const redirectTimer = setTimeout(() => {
              //navigate(`/proposal/${cachedRealm.pubkey}/${propAddress.toBase58()}`, { replace: true });
              closeSnackbar(cnfrmkey);
              navigate(`/dao/${cachedRealm.pubkey}`, {replace: true});
            }, 12500); // 12500 milliseconds = 12.5 seconds
            
            return () => clearTimeout(redirectTimer);
          } else if (propResponse && propResponse.address){
            const snackaction = (key:any) => (
              <Button href={`https://governance.so/proposal/${cachedRealm.pubkey}/${propResponse.address.toBase58()}`} target='_blank'  sx={{color:'white'}}>
                  {propResponse.proposalAddress.toBase58()}
              </Button>
            );
            enqueueSnackbar('Redirecting in a few seconds to the proposal',{ variant: 'info', action:snackprogress });
            setCreateDisabled(false);
          } else{
            enqueueSnackbar(`An error occured...`,{ variant: 'error' });
            setCreateDisabled(false);
          }
        }
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
        const seltype = event.target.value as string;
        if (seltype)
          setProposalType(seltype);
      };
    
      return (
        <Box sx={{ minWidth: 120, ml:1 }}>
          <FormControl fullWidth>
            <InputLabel id="proposal-select-label">Proposal Instructions</InputLabel>
            <Select
              labelId="proposal-select-label"
              id="proposal-select"
              value={proposalType ? proposalType : 1}
              label="Proposal Instructions"
              onChange={handleProposalTypeChange}
            >
              <MenuItem value={1}>None</MenuItem>
              {/*<MenuItem value={2} disabled>Custom</MenuItem>*/}
              <MenuItem value={3} disabled>Import from base58</MenuItem>
              <Divider/>
              <MenuItem value={20} 
                disabled={(
                  governanceAddress !== 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip' && 
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' && 
                  governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
              >Speed Dial</MenuItem>
              {/*MenuItem value={30} 
                disabled={governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' ? true : false}
              >Create Token *Token 2022</MenuItem>*/}
              <MenuItem value={4}>Token Transfer</MenuItem>
              <MenuItem value={5}>SOL Transfer</MenuItem>
              {(governanceAddress === 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2')
                &&
                  <MenuItem value={104}>Token Transfer v0</MenuItem>
              }
              {(governanceAddress === 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2')
                &&
                  <MenuItem value={105}>SOL Transfer v0</MenuItem>
              }
              <MenuItem value={10}>Close Token Account</MenuItem>
              <MenuItem value={11}>SNS Transfer</MenuItem>
              <Divider/>
              <MenuItem value={30}
                /*
                disabled={(
                  governanceAddress !== 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip' && 
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' && 
                  governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
                */
              >Intra DAO: Join a DAO</MenuItem>
              <MenuItem value={31}
                /*
                disabled={(
                  governanceAddress !== 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip' && 
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' && 
                  governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
                */
              >Intra DAO: Vote on a DAO Proposal</MenuItem>
              <MenuItem value={33}
                /*
                disabled={(
                  governanceAddress !== 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip' && 
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' 
                  //&& 
                  //governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
                */
              >Intra DAO: Make a DAO Proposal</MenuItem>
              <MenuItem value={32}
                /*
                disabled={(
                  governanceAddress !== 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip' && 
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' && 
                  governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
                */
              >Intra DAO: Grant DAO Voting Power</MenuItem>
              {(governanceAddress === 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2')
                &&
                  <MenuItem value={132}>Intra DAO: Grant DAO Voting Power v0</MenuItem>
              }

              <Divider />

              <MenuItem value={50}
                disabled={true}
              >Payments</MenuItem>
              <MenuItem value={51}
                disabled={true}
              >Vesting</MenuItem>
              <MenuItem value={52}
                disabled={true}
              >Token Lock</MenuItem>

              <Divider/>
              <MenuItem value={9}
                disabled={governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' ? true : false}
              >Swap</MenuItem>
              <MenuItem value={8} 
                disabled={(
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' && 
                  governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
              >DCA / Scheduled Swap</MenuItem>
               
              <Divider />

              <MenuItem value={40}
                disabled={(
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' && 
                  governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
              >List on Magic Eden</MenuItem>
              
              <MenuItem value={41}
                disabled={(
                  governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' && 
                  governanceAddress !== 'jtncbMzs2k3wypGiLBtM55ou3mFERpeZniH7V1Bq4zg'
                ) ? true : false}
              >Buy from Magic Eden</MenuItem>
              

              {/*governanceAddress !== 'BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2' &&
                <MenuItem value={16}>List on Tensor</MenuItem>
              */}
              {/*
                  <MenuItem value={12} disabled>Lending</MenuItem>
                  <MenuItem value={13} disabled>Staking</MenuItem>
              */}
            </Select>
          </FormControl>
        </Box>
      );
    }

    const getGovernanceRules = async (realmConfigPk: string) => {
      try{

        if (cachedTreasury){
          for (let item of cachedTreasury) {
            if (item.vault.nativeTreasuryAddress === realmConfigPk) {
              console.log("item: "+JSON.stringify(item))
            }
          }


          //const govRules = await getRealmConfig(connection, new PublicKey(realmConfigPk));
          //console.log("govRules ("+realmConfigPk+"): "+JSON.stringify(govRules))

          //const vwr1 = await getVoterWeightRecord(connection, govRules.account.communityTokenConfig.voterWeightAddin);
          //const vwr2 = await getVoterWeightRecord(connection, govRules.communityTokenConfig.voterWeightAddin);
          //console.log("Community voterWeightRecord: "+JSON.stringify(vwr1));
          //const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
          //const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);

          //const vwra = await getVoterWeightRecordAddress(govRules.owner, govRules.account.realm, new PublicKey(realmConfigPk), govRules.owner);
          //console.log("vwra: "+JSON.stringify(vwra));
          //const vwr1 = await getVoterWeightRecord(connection, vwra);
          //console.log("Community voterWeightRecord: "+JSON.stringify(vwr1));
          //const vwr2 = await getVoterWeightRecord(connection, govRules.account.councilTokenConfig.voterWeightAddin);
          //console.log("Council voterWeightRecord: "+JSON.stringify(vwr2));
          
          //setGovernanceRules(govRules);
        }
      }catch(e){
        console.log("ERR: "+e)
      }
    }

    const handleNativeWalletFromRules = (rulesWallet:string) => {//(nativeWallet: string, rulesWallet: string) => {
      getGovernanceRules(rulesWallet);
      setGovernanceRulesWallet(rulesWallet);
      
      let nativeWallet = null;
      //console.log("menu item: "+JSON.stringify(nativeWallet))
      setCommunitySupport(false);
      setIsCouncilVote(false);
      //setIsCouncilVote(false);
      // get rules wallet:
      let minInstructionHoldUpTime = null;

      {cachedTreasury && cachedTreasury
        .sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
        .map((item: any, key: number) => {
            if (rulesWallet === item.vault.pubkey){
              nativeWallet = item.vault?.nativeTreasury
              minInstructionHoldUpTime = item.vault.governance.account.config.minInstructionHoldUpTime;
              setGovernanceWallet(nativeWallet);
      
              if (item.vault.governance.account.config.minCommunityTokensToCreateProposal !== 'ffffffffffffffff')
                setCommunitySupport(true);
                setIsCouncilVote(true);
            }
          }
      
      )}

      // use RPC here to get the rules wallet details
      
      setGovernanceRulesWallet(rulesWallet);
      setGovernanceRulesWalletMinInstructHoldUpTime(minInstructionHoldUpTime);

      getGovernanceRules(rulesWallet);
      if (usePlugin)
          setProposalType(usePlugin);
      else
        setProposalType(1);

    };

    function GovernanceSelect() {
      
      const handleGovernanceWalletChange = (event: SelectChangeEvent) => {//(nativeWallet: string, rulesWallet: string) => {
        const nativeWallet = event.target.value as string;
        //console.log("menu item: "+JSON.stringify(nativeWallet))
        
        setGovernanceWallet(nativeWallet);
        setCommunitySupport(false);
        setIsCouncilVote(false);
        //setIsCouncilVote(false);
        // get rules wallet:
        let rulesWallet = null;
        let minInstructionHoldUpTime = null;
        
        {cachedTreasury && cachedTreasury
          .sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
          .map((item: any, key: number) => {
            if (nativeWallet === item.vault?.nativeTreasury){
              rulesWallet = item.vault.pubkey;
              minInstructionHoldUpTime = item.vault.governance.account.config.minInstructionHoldUpTime;
              //console.log("Selected Item: "+JSON.stringify(item));

              if (item.vault.governance.account.config.minCommunityTokensToCreateProposal !== 'ffffffffffffffff')
                setCommunitySupport(true);
                setIsCouncilVote(true);
            }
          }
        )}

        // use RPC here to get the rules wallet details
        
        setGovernanceRulesWallet(rulesWallet);
        setGovernanceRulesWalletMinInstructHoldUpTime(minInstructionHoldUpTime);

        getGovernanceRules(rulesWallet);
        if (usePlugin)
          setProposalType(usePlugin);
        else
          setProposalType(1);

      };

      
    
      return (
        <>
          <Box sx={{ minWidth: 120, ml:1 }}>
          {governanceWallets &&  
            <FormControl fullWidth>
                <InputLabel id="governance-wallet-select-label1">Governance Wallet</InputLabel>
                <Select
                  labelId="governance-wallet-select-label1"
                  id="governance-wallet-select1"
                  value={governanceWallet}
                  label="Governance Wallet"
                  onChange={handleGovernanceWalletChange}
                > 
                {console.log("governanceWallets: "+JSON.stringify(governanceWallets))}
                  {/* USE FRESH DATA */}
                  {governanceWallets && governanceWallets
                    .sort((a:any,b:any) => (b.walletValue - a.walletValue))
                    .map((item: any, key: number) => {
                      if (item.nativeTreasuryAddress) {
                        // rules wallet:
                        // item.vault.pubkey
                        return (
                          <MenuItem key={key} value={item.nativeTreasuryAddress.toBase58()}>
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
                                        {shortenString(item.nativeTreasuryAddress.toBase58(),5,5)} 
                                      </Grid>
                                    </Grid>
                                    <Grid item xs sx={{textAlign:'right'}}>
                                      <Typography variant="caption">
                                        {item?.walletSolValue &&
                                          <>{item.walletSolValue.toFixed(4)}<Typography variant="caption" sx={{color:'#999'}}> SOL</Typography></>
                                        }
                                        {item?.walletValue&&
                                          <>&nbsp;-&nbsp;{item.walletValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}<Typography variant="caption" sx={{color:'#999'}}> USDC</Typography></>
                                        }
                                        
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
                                          {shortenString(item.pubkey.toBase58(),5,5)}
                                        </Typography>
                                      </Grid>

                                    </Grid>
                                    <Grid item xs sx={{textAlign:'right'}}>
                                      <Typography variant="caption">
                                        {(item?.domains && item.domains.length > 0) &&
                                          <><LanguageIcon sx={{fontSize:'10px',mr:0.5}}/> {item.domains[0].name} {item.domains.length > 1 && <sup>{item.domains.length}</sup>}</>}
                                        
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
            }

            <FormControl fullWidth>
              <InputLabel id="governance-wallet-select-label">Governance Wallet</InputLabel>
              <Select
                labelId="governance-wallet-select-label"
                id="governance-wallet-select"
                value={governanceWallet}
                label="Governance Wallet"
                onChange={handleGovernanceWalletChange}
                //onClick={() => handleGovernanceWalletChange(item.vault.nativeTreasury, item.vault.pubkey)}
              > 
                {/* USE CACHE */}
                {cachedTreasury && cachedTreasury
                  .sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                  .map((item: any, key: number) => {
                    if (item.vault?.nativeTreasuryAddress) {
                      // rules wallet:
                      // item.vault.pubkey
                      return (
                        <MenuItem key={key} value={item.vault.nativeTreasury}>
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
                                      {shortenString(item.vault?.nativeTreasury?.vault.pubkey,5,5)} 
                                    </Grid>
                                  </Grid>
                                  <Grid item xs sx={{textAlign:'right'}}>
                                    <Typography variant="caption">
                                      {(item.vault?.nativeTreasury?.solBalance/(10 ** 9)).toFixed(2)} SOL 
                                      {item.vault?.nativeTreasury?.tokens?.value.map((item:any, index:number) => (
                                        <>
                                        {(item.account.data.parsed.info.mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" &&
                                          ((item.account.data.parsed.info.tokenAmount.amount / 10 ** item.account.data.parsed.info.tokenAmount.decimals) > 0.9)) && 
                                          <>  
                                            &nbsp;-&nbsp;{
                                              Number((item.account.data.parsed.info.tokenAmount.amount / 10 ** item.account.data.parsed.info.tokenAmount.decimals).toFixed(2)).toLocaleString() + ' USDC '}
                                            </>
                                        }</>
                                      ))}

                                      &nbsp;-&nbsp;
                                      {item.vault?.nativeTreasury?.tokens?.value.reduce((count, token) => {
                                        // Check if the condition is met before counting the token
                                        if (token.account.data.parsed.info.tokenAmount.amount > 0) {
                                          count++;
                                        }
                                        return count;
                                      }, 0)} <TollIcon sx={{fontSize:'10px'}} />
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
                                        {shortenString(item.vault.pubkey,5,5)}
                                      </Typography>
                                    </Grid>

                                  </Grid>
                                  <Grid item xs sx={{textAlign:'right'}}>
                                    <Typography variant="caption">
                                    
                                      <>
                                        {/*console.log("vault: "+JSON.stringify(item))*/}
                                        {(item.vault?.nativeTreasury?.domains && item.vault.nativeTreasury.domains.length > 0 && item.vault.nativeTreasury.domains[0] !== item.vault?.nativeTreasury.vault.pubkey) &&
                                        <><LanguageIcon sx={{fontSize:'10px',mr:0.5}}/> {item.vault.nativeTreasury.domains[0]} {item.vault.nativeTreasury.domains.length > 1 && <sup>{item.vault.nativeTreasury.domains.length}</sup>}</>}
                                        
                                        <GavelIcon sx={{fontSize:'10px',ml:1}} /> 

                                        {item?.vault?.governance?.account?.config?.baseVotingTime && 
                                          <>
                                            <AccessTimeIcon sx={{fontSize:'10px'}} /> {convertSecondsToLegibleFormat(item.vault.governance.account.config.baseVotingTime, false)}
                                          </>
                                        }

                                        <Tooltip title={
                                          <>
                                            {item.vault?.nativeTreasury?.vault?.pubkey &&
                                              <>Native Wallet: 
                                              <CopyToClipboard text={item.vault.nativeTreasury.vault.pubkey} onCopy={handleCopy}>
                                                  <Button
                                                    variant="text"
                                                    color="inherit"
                                                    sx={{ 
                                                      ml:1,
                                                      fontSize:'10px',
                                                      borderRadius:'17px',
                                                      textTransform:'none',
                                                      '&:hover .MuiSvgIcon-root': {
                                                        opacity: 1,
                                                      },
                                                    }}
                                                    startIcon={
                                                      <FileCopyIcon sx={{
                                                        color:'rgba(255,255,255,0.25)',
                                                        opacity: 0,
                                                        fontSize:"14px!important"}} />
                                                    }
                                                  >
                                                
                                                  {shortenString(item.vault.nativeTreasury.vault.pubkey,8,8)}
                                                  </Button>
                                                </CopyToClipboard>
                                              </>
                                            }
                                            {item.vault.pubkey &&
                                              <><br/>Rules: 
                                                <CopyToClipboard text={item.vault.pubkey} onCopy={handleCopy}>
                                                  <Button
                                                    variant="text"
                                                    color="inherit"
                                                    sx={{ 
                                                      ml:1,
                                                      fontSize:'10px',
                                                      borderRadius:'17px',
                                                      textTransform:'none',
                                                      '&:hover .MuiSvgIcon-root': {
                                                        opacity: 1,
                                                      },
                                                    }}
                                                    startIcon={
                                                      <FileCopyIcon sx={{
                                                        color:'rgba(255,255,255,0.25)',
                                                        opacity: 0,
                                                        fontSize:"14px!important"}} />
                                                    }
                                                  >
                                                
                                                  {shortenString(item.vault.pubkey,8,8)}
                                                  </Button>
                                                </CopyToClipboard>
                                                {/*<ExplorerView address={item.vault.pubkey} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='10px' />*/}
                                              </>
                                            }
                                            {item.vault.governance?.account?.accountType && (() => {
                                              const accountType = item.vault.governance.account.accountType as string;
                                              //console.log("accountType: "+accountType);
                                              const governanceTypeLabel = GovernanceAccountType[accountType];

                                              if (governanceTypeLabel) {
                                                return (
                                                  <><br/>Governance Type: {governanceTypeLabel}</>
                                                );
                                              } else {
                                                return (
                                                  <></>
                                                );
                                              }
                                            
                                            })()}

                                            {(() => {
                                              //const stringValue = item?.vault?.governance?.account?.config?.minCommunityTokensToCreateProposal;
                                              
                                              let numericValue = null; 
                                              
                                              if (item.vault.governance.account.config.minCommunityTokensToCreateProposal !== 'ffffffffffffffff')
                                                numericValue = Number("0x"+item.vault.governance.account.config.minCommunityTokensToCreateProposal);
                                              
                                              if (numericValue && !isNaN(numericValue)) {
                                                const u64BigInt = BigInt(numericValue);
                                                const u64Number = tokenInfo ? Number(u64BigInt) / 10 ** tokenInfo.decimals : Number(u64BigInt);
                                                return (
                                                  <><br/>Proposal Minimum (Community): {u64Number.toLocaleString()}</>
                                                );
                                              } else {
                                                return (
                                                  <></>
                                                );
                                              }
                                            
                                            })()}
                                            
                                            {item?.vault?.governance?.account?.config?.minCouncilTokensToCreateProposal && 
                                              <><br/>Proposal Minimum (Council): {Number(item.vault.governance.account.config.minCouncilTokensToCreateProposal)}</>
                                            }
                                            {(item?.vault?.governance?.account?.activeProposalCount && Number(item.vault.governance.account.activeProposalCount) > 0) &&
                                              <><br/>Active Proposals: {Number(item.vault.governance.account.activeProposalCount)}</>
                                            }
                                          </>
                                        }>
                                          <IconButton
                                            color='inherit'
                                            sx={{ml:1}}
                                          >
                                            <HelpOutlineIcon sx={{fontSize:'14px'}} />
                                          </IconButton>
                                        </Tooltip>

                                        {/*
                                        {(item?.vault?.governance?.account?.config?.minCouncilTokensToCreateProposal && Number(item?.vault?.governance?.account?.config?.minCouncilTokensToCreateProposal)>0) && 
                                          ` - Council Min Prop ${Number(item.vault.governance.account.config.minCouncilTokensToCreateProposal)}`}
                                        }

                                        {(() => {
                                          //const stringValue = item?.vault?.governance?.account?.config?.minCommunityTokensToCreateProposal;
                                          
                                          const numericValue = Number("0x"+item.vault.governance.account.config.minCommunityTokensToCreateProposal);
                                          
                                          if (!isNaN(numericValue)) {
                                            const u64BigInt = BigInt(numericValue);
                                            const u64Number = Number(u64BigInt);
                                            return (
                                              <> - Community Prop Min {u64Number}</>
                                            );
                                          } else {
                                            return (
                                              <></>
                                            );
                                          }
                                        
                                        })()}
                                        
                                        {(item?.vault?.governance?.account?.proposalCount && Number(item?.vault?.governance?.account?.proposalCount)>0) && 
                                          ` - Props ${Number(item.vault.governance.account.proposalCount)}`}

                                        {(item?.vault?.governance?.account?.activeProposalCount && Number(item?.vault?.governance?.account?.activeProposalCount)>0) && 
                                          ` - Active ${Number(item.vault.governance.account.activeProposalCount)}`}
                                        */}
                                      </>
                                    
                                      
                                      {/*{item.solBalance/(10 ** 9)} sol - {item?.tokens?.value.length} tokens*/}
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

            {/*governanceRules &&
               <Grid sx={{textAlign:'right'}}>
                  <Typography variant="caption">
                      Community: {getTokenTypeString(governanceRules.account.communityTokenConfig.tokenType)} - 
                      Council: {getTokenTypeString(governanceRules.account.councilTokenConfig.tokenType)} - 
                      Account Type: {getAccountTypeString(governanceRules.account.accountType)}
                  </Typography>
              </Grid>
              
              
            */}
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

          grealm = await getRealmIndexed(governanceAddress);

          //grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
        }
        const realmPk = new PublicKey(grealm.pubkey);
        setRealm(grealm);
        setRealmName(grealm.account.name);
    }

    const getCommunityTokenInfo = async () => {
      if (cachedRealm){
        let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(cachedRealm.account.communityMint));
        setTokenInfo(tokenDetails.value.data.parsed.info);
      }
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
                                //console.log("citem "+JSON.stringify(citem))
                                if (!item.vault?.nativeTreasury)
                                  item.vault.nativeTreasury = citem;
                              }
                            }
                          }
                        }

                        //console.log("merged_treasury: "+JSON.stringify(cached_treasury))

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
        //setLoading(false);
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

    const removeTxItem = (indexToRemove:number) => {
      const updatedArray = instructionsArray.filter((item, index) => index !== indexToRemove);
      setInstructionsArray(updatedArray);
    };
    
    const getVerificationStatus = async() => {
      const verify = await isGated(governanceAddress, PROP_TOKEN);
      console.log("Governance Verified Status: "+JSON.stringify(verify));
      setVerified(verify);
      if (!verify)
        setLoading(false);
    }

    const checkMemberStatus = async() => {
      //console.log("cachedRealm: "+JSON.stringify(cachedRealm))
      //console.log("checking: "+publicKey.toBase58())
      //const canParticipate = await findObjectByGoverningTokenOwner(null, publicKey.toBase58(), true, 0, cachedRealm);
      const canParticipate = getTokenOwnerRecordsByRealmIndexed(governanceAddress, null, publicKey.toBase58());
      //console.log("canParticipate: "+JSON.stringify(canParticipate));
      //const canParticipate = false;
      if (canParticipate) 
        setIsProposer(true); 
      setLoading(false);
    }

    React.useEffect(() => {
      
      if (instructionsObject){
        // check if this instruction exists in the object
        let found = false;
        
        if (instructionsArray && instructionsArray.length > 0){
          for (let instructionItem of instructionsArray){
            if (instructionsObject === instructionItem)
              found = true;
          }
          if (!found)
            instructionsArray.push(instructionsObject);
        } else{
          instructionsArray.push(instructionsObject);
          //setInstructionsArray([instructionsObject]);
        }

        setProposalType(null);

        setInstructionsObject(null);

        //calculateProposalFee();
        
      }
      
    }, [instructionsObject]);

    React.useEffect(() => {
      if (cachedGovernance && sentRulesAddress){
        handleNativeWalletFromRules(sentRulesAddress.toBase58())
      }
    }, [cachedGovernance])

    React.useEffect(() => {
      if (cachedRealm && publicKey){
        setLoading(true);
        getCommunityTokenInfo();
        checkMemberStatus();
      }
    }, [cachedRealm, publicKey])

    React.useEffect(() => {
        if (governanceLookup)
            getCachedGovernanceFromLookup();
    }, [governanceLookup, governanceAddress]);
    
    React.useEffect(() => { 
        if (tokenMap){  
            startTimer();
            callGovernanceLookup();
            if (governanceWallets){
              // fetch all wallets (with balances) and show a dropdown list accordingly

            }
        }
    }, [tokenMap]);

    React.useEffect(() => { 
      if (verified){
          getTokens();
      }
      
    }, [verified]);


    React.useEffect(() => { 
      if (!loading){
        setLoading(true);
        if (!verified)
          getVerificationStatus();
      }
      
    }, []);

    return (
        <>
        {!publicKey ?
          <>
            <Box 
                sx={{
                  mt:{ sm: fromDialog ? 0 : 6 },
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: '17px',
                  p:4,
                  alignItems: 'center', textAlign: 'center'
              }} >
                <p>
                <Typography variant='h4'>Governance by Grape</Typography>
                </p>
                {!publicKey &&
                  <WalletDialogProvider className="grape-wallet-provider">
                    <WalletMultiButton className="grape-wallet-button">
                      Connect your wallet
                    </WalletMultiButton>
                  </WalletDialogProvider>
                }
              <p>
              <Typography variant='h5'>Connect your wallet to use the Governance Proposal Builder</Typography>
              </p>
            </Box>
          </>
        :
        
        <>
          {loading ?
          <>
          
            <Box
                sx={{
                    mt:{ sm: fromDialog ? 0 : 6 },
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    p:4,
                    alignItems: 'center', textAlign: 'center'
                }} 
              > 
                  <Typography variant="caption">Loading Governance Governance: Proposal Builder</Typography>
                  
                  <LinearProgress color="inherit" />
                  
            </Box>
          </>
          :
          <>
              <Box
                  sx={{
                      mt:{ sm: fromDialog ? 0 : 6 },
                      background: 'rgba(0, 0, 0, 0.6)',
                      borderRadius: '17px',
                      overflow: 'hidden',
                      p:{ sm: fromDialog ? 1 : 4 }
                  }} 
                > 

              {(!verified) ?
                <Grid container alignContent="center"  sx={{alignItems: 'center', textAlign: 'center'}}>
                    <Grid item xs={12}>
                      <Typography variant='h5'>Your governance needs to hold the GOVERN access token to access the proposal builder</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant='body1'>Reach out to the Grape DAO on 
                        <Button 
                            target='_blank' href={`https://discord.gg/grapedao`}
                            color='inherit'
                            sx={{
                            verticalAlign: 'middle',
                            display: 'inline-flex',
                            borderRadius:'17px',
                            m:1,
                            textTransform:'none'
                        }}>
                            <DiscordIcon sx={{mt:1,fontSize:27.5,color:'white'}} /> <strong>Discord</strong>
                        </Button> to get started</Typography>
                    </Grid>
                    
                    <Grid item xs={12} sx={{textAlign:'right'}}>
                      <Typography variant="caption">Ref# {realmName ? realmName : governanceAddress}</Typography>
                    </Grid> 
                  
                </Grid>
              :
                <>
                {(!loading && !isProposer) ?
                    <Grid container alignContent="center" sx={{alignItems: 'center', textAlign: 'center'}}>
                        <Grid item xs={12}>
                          <Typography variant='h5'>You do not have enough voting power to participate in this Governance</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant='body1'>
                              <Button 
                                  component={Link}
                                  to={'/dao/'+governanceAddress}
                                  color='inherit'
                                  variant='outlined'
                                  sx={{
                                  verticalAlign: 'middle',
                                  display: 'inline-flex',
                                  borderRadius:'17px',
                                  m:1,
                                  textTransform:'none'
                              }}>
                                  <ArrowBackIcon fontSize='inherit' sx={{mr:1}} /> Back to {realmName ? realmName : governanceAddress} Governance
                              </Button></Typography>
                        </Grid>
                        <Grid item xs={12} sx={{textAlign:'right'}}>
                          <Typography variant="caption">Ref# {publicKey ? publicKey.toBase58() : `Invalid Wallet`}</Typography>
                        </Grid> 
                    </Grid>
                :
                  <>
                    
                    <>

                        {showGovernanceTitle && realmName && 
                            <Grid container>
                                <Grid item xs={12} sm={6} container justifyContent="flex-start">
                                    <Grid container>
                                        <Grid item xs={12}>
                                            <Typography variant="h4">
                                              {realmName}
                                            </Typography>
                                        </Grid>
                                        
                                        
                                        <Grid item xs={12}>
                                          <ButtonGroup    
                                              variant="outlined" 
                                              color='inherit'
                                          >
                                            {!intraDAO &&
                                            <Tooltip title={`Back to ${governanceAddress} Governance`}>
                                              <Button
                                                    sx={{
                                                      borderRadius:'17px',
                                                      borderColor:'rgba(255,255,255,0.05)',
                                                      fontSize:'10px'}}
                                                    component={Link}
                                                    to={'/dao/'+governanceAddress}
                                                >
                                                    <ArrowBackIcon fontSize='inherit' sx={{mr:1}} /> Back
                                                </Button>
                                              </Tooltip>
                                            }
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
                            <Grid container>
                              <Grid item xs={12}>
                                <Typography variant="h6">
                                  {!editProposalAddress &&
                                    <>
                                      Create Proposal
                                    </>
                                  }
                                  </Typography>
                                </Grid>
                            </Grid>
                          
                          {!editProposalAddress ?
                          <>
                            <FormControl fullWidth  sx={{mb:2}}>
                                <TextField 
                                    fullWidth 
                                    label="Title" 
                                    id="fullWidth"
                                    //value={title}
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
                                    //value={description}
                                    onChange={(e) => {
                                        if (!description || description.length < maxDescriptionLen)
                                            handleDescriptionChange(e.target.value)
                                        }}
                                    
                                    sx={{maxlength:maxDescriptionLen}}
                                    />
                                <Grid sx={{textAlign:'right',}}>

                                  {isGistDescription ?
                                    <>
                                      <GovernanceGistDialog gist={description} />
                                      <Button
                                          color='inherit'
                                          size='small'
                                          target='_blank'
                                          href={description}
                                          sx={{borderRadius:'17px'}}
                                      >
                                          <GitHubIcon sx={{mr:1}} /> GIST
                                      </Button>
                                    </>
                                  :
                                    <Typography variant="caption">{description ? description.length > 0 ? maxDescriptionLen - description.length : maxDescriptionLen : maxDescriptionLen} characters remaining</Typography>
                                  }
                                </Grid>
                                
                            </FormControl>
                            
                            <FormControl fullWidth  sx={{mb:2}}>
                                <GovernanceSelect />
                            </FormControl>
                          </>
                          :<></>}
                          
                          {governanceWallet && 
                          <>
                            <FormControl fullWidth sx={{mb:2}}>
                                <ProposalSelect />
                            </FormControl>

                            {proposalType === 4 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <TokenTransferView governanceAddress={governanceAddress} governanceLookup={governanceLookup} payerWallet={publicKey} pluginType={4} governanceWallet={governanceWallet} governanceRulesWallet={governanceRulesWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }
                            {proposalType === 5 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <TokenTransferView governanceAddress={governanceAddress} governanceLookup={governanceLookup} payerWallet={publicKey} pluginType={5} governanceWallet={governanceWallet} governanceRulesWallet={governanceRulesWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }

                            {proposalType === 104 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <TokenTransferV0View governanceAddress={governanceAddress} governanceLookup={governanceLookup} payerWallet={publicKey} pluginType={4} governanceWallet={governanceWallet} governanceRulesWallet={governanceRulesWallet} governanceWalletMinInstructHoldUpTime={governanceWalletMinInstructHoldUpTime} setInstructionsObject={setInstructionsObject} setInstructionsDataWithHoldUpTime={setInstructionsDataWithHoldUpTime}/>
                              </FormControl>
                            }
                            {proposalType === 105 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <TokenTransferV0View governanceAddress={governanceAddress} governanceLookup={governanceLookup} payerWallet={publicKey} pluginType={5} governanceWallet={governanceWallet} governanceRulesWallet={governanceRulesWallet} governanceWalletMinInstructHoldUpTime={governanceWalletMinInstructHoldUpTime} setInstructionsObject={setInstructionsObject} setInstructionsDataWithHoldUpTime={setInstructionsDataWithHoldUpTime}/>
                              </FormControl>
                            }
                            
                            {proposalType === 8 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <JupiterDCAView payerWallet={publicKey} pluginType={8} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }
                            {proposalType === 9 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <JupiterSwapView governanceAddress={governanceAddress} governanceLookup={governanceLookup} payerWallet={publicKey} pluginType={9} governanceWallet={governanceWallet} governanceRulesWallet={governanceRulesWallet} governanceWalletMinInstructHoldUpTime={governanceWalletMinInstructHoldUpTime} setInstructionsObject={setInstructionsObject} setInstructionsDataWithHoldUpTime={setInstructionsDataWithHoldUpTime}/>
                              </FormControl>
                            }
                            {/*proposalType === 9 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <JupiterSwapView payerWallet={publicKey} pluginType={9} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                          */}

                            {/*proposalType === 9 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <PhoenixSwapView payerWallet={publicKey} pluginType={9} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            */}

                            {/*proposalType === 50 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <StreamflowPaymentsView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            */}



                            {proposalType === 10 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <CloseTokenView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }

                            {proposalType === 11 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <SNSView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }

                            {proposalType === 40 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <ListOnMEView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }
                            {proposalType === 41 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <BuyOnMEView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }


                            {proposalType === 16 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <ListOnTensorView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }

                            {proposalType === 20 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <LookupTableView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }

                            {proposalType === 30 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <IntraDAOJoinView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} governanceLookup={governanceLookup} />
                              </FormControl>
                            }

                            {proposalType === 31 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <IntraDAOVoteView payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} governanceLookup={governanceLookup} />
                              </FormControl>
                            }

                            {proposalType === 32 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <IntraDAOGrantView governanceAddress={governanceAddress} governanceRulesWallet={governanceRulesWallet} payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} governanceLookup={governanceLookup} />
                              </FormControl>
                            }
                            {proposalType === 132 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <IntraDAOGrantV0View governanceAddress={governanceAddress} governanceRulesWallet={governanceRulesWallet} payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} governanceLookup={governanceLookup} />
                              </FormControl>
                            }
                            
                            {proposalType === 33 &&
                              <FormControl fullWidth sx={{mb:2}}>
                                <IntraDAOProposalView governanceAddress={governanceAddress} governanceRulesWallet={governanceRulesWallet} payerWallet={publicKey} governanceWallet={governanceWallet} setInstructionsObject={setInstructionsObject} />
                              </FormControl>
                            }

                          {(instructionsArray && instructionsArray.length > 0) &&
                              <Box
                                  sx={{
                                    m:2,
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '17px',
                                    overflow: 'hidden',
                                    p:4
                                }} 
                              >
                                <FormControl fullWidth sx={{mb:2}}>
                                    <List dense={true}>
                                        {instructionsArray.map((txinstr:any, index:number) => (
                                            <ListItem
                                              key={index}
                                              secondaryAction={
                                                <>
                                                  <IconButton 
                                                    onClick={e => removeTxItem(index)}
                                                    edge="end" 
                                                    aria-label="delete">
                                                    <DeleteIcon color="error" />
                                                  </IconButton>
                                                </>
                                              }
                                            >
                                              <ListItemAvatar>
                                                <Avatar>
                                                  {index+1}
                                                </Avatar>
                                              </ListItemAvatar>
                                              <ListItemText
                                                primary={`
                                                  ${txinstr?.type} - ${txinstr?.description}
                                                `}
                                                secondary={
                                                  <>
                                                  <CustomTextarea
                                                      minRows={6}
                                                      value={JSON.stringify(txinstr?.governanceInstructions)}
                                                      readOnly
                                                  />
                                                  {/*{JSON.stringify(txinstr?.governanceInstructions)}*/}


                                                  {(txinstr?.transactionEstimatedFee && txinstr?.transactionEstimatedFee > 0) &&
                                                      <Grid sx={{textAlign:'right'}}>
                                                          <Typography variant="caption">
                                                              Estimated Fee {(txinstr.transactionEstimatedFee).toFixed(6)}
                                                          </Typography>
                                                      </Grid>
                                                  }
                                                  </>
                                                }
                                              />
                                            </ListItem>
                                        ))}
                                      </List>
                                </FormControl>
                              </Box>
                          }


                            {proposalSimulationUnitsConsumed ?
                                <>
                                {(proposalSimulationUnitsConsumed > 0) ?
                                    <Grid sx={{textAlign:'right'}}>
                                        <Typography variant="caption">
                                            Estimated Fee {(proposalSimulationUnitsConsumed/10 ** 9)*50}
                                        </Typography>
                                    </Grid>
                                :
                                <>
                                    
                                </>
                                }
                                </>
                              :<>
                                {proposalSimulationLogs &&
                                  <Grid sx={{textAlign:'right'}}>
                                    <Typography variant="caption" sx={{color:"red"}}>
                                      ERROR: {JSON.stringify(proposalSimulationLogs)}
                                    </Typography>
                                  </Grid>
                                }
                              </>
                            }
                            
                            
                          </>
                          }

                          {!editProposalAddress ?
                            <>
                            {/*
                            <FormControl fullWidth >
                                <FormControlLabel  disabled={true} required control={<Switch />} label="Multiple Choice Vote" />
                            </FormControl>
                            */}
                            
                            <FormControl fullWidth >
                                <FormControlLabel 
                                  control={
                                    <Switch 
                                      checked={isCouncilVote} //communitySupport ? false : true}
                                      onChange={
                                        (e) => {
                                          setIsCouncilVote(e.target.checked)
                                        }
                                      }
                                      disabled={!communitySupport}
                                    />
                                  } 
                                  label="Council Vote" />
                            </FormControl>
                            </>
                          :<></>}
                          
                          {!intraDAO ?
                            <Grid sx={{textAlign:'right'}}>
                              <ButtonGroup variant="contained" aria-label="outlined button group"
                                sx={{borderRadius:'17px'}}
                              >
                                {/*
                                <Tooltip title="Simulate & Calculate Fees">
                                <Button 
                                  disabled={!(
                                    (title && title.length > 0) &&
                                    (description && description.length > 0) &&
                                    (proposalType ||(instructionsArray && instructionsArray.length > 0)) &&
                                    (!createDisabled)
                                    )
                                  }
                                  onClick={simulateProposal}
                                  variant="contained"
                                  color="info"
                                  sx={{borderTopLeftRadius:'17px', borderBottomLeftRadius:'17px'}}>
                                    <FlakyIcon /></Button>
                                </Tooltip>
                                */}
                                <Button 
                                  disabled={!(
                                    (title && title.length > 0) &&
                                    (description && description.length > 0) &&
                                    (proposalType ||(instructionsArray && instructionsArray.length > 0)) &&
                                    (!createDisabled)
                                    )
                                  }
                                  onClick={(e) => createProposal(true)}
                                  variant="contained"
                                  color="info"
                                  sx={{borderTopLeftRadius:'17px', borderBottomLeftRadius:'17px'}}>
                                    <Confetti
                                        active={ proposalMade }
                                        config={ confettiConfig }
                                    />        
                                    Save Draft</Button>
                                <Button 
                                  disabled={!(
                                    (title && title.length > 0) &&
                                    (description && description.length > 0) &&
                                    (proposalType ||(instructionsArray && instructionsArray.length > 0)) &&
                                    (!createDisabled)
                                    )
                                  }
                                  onClick={(e) => createProposal(false)}
                                  variant="contained"
                                  color="success"
                                  sx={{borderTopRightRadius:'17px', borderBottomRightRadius:'17px'}}>
                                    <Confetti
                                        active={ proposalMade }
                                        config={ confettiConfig }
                                    />     
                                    Create Proposal</Button>
                                </ButtonGroup>
                            </Grid>
                            :
                            <>
                              {editProposalAddress ?
                                <Button 
                                  disabled={!(
                                    (instructionsArray && instructionsArray.length > 0)
                                    )
                                  }
                                  fullWidth
                                  onClick={(e) => createProposal(true, false)}
                                  variant="contained"
                                  color="success"
                                  sx={{borderRadius:'17px'}}>
                                    <Confetti
                                        active={ proposalMade }
                                        config={ confettiConfig }
                                    />        
                                    Add to Draft</Button>
                              
                              :
                                <Button 
                                    disabled={!(
                                      (title && title.length > 0) &&
                                      (description && description.length > 0) &&
                                      (proposalType ||(instructionsArray && instructionsArray.length > 0)) &&
                                      (!createDisabled)
                                      )
                                    }
                                    fullWidth
                                    onClick={(e) => createProposal(false, true)}
                                    variant="contained"
                                    color="success"
                                    sx={{borderRadius:'17px'}}>
                                      <Confetti
                                          active={ proposalMade }
                                          config={ confettiConfig }
                                      />        
                                      Add Proposal Creation To Parent Proposal</Button>
                                }
                            </>
                          }
                          
                      </Box>

                  </Grid>
                  </>
                }
                </>
                }
              </Box>

          </>
        }
      </>
      }
      </>
    );

}