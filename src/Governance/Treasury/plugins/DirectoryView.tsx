import { PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, web3 } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';
import axios from "axios";

import { 
    RPC_CONNECTION,
    SHYFT_KEY,
    RPC_ENDPOINT
} from '../../../utils/grapeTools/constants';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';

import {
    Avatar,
    Chip,
    Typography,
    Button,
    Grid,
    Box,
    Table,
    Tooltip,
    LinearProgress,
    DialogTitle,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogActions,
    MenuItem,
    ListItemIcon,
    TextField,
    FormControl,
    Select,
    InputLabel
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import GetAppIcon from '@mui/icons-material/GetApp';
import VerifiedIcon from '@mui/icons-material/Verified';
import ExtensionIcon from '@mui/icons-material/Extension';
import UpdateIcon from '@mui/icons-material/Update';
import PublishIcon from '@mui/icons-material/Publish';
import SettingsIcon from '@mui/icons-material/Settings';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

import AdvancedProposalView from './AdvancedProposalView';

import {createUmi} from "@metaplex-foundation/umi-bundle-defaults";

import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";

import {
    getRealms, 
    RequestStatus, 
    GovernanceEntryAccountData, 
    DAOType, 
    setEntryUri, 
    GovBoardingConfigAccountData, 
    getGovBoardingConfigAccountDataSerializer,
    createEntry,
    setEntryStatus,
    createConfig
} from "gspl-directory";

import {publicKey as UmiPK, createNoopSigner, Context, generateSigner, KeypairSigner, Pda, isSome, MaybeRpcAccount} from "@metaplex-foundation/umi";
import {toWeb3JsPublicKey, toWeb3JsInstruction, fromWeb3JsPublicKey} from "@metaplex-foundation/umi-web3js-adapters";
import { TransactionInstruction } from '@solana/web3.js';
import bs58 from "bs58";
import { createInstructionData } from "@solana/spl-governance";
import { tryParsePublicKey } from '../../../utils/governanceTools/core/pubkey';

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
}
  
const BootstrapDialogTitle = (props: DialogTitleProps) => {
    const { children, onClose, ...other } = props;
    
    return (
      <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

function statusToDescription(value: RequestStatus): string {
    switch (value) {
      case RequestStatus.Pending:
        return "Pending";
      case RequestStatus.Approved:
        return "Approved";
      case RequestStatus.Rejected:
        return "Rejected";
      case RequestStatus.Disabled:
        return "Disabled";
      default:
        return "Unknown";
    }
  }

function daoTypeToDescription(value: DAOType): string {
    switch (value) {
      case DAOType.Social:
        return "Social";
      case DAOType.Finance:
        return "Finance";
      default:
        return "Unknown";
    }
}

function descriptionToDaoType(value: string): DAOType {
    switch (value) {
      case "Social":
        return DAOType.Social;
      case "Finance":
        return DAOType.Finance;
      default:
        return DAOType.Social;
    }
}

const confirmTx = async (sig: Uint8Array, umi: Context) => {
    const blockhashInfo = await umi.rpc.getLatestBlockhash();
    await umi.rpc.confirmTransaction(sig, { strategy: {
        type: "blockhash",
        ...blockhashInfo
    }}  );
}


export default function DirectoryExtensionView(props: any){
    const setReload = props?.setReload;
    const governanceLookup = props?.governanceLookup;
    const governanceRulesWallet = props?.governanceRulesWallet;
    const governingTokenMint = props?.governingTokenMint;
    const [editProposalAddress, setEditProposalAddress] = React.useState(props?.editProposalAddress);
    const title = props?.title || "Proposal";
    const realm = props?.realm;
    const governanceAddress = props?.governanceAddress || realm.pubkey.toBase58();
    const realmName = props?.realmName;
    const rulesWallet = props?.rulesWallet;
    
    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const instructions = props?.instructions;
    const setInstructions = props?.setInstructions;
    
    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey } = useWallet();
    const wallet = useWallet();
    const [loading, setLoading] = React.useState(false);
    const [open, setPropOpen] = React.useState(false);

    const [initialGsplUri, setInitialGsplUri] = React.useState('');
    const [initialGsplName, setInitialGsplName] = React.useState('');
    const [initialGsplDaoType, setInitialGsplDaoType] = React.useState('');
    const [initialGsplRank, setInitialGsplRank] = React.useState(null);

    const [gsplName, setGsplName] = React.useState('');
    const [gsplStatus, setGsplStatus] = React.useState('');
    const [gsplDaoType, setGsplDaoType] = React.useState('');
    const [gsplRank, setGsplRank] = React.useState(null);
    const [gsplUri, setGsplUri] = React.useState('');
    const [gsplUriError, setGsplUriError] = React.useState('');
    const [gsplGovProgram , setGsplGovProgram] = React.useState('');
    const [listingExists, setListingExists] = React.useState(false); // Track if listing exists

    const [openAdvanced, setOpenAdvanced] = React.useState(false);
    const [proposalTitle, setProposalTitle] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [governingMint, setGoverningMint] = React.useState(null);
    const [isDraft, setIsDraft] = React.useState(false);
    //const [actionType, setActionType] = React.useState(0);
 
    /*const toggleGoverningMintSelected = (council: boolean) => {
        if (council){
            setIsGoverningMintCouncilSelected(true);
            setGoverningMint(realm?.account.config.councilMint);
        } else{
            setIsGoverningMintCouncilSelected(false);
            setGoverningMint(realm?.communityMint);
        }
    }*/

    // Function to get color based on the gsplStatus value
    const getTextColor = () => {
        if (gsplStatus === 'Pending') {
            return 'orange'; // Example for Pending status
        } else if (gsplStatus === 'Approved') {
            return 'green';  // Example for Approved status
        } else if (gsplStatus === 'Rejected') {
            return 'red';    // Example for Rejected status
        } else if (gsplStatus === 'Disabled') {
            return 'pink';    // Example for Rejected status
        }
        return 'purple';      // Default color
    };

    const [expanded, setExpanded] = React.useState<string | false>(false);
    
    const provider = new AnchorProvider(RPC_CONNECTION, wallet, {
        commitment: 'confirmed',
    });
    
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const handleGsplUriChange = (e) => {
        const value = e.target.value;
        setGsplUri(value);

        // Validate URL
        try {
            const url = new URL(value);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                if (url.pathname.endsWith('.json')) {
                    setGsplUriError('');
                } else {
                    setGsplUriError('URL must point to a JSON file');
                }
            } else {
                setGsplUriError('URL must start with http or https');
            }
        } catch (err) {
            setGsplUriError('Invalid URL');
        }
    };

    React.useEffect(() => {
        if (gsplStatus === 'Unlisted') {
            setOpenAdvanced(false);
        }
    }, [gsplStatus]);

    const handleAdvancedToggle = () => {
        if (gsplStatus !== 'Unlisted') {
            setOpenAdvanced(!openAdvanced);
        }
    }

    const handleCloseDialog = () => {
        setPropOpen(false);
        handleCloseExtMenu(); 
    }

    const handleClickOpen = () => {
        setPropOpen(true);
        callGovernanceLookup();
    };

    const handleClose = () => {
        setPropOpen(false);
        handleCloseExtMenu();
    };

    const handlePublishProposal = () => {
        console.log("Publish button clicked");
        if (gsplName === '' || gsplUri === '' || gsplDaoType === ''|| gsplRank === null || gsplStatus === ''){
            enqueueSnackbar("Please fill in all the fields", { variant: 'error' });
            return;
        }
        handleProposalIx();
    }

    const handleUpdateProposal = () => {
        console.log("Update button clicked");
        if (gsplName === '' || gsplUri === '' || gsplDaoType === ''|| gsplRank === null || gsplStatus === ''){
            enqueueSnackbar("Please fill in all the fields", { variant: 'error' });
            return;
        }
        handleProposalIx();
    }

    const handleProposalIx = async() => {
        if (handleCloseExtMenu)
            handleCloseExtMenu();
        setPropOpen(false);
        //let typeOfAction = 0;
        const transaction = new Transaction();
        const pTransaction = new Transaction();
        let gsplconfig: GovBoardingConfigAccountData = {} as GovBoardingConfigAccountData;
        // Extract realm and pubkey from rulesWallet
        const { pubkey, account: { realm } } = rulesWallet;
        //check if instructions will be associated with an update or new listing
        if(listingExists){  //update
            //listing exists so get gspl admin, verifier and verifierOverride
            gsplconfig = await initGrapeGovernanceConfig();
            //check if we can use on of the initial gspl programms functions to update or we have to cancel initial proposal and recreate
            if(gsplName.match(initialGsplName)&&gsplDaoType.match(initialGsplDaoType)&&gsplRank ==initialGsplRank && gsplStatus!="Pending" && gsplStatus!="Unlisted"){
                if(!gsplUri.match(initialGsplUri)){
                    console.log("detected URI has changes");
                    enqueueSnackbar("Detected URI has changed", { variant: 'info' });
                    typeOfAction = 1;
                    const umi = createUmi(RPC_ENDPOINT)
                        .use(walletAdapterIdentity(wallet));
                    const governanceEntry = umi.eddsa.findPda(GOV_BOARDING,
                        [
                            Uint8Array.from(Buffer.from("entry")), 
                            Uint8Array.from(Buffer.from(initialGsplName)), 
                            Uint8Array.from(bs58.decode(CONFIG)), 
                            Uint8Array.from(bs58.decode(gsplGovProgram))
                        ]); 
                    const setEntryStatusBuilder = setEntryUri(umi, {
                        uri: gsplUri,
                        governanceEntry: governanceEntry[0],
                        config: CONFIG,
                        verifier: createNoopSigner(gsplconfig.verifierOverride && isSome(gsplconfig.verifierOverride) ? gsplconfig.verifierOverride.value : gsplconfig.admin),
                        governance: fromWeb3JsPublicKey(rulesWallet.pubkey),
                        governanceProgram: UmiPK(gsplGovProgram),
                    });
                    const ixs = setEntryStatusBuilder.getInstructions();
                    console.log("instructions: "+JSON.stringify(ixs));
                    const web3Instructions = ixs.map(instruction => toWeb3JsInstruction(instruction));
                    const aixs = pTransaction;
                    
                    if(web3Instructions){
                        const propIx = {
                            title:proposalTitle,
                            description:proposalDescription,
                            //ix:instructionData,
                            ix:web3Instructions,
                            aix:aixs?.instructions,
                            nativeWallet:governanceNativeWallet,
                            governingMint:governingMint,
                            draft:isDraft,
                        }
                        console.log("propIx: "+JSON.stringify(propIx))
                        setInstructions(propIx);
                        setExpandedLoader(true);
                    }
                }else{
                    typeOfAction = 0;
                    console.log("no changes detected to create instructions");
                    enqueueSnackbar("No changes detected, nothing to update.", { variant: 'info' });
                }
            }else if (gsplName.match(initialGsplName)&&gsplDaoType.match(initialGsplDaoType)&&gsplRank ==initialGsplRank && gsplStatus=="Pending"){
                //proposal creatinon to request listing approval
                console.log("Verifier Realm:"+JSON.stringify(gsplconfig.verifierRealm));
                try{
                    const umi = createUmi(RPC_ENDPOINT).use(walletAdapterIdentity(wallet));
                    //const umi = createUmi(RPC_ENDPOINT);
                    //attempt to build a configBuilder
                    const configUmi = generateSigner(umi);
                    console.log("This config is", configUmi.publicKey);
                    let createConfigBuilder = createConfig(umi, {
                        admin: umi.identity,
                        //config: createNoopSigner(CONFIG),
                        config: configUmi,
                        verifierRealm: fromWeb3JsPublicKey(new PublicKey(governanceAddress)),
                        //verifierRealm: gsplconfig.verifierRealm,
                        verifier: umi.identity
                        //verifier: createNoopSigner(gsplconfig.verifierRealm),
                    });
                    //The latest blockhash is set for the request listing builder to ensure the transaction is processed in the current block.
                    createConfigBuilder = await createConfigBuilder.setLatestBlockhash(umi);
                    console.log("createConfigBuilder: "+JSON.stringify(createConfigBuilder));
                    //console.log("createConfigBuilder.verifierRealm: "+JSON.stringify(createConfigBuilder.items.keys[0].
                    const governanceEntry = umi.eddsa.findPda(GOV_BOARDING,
                        [   
                            Uint8Array.from(Buffer.from("entry")), 
                            Uint8Array.from(Buffer.from(initialGsplName)), 
                            Uint8Array.from(bs58.decode(CONFIG)), 
                            Uint8Array.from(bs58.decode(gsplGovProgram))
                        ]); 
                    const nativeTreasury = umi.eddsa.findPda(UmiPK(gsplGovProgram),
                        [Buffer.from("native-treasury"),
                            rulesWallet.pubkey.toBuffer()])[0];
                    
                    console.log('rulesWallet value: ' +JSON.stringify(rulesWallet));
                    let approveListingBuilder =  createConfigBuilder.add(setEntryStatus(umi, {
                    //let approveListingBuilder =  setEntryStatus(umi, {
                        status: RequestStatus.Approved,
                        governanceEntry: governanceEntry[0],
                        config: CONFIG,
                        //********using the verifier below gets you to the wallet and then program crashes with simulation error************/
                        //********Simulation result: {"InstructionError":[0,{"Custom":1101}]} createProposalInstructionsLegacy.tsx:347************/
                        verifier: createNoopSigner(gsplconfig.verifierOverride && isSome(gsplconfig.verifierOverride) ? gsplconfig.verifierOverride.value : gsplconfig.admin),
                        //********approves a request with dao governance**********/
                        //verifier: createNoopSigner(fromWeb3JsPublicKey(rulesWallet.pubkey)),
                        //verifier: createNoopSigner(fromWeb3JsPublicKey(new PublicKey(rulesWallet.pubkey))),
                        //*********approves a request with doa native treasury**********/
                        //verifier: createNoopSigner(nativeTreasury),
                        //*********alternative verifier tests*********/
                        //verifier: createNoopSigner(umi.identity.publicKey),
                        //verifier:umi.identity,
                        //*********governance tests***********/
                        //governance: fromWeb3JsPublicKey(rulesWallet.pubkey),
                        //governance: rulesWallet,
                        governance: fromWeb3JsPublicKey(new PublicKey(rulesWallet.pubkey)),
                        governanceProgram: fromWeb3JsPublicKey(new PublicKey(gsplGovProgram)),
                    })
                )
                    /*console.log('governance address: ', governanceAddress);
                    console.log('governaceUmiPk address: ', UmiPK(governanceAddress));
                    console.log('gpslconfig.admin: '+JSON.stringify(gsplconfig.admin));
                    console.log('gpslconfig.verifierOverride: '+JSON.stringify(gsplconfig.verifierOverride));
                    console.log("governanceEntry: "+JSON.stringify(governanceEntry[0]));
                    console.log('nativeTreasury: '+JSON.stringify(nativeTreasury));
                    console.log('CONFIG: '+JSON.stringify(CONFIG));
                    
                    console.log('governance: '+JSON.stringify(fromWeb3JsPublicKey(rulesWallet.pubkey)));
                    console.log('governanceProgram: '+JSON.stringify(UmiPK(gsplGovProgram)));*/
                    //need to see below what instructions we are sending to goverance for the proposal afterwards
                    const ixs = approveListingBuilder.getInstructions();
                    //console.log("instructions: "+JSON.stringify(ixs));
                    const web3Instructions = ixs.map(instruction => toWeb3JsInstruction(instruction));
                    const aixs = pTransaction;
                    if(web3Instructions){
                        const propIx = {
                            title:proposalTitle,
                            description:proposalDescription,
                            ix:web3Instructions,
                            aix:aixs?.instructions,
                            nativeWallet:governanceNativeWallet,
                            governingMint:governingMint,
                            draft:isDraft,
                        }
                        //console.log("propIx: "+JSON.stringify(propIx))
                        setInstructions(propIx);
                        setExpandedLoader(true);
                    }
                        //code for signing from wallet directly avoid above instructions to embed in the proposal
                        /*approveListingBuilder = await approveListingBuilder.setLatestBlockhash(umi);
                        const approveListingTx = await approveListingBuilder.buildAndSign(umi);

                        console.log("requestListingTx: "+JSON.stringify(approveListingTx));
                        const sig = await umi.rpc.sendTransaction(approveListingTx, {commitment: "finalized"});
                        if (!sig) {
                            throw new Error('Transaction signature is null');
                        }                
                        await confirmTx(sig, umi);
                        console.log(sig);
                        enqueueSnackbar('Transaction successful!', { variant: 'success' });*/
                        //end of code to sign off from wallet
                } catch (error) {
                    console.error('Transaction failed:', error);
                    enqueueSnackbar('Transaction failed!', { variant: 'error' });
                }
            }else{
                //setActionType(2);
                console.log("something other than the URI has changed");
                enqueueSnackbar("Detected something other than the URI has changed", { variant: 'info' });
                typeOfAction = 2;

            }
        } else if (gsplStatus=="Unlisted") { //new listing  
            //setActionType(3);  
            console.log("New listing proposal");
            enqueueSnackbar("New Listing Proposal", { variant: 'info' });
            typeOfAction = 3;      
            try {
                const umi = createUmi(RPC_ENDPOINT)
                            .use(walletAdapterIdentity(wallet));
                const governanceEntry = umi.eddsa.findPda(GOV_BOARDING,
                    [
                        Uint8Array.from(Buffer.from("entry")), 
                        Uint8Array.from(Buffer.from(gsplName)), 
                        Uint8Array.from(bs58.decode(CONFIG)), 
                        Uint8Array.from(bs58.decode(rulesWallet.owner))
                    ]); 
                let requestListingBuilder = createEntry(umi,
                    {
                        name: gsplName,
                        metadataUri: gsplUri,
                        govAccountType: descriptionToDaoType(gsplDaoType),
                        parents: [],
                        governanceEntry: governanceEntry,
                        config: CONFIG,
                        governanceProgram: UmiPK(rulesWallet.owner)
                    })/*.prepend(setComputeUnitPrice(umi, {microLamports: 75000})).prepend(setComputeUnitLimit(umi, {units: 20000}))
                    .setLatestBlockhash(umi)*/;
                //need to execute the requestListingBuilder to create the governanceEntry that will be user for the listing proposal
                //in this case we need two transactions one to create the governanceEntry and the other to create the listing proposal
                requestListingBuilder = await requestListingBuilder.setLatestBlockhash(umi);
                const requestListingTx = await requestListingBuilder.buildAndSign(umi);
                const sig = await umi.rpc.sendTransaction(requestListingTx, {commitment: "finalized"});
                await confirmTx(sig, umi);
                enqueueSnackbar('Transaction successful!', { variant: 'success' });
            } catch (error) {
                console.error('Transaction failed:', error);
                enqueueSnackbar('Transaction failed!', { variant: 'error' });
            }
            //proposal creation logic to request listing in gspl but doesn't work since we don't know the governanceEntry just yet
            /*let governanceEntryAccount: MaybeRpcAccount = {exists: false, publicKey: governanceEntry[0]};
            while (!governanceEntryAccount.exists) {
                governanceEntryAccount = await umi.rpc.getAccount(governanceEntry[0]);
            }
            //need to see below what instructinos we are sending to goverance for the proposal afterwards
            const ixs = requestListingBuilder.getInstructions();
            console.log("instructions: "+JSON.stringify(ixs));
            console.log("governanceEntry: "+JSON.stringify(governanceEntry));
            console.log("governanceProgram: "+JSON.stringify(rulesWallet.owner));
            console.log("config: "+JSON.stringify(CONFIG));
            console.log("gsplUri: "+JSON.stringify(gsplUri));
            console.log("gsplName: "+JSON.stringify(gsplName));
            console.log("gsplDaoType: "+JSON.stringify(descriptionToDaoType(gsplDaoType)));
            const web3Instructions = ixs.map(instruction => toWeb3JsInstruction(instruction));
            const aixs = pTransaction;
            if(web3Instructions){
                const propIx = {
                    title:proposalTitle,
                    description:proposalDescription,
                    ix:web3Instructions,
                    aix:aixs?.instructions,
                    nativeWallet:governanceNativeWallet,
                    governingMint:governingMint,
                    draft:isDraft,
                }
                console.log("propIx: "+JSON.stringify(propIx))
                setInstructions(propIx);
                setExpandedLoader(true);
            }*/
        }else{
            typeOfAction = 0;
            console.log("no changes detected to create instructions");
            enqueueSnackbar("No changes detected, nothing to update or list.", { variant: 'info' });
        }
    }

    const GOV_BOARDING = UmiPK("GovyJPza6EV6srUcmwA1vS3EmWGdLSkkDafRE54X1Dir");
    const CONFIG = UmiPK("GrVTaSRsanVMK7dP4YZnxTV6oWLcsFDV1w6MHGvWnWCS");
    let exists = false;
    let typeOfAction = 0;
    //RPC call to get from Directory all the listings with various combinations of requestStatus
    const initGrapeGovernanceDirectory = async(): Promise<GovernanceEntryAccountData[]> => {
        try{
            const umi = createUmi(RPC_ENDPOINT);
            const requestStatuses = [RequestStatus.Approved, RequestStatus.Pending, RequestStatus.Rejected, RequestStatus.Disabled];
            const allEntries: GovernanceEntryAccountData[] = [];
            for (const status of requestStatuses) {
                const entries = await getRealms(umi, CONFIG, status);
                allEntries.push(...entries); // Push each result into the final array
            }
            //console.log("Entries: "+JSON.stringify(allEntries));
            return allEntries;
        } catch(e){
            console.log("Could not load GSPL directory");
            return [];
        }
    }

    //returns the gspl configuration verifier, admin and verifierOverride
    const initGrapeGovernanceConfig = async(): Promise<GovBoardingConfigAccountData> => {
        try{
            const umi = createUmi(RPC_ENDPOINT);
            const configDataGotten = await umi.rpc.getAccount(CONFIG);
           if (configDataGotten.exists) {   
            const govConfigDeserializer = getGovBoardingConfigAccountDataSerializer();
            const governanceConfigData = govConfigDeserializer.deserialize(configDataGotten.data)[0];
            console.log("config data using umi"+JSON.stringify(governanceConfigData));
            return governanceConfigData;
           }
           else{
                throw new Error("Failed to fetch GovBoardingConfig data");
            }
        } catch(e){
            console.log("Error fetching GovBoardingConfig data'");
            return null;
        }
    }

    //get DAO's GSPL entry
    const callGovernanceLookup = async() => {
        setGsplName('');
        setGsplStatus('');
        setGsplDaoType('');
        setListingExists(false);
        //let exists = false;
        const gspldir = await initGrapeGovernanceDirectory();
        if (realm.account?.name){
            for (var diritem of gspldir){
                if (realm.account?.name === diritem.name){
                    const gsplEntry = diritem;
                    const fetchedGsplUri = gsplEntry.metadataUri || '';
                    const fetchedGsplName = gsplEntry.name || '';
                    const fetchedGsplDaoType = daoTypeToDescription(gsplEntry.govAccountType) || '';
                    const fetchedGsplRank = gsplEntry.rank !== undefined ? gsplEntry.rank : 0;
                    const fetchedGsplGovProgram = gsplEntry.governanceProgram || '';
                    // Update state
                    setListingExists(true);
                    //set intial listing values from fetched data in GSPL directory
                    setGsplName(fetchedGsplName);
                    setGsplStatus(statusToDescription(gsplEntry.requestStatus));
                    setGsplDaoType(fetchedGsplDaoType);
                    setGsplRank(fetchedGsplRank);
                    setGsplUri(fetchedGsplUri);
                    setGsplGovProgram(fetchedGsplGovProgram);
                    //state to check if listing exists
                    exists = true;
                    // Set initial values directly from fetched data
                    setInitialGsplUri(fetchedGsplUri);
                    setInitialGsplName(fetchedGsplName);
                    setInitialGsplDaoType(fetchedGsplDaoType);
                    setInitialGsplRank(fetchedGsplRank);
                    break; 
                } 
            }
        }
        //console.log("listingExists: "+listingExists);
        //set default values if the DAO isn't listed yet
        if (!exists){
            setGsplName(realm.account?.name|| '');
            setGsplStatus("Unlisted");
            setGsplRank(0);
            // Set initial values for a new listing
            setInitialGsplUri('');
            setInitialGsplName(realm.account?.name|| '');
            setInitialGsplDaoType('');
            setInitialGsplRank(0);
        }
    }

    function generateInstructions(){
        if (gsplName && gsplStatus && gsplDaoType && gsplUri){
            let setTitle = "GSPL Listing Request Proposal";
            let setDescription = "GSPL Listing Request Proposal for "+realm.account?.name;
            if (listingExists&&gsplStatus!="Pending"&&gsplStatus!="Unlisted"){
                setTitle = "GSPL Listing Update Proposal for "+realm.account?.name;
                setDescription = "GSPL Listing Update Proposal for "+realm.account?.name;
            }
            setProposalTitle(setTitle);
            setProposalDescription(setDescription);
        }
    }

    React.useEffect(() => { 
        //console.log("gsplName: "+gsplName+" gsplStatus: "+gsplStatus+" gsplDaoType: "+gsplDaoType+" gsplRank: "+gsplRank+" gsplUri: "+gsplUri);
        if (gsplName && gsplStatus && gsplDaoType && gsplUri && gsplStatus !== "Unlisted" && gsplStatus !== "Rejected" && gsplStatus !== "Disabled"){
            generateInstructions();
            //setOpenAdvanced(true);
        } else {
            setOpenAdvanced(false);
        }
    }, [gsplName, gsplStatus, gsplDaoType, gsplRank, gsplUri]);

    return (
        <>
            <Tooltip title="Manage this Governance Directory Listing" placement="right">
                <MenuItem onClick={handleClickOpen} disabled={false}>
                <ListItemIcon>
                    <VerifiedIcon fontSize="small" />
                </ListItemIcon>
                Directory
                </MenuItem>
            </Tooltip>
            
            <BootstrapDialog 
                //maxWidth={"xl"}
                fullWidth={true}
                open={open} onClose={handleClose}
                PaperProps={{
                    style: {
                        background: '#13151C',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px'
                    }
                    }}
                >
                <BootstrapDialogTitle 
                    id='extensions-dialog'
                    onClose={handleCloseDialog}
                >
                    Directory Extension
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText>
                        Welcome to the GSPL Directory Extension.  List your DAO to get listed, Create a proposal for GSPL Approval and or Update your current Listing.
                    </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="gspl_status"
                            name="gspl_status"
                            label="DAO Request Status"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={gsplStatus}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ readonly: true}}
                            sx={{
                                textAlign: "center",
                                input: { color: getTextColor() } // Conditionally set the text color
                            }}
                        />
                        <TextField
                            autoFocus
                            margin="dense"
                            id="gspl_name"
                            name="gspl_name"
                            label="DAO Name"
                            type="text"
                            fullWidth
                            variant="outlined"
                            color="success"
                            focused
                            value={gsplName}
                            InputLabelProps={{ shrink: true }}
                            sx={{textAlign:"center"}}
                        />
                        <Grid container spacing={2}> {/* Grid container with spacing between the fields */}
                            <Grid item xs={6}> 
                                <FormControl fullWidth variant="outlined" margin="dense">
                                <InputLabel 
                                    id="gspl_daoType_label" 
                                    shrink={!!gsplDaoType} // Conditionally shrink label if value is set
                                    >
                                    
                                </InputLabel>
                                    <Select
                                    labelId="gspl_daoType_label"
                                    id="gspl_daoType"
                                    name="gspl_daoType"
                                    value={gsplDaoType}
                                    onChange={(e) => setGsplDaoType(e.target.value)} // Handle changes
                                    label="Type of DAO"
                                    displayEmpty // Allows display of empty option
                                    >
                                        <MenuItem value="">
                                        <em>Select DAO Type</em> {/* Placeholder when no value is selected */}
                                    </MenuItem>
                                        <MenuItem value="Social">Social</MenuItem>
                                        <MenuItem value="Finance">Finance</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6}> {/* The second field, taking the other half of the width */}
                                <TextField
                                    autoFocus
                                    margin="dense"
                                    id="gspl_rank"
                                    name="gspl_rank"
                                    label="Rank"
                                    type="number"
                                    fullWidth
                                    variant="outlined"
                                    value={gsplRank}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{textAlign:"center"}}
                                />
                            </Grid>
                        </Grid>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="gspl_uri"
                            name="gspl_uri"
                            label="Metadata URI"
                            type="text"
                            fullWidth
                            multiline
                            maxRows={3}
                            variant="outlined"
                            value={gsplUri}
                            InputLabelProps={{ shrink: true }}
                            onChange={handleGsplUriChange}
                            error={!!gsplUriError}
                            helperText={gsplUriError}
                            sx={{textAlign:"center"}}
                        />
                        {openAdvanced ? 
                            <>
                                <AdvancedProposalView 
                                    proposalTitle={proposalTitle}
                                    setProposalTitle={setProposalTitle}
                                    proposalDescription={proposalDescription}
                                    setProposalDescription={setProposalDescription}
                                    isDraft={isDraft}
                                    setIsDraft={setIsDraft}
                                />
                            </>
                            :
                            <></>
                        }

                        <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                            <Typography variant="caption">Made with ❤️ by Grape</Typography>
                        </Box>
                        <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p:0, pb:1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', p:0 }}>
                            {(publicKey) &&
                                    <Button
                                        disabled={loading}
                                        size='small'
                                        onClick={handleAdvancedToggle}
                                        sx={{
                                            p:1,
                                            borderRadius:'17px',
                                            justifyContent: 'flex-start',
                                            '&:hover .MuiSvgIcon-root.claimIcon': {
                                                color:'rgba(255,255,255,0.90)'
                                            }
                                        }}
                                        startIcon={
                                            <>
                                                <SettingsIcon 
                                                    className="claimIcon"
                                                    sx={{
                                                        color:'rgba(255,255,255,0.25)',
                                                        fontSize:"14px!important"}} />
                                            </>
                                        }
                                    >
                                        Advanced
                                    </Button>
                            }
                            </Box>
                            {listingExists ? (
                                <Box sx={{ display: 'flex', p:0 }}>
                                    <Button 
                                        autoFocus 
                                        //onClick={handleUpdateProposal}
                                        onClick={handleUpdateProposal}
                                        sx={{
                                            p:1,
                                            borderRadius:'17px',
                                            '&:hover .MuiSvgIcon-root.claimNowIcon': {
                                                color:'rgba(255,255,255,0.90)'
                                            }
                                        }}
                                        startIcon={
                                        <>
                                            <UpdateIcon 
                                                sx={{
                                                    color:'rgba(255,255,255,0.25)',
                                                    fontSize:"14px!important"}}
                                            />
                                        </>
                                        }
                                    >
                                        {gsplStatus === "Pending" ? "Proposal to Approve" : "Update Listing"}
                                    </Button>
                                </Box>   
                            ) : (
                                <Box sx={{ display: 'flex', p:0 }}>
                                    <Button 
                                        autoFocus 
                                        onClick={handlePublishProposal}
                                        sx={{
                                            p:1,
                                            borderRadius:'17px',
                                            '&:hover .MuiSvgIcon-root.claimNowIcon': {
                                                color:'rgba(255,255,255,0.90)'
                                            }
                                        }}
                                        startIcon={
                                        <>
                                            <PublishIcon 
                                                sx={{
                                                    color:'rgba(255,255,255,0.25)',
                                                    fontSize:"14px!important"}}
                                            />
                                        </>
                                        }
                                    >
                                        Publish Listing
                                    </Button>
                                </Box>  
                            )}
                        </DialogActions>
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}