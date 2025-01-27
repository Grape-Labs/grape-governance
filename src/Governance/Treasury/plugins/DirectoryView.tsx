import MerkleDistributor from '@jup-ag/merkle-distributor-sdk';
import { PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, web3 } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';
import axios from "axios";

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';

import { 
    TOKEN_PROGRAM_ID, 
    getMint,
    getAssociatedTokenAddress
} from "@solana/spl-token-v2";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { RPC_ENDPOINT } from '../../../utils/grapeTools/constants';

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
    Stack,
    FormControl,
    Select,
    InputLabel
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import GetAppIcon from '@mui/icons-material/GetApp';
import VerifiedIcon from '@mui/icons-material/Verified';
import ExtensionIcon from '@mui/icons-material/Extension';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

import {createUmi} from "@metaplex-foundation/umi-bundle-defaults";
import {getRealms, RequestStatus, GovernanceEntryAccountData, DAOType} from "gspl-directory";
import {publicKey as UmiPK} from "@metaplex-foundation/umi";

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

export default function DirectoryExtensionView(props: any){
    const setReload = props?.setReload;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const governingTokenMint = props.governingTokenMint;
    const [editProposalAddress, setEditProposalAddress] = React.useState(props?.editProposalAddress);
    const title = props?.title || "Proposal";
    const realm = props?.realm;
    const governanceAddress = props.governanceAddress || realm.pubkey.toBase58();
    const realmName = props?.realmName;
    
    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const instructions = props?.instructions;
    const setInstructions = props?.setInstructions;
    
    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey } = useWallet();
    const wallet = useWallet();


    const [distributor, setDistributor] = React.useState(null);
    const [claimTokenAddress, setClaimTokenAddress] = React.useState(null);
    const [claimableAmount, setClaimableAmount] = React.useState(null);
    const [claimMintInfo, setClaimMintInfo] = React.useState(null);
    const [mintInfo, setMintInfo] = React.useState(null);
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
    const [listingExists, setListingExists] = React.useState(false); // Track if listing exists
      
    // Function to get color based on the gsplStatus value
    const getTextColor = () => {
        if (gsplStatus === 'Pending') {
            return 'orange'; // Example for Pending status
        } else if (gsplStatus === 'Approved') {
            return 'green';  // Example for Approved status
        } else if (gsplStatus === 'Rejected') {
            return 'red';    // Example for Rejected status
        } else if (gsplStatus === 'Disabled') {
            return 'purple';    // Example for Rejected status
        }
        return 'pink';      // Default color
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

    const handleSubmitProposal = () => {
        console.log("Submit button clicked");
        // Add your submit logic here
    }

    const handleUpdateProposal = () => {
        console.log("Update button clicked");
        // Add your submit logic here
    }

    const handleProposalIx = async() => {
        handleCloseExtMenu();
        setPropOpen(false);

        const ixs = await distributor.claimToken(new PublicKey(governanceNativeWallet));
        /*
        for (var instruction of ixs){
            for (var key of instruction.keys){ // force remove realmConfig which is set to writable by default
                if (key.pubkey.toBase58() === governanceNativeWallet){
                    key.isWritable = false;
                }
            }
        }*/

        if (ixs){

            const propIx = {
                title:'QA Claim Ext',
                //description:`Claim Governance Power ${(claimableAmount/10**claimMintInfo.decimals).toLocaleString()} ${mintInfo && mintInfo.name} via extension on Governance.so`,
                description:'Claim Governance Power',
                ix:ixs,
                nativeWallet:governanceNativeWallet,
            }

            setInstructions(propIx);
            setExpandedLoader(true);
        }

        
    }

    const getMintFromApi = async(tokenAddress: PublicKey) => {
        
        const uri = `https://api.shyft.to/sol/v1/token/get_info?network=mainnet-beta&token_address=${tokenAddress}`;
        
        return axios.get(uri, {
                headers: {
                    'x-api-key': SHYFT_KEY
                }
                })
            .then(response => {
                if (response.data?.result){
                    return response.data.result;
                }
                return null
            })
            .catch(error => 
                {   
                    // revert to RPC
                    console.error(error);
                    return null;
                });
    }

    const checkClaimStatus = async(tokenAddress?:string) => {
        setLoading(true);
        setClaimMintInfo(null);
        setMintInfo(null);
        setClaimableAmount(null);
        const merkleDistributor = new MerkleDistributor(provider, {
            targetToken: new PublicKey(tokenAddress || claimTokenAddress), // the token to be distributed.
            claimProofEndpoint: 'https://worker.jup.ag/jup-claim-proof',
        });
        setDistributor(merkleDistributor);
        
        const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(tokenAddress || claimTokenAddress));
        if (mintInfo){
            setClaimMintInfo(mintInfo);
            //console.log("mintInfo: ",mintInfo);
            const mintInfoApi = await getMintFromApi(tokenAddress || claimTokenAddress);
            if (mintInfoApi)
                setMintInfo(mintInfoApi)
            // governanceNativeWallet
            const claimStatus = await merkleDistributor.getUser(new PublicKey(governanceNativeWallet));
            const amount = claimStatus?.amount;
            //const isClaimed = claimStatus?.proof. .isClaimed;
            console.log("claimStatus: "+JSON.stringify(claimStatus));

            setClaimableAmount(amount);
        } else{

        }
        setLoading(false);
        
    }

    const fetchClaimForToken = (tokenAddress:string) => {
        setClaimTokenAddress(tokenAddress);
        checkClaimStatus(tokenAddress);
    }

    const handleCheckClaimStatus = () => {
        checkClaimStatus();
    }

    // State to handle the button's disabled status
    const [isEditButtonDisabled, setEditButtonDisabled] = React.useState(true);

    // Function to check if only the gspl_uri has been edited
    const isOnlyGsplUriEdited = () => {
        return gsplUri !== initialGsplUri && (
            gsplName === initialGsplName &&
            gsplDaoType === initialGsplDaoType &&
            gsplRank === initialGsplRank
        );
    };

    // Function to check if any field other than gspl_uri has been edited
    const isOtherFieldEdited = () => {
        return (
            gsplUri === initialGsplUri &&
            (gsplName !== initialGsplName ||
             gsplDaoType !== initialGsplDaoType ||
             gsplRank !== initialGsplRank)
        );
    };
        
    // Function to check whether the button should be enabled
    React.useEffect(() => {
        if (isOnlyGsplUriEdited() || isOtherFieldEdited()) {
            setEditButtonDisabled(false); // Enable the button
        } else {
            setEditButtonDisabled(true); // Disable the button
        }
        console.log('isOnlyGsplUriEdited:', isOnlyGsplUriEdited());
        console.log('isOtherFieldEdited:', isOtherFieldEdited());
    }, [gsplUri, gsplName, gsplDaoType, gsplRank, initialGsplUri, initialGsplName, initialGsplDaoType, initialGsplRank]); // Recalculate whenever any field changes

    const CONFIG = UmiPK("GrVTaSRsanVMK7dP4YZnxTV6oWLcsFDV1w6MHGvWnWCS");
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
            console.log("Could not load GSPDL");
            return [];
        }
    }

    //get DAO's GSPL entry
    const callGovernanceLookup = async() => {
        setGsplName('');
        setGsplStatus('');
        setGsplDaoType('');
        let exists = false;
        const gspldir = await initGrapeGovernanceDirectory();
        if (realm.account?.name){
            for (var diritem of gspldir){
                if (realm.account?.name === diritem.name){
                    const gsplEntry = diritem;
                    const fetchedGsplUri = gsplEntry.metadataUri || '';
                    const fetchedGsplName = gsplEntry.name || '';
                    const fetchedGsplDaoType = daoTypeToDescription(gsplEntry.govAccountType) || '';
                    const fetchedGsplRank = gsplEntry.rank !== undefined ? gsplEntry.rank : 0;

                    setGsplName(fetchedGsplName);
                    setGsplStatus(statusToDescription(gsplEntry.requestStatus));
                    setGsplDaoType(fetchedGsplDaoType);
                    setGsplRank(fetchedGsplRank);
                    setGsplUri(fetchedGsplUri);
                    /*setGsplName(gsplEntry.name);
                    setGsplStatus(statusToDescription(gsplEntry.requestStatus));
                    setGsplDaoType(daoTypeToDescription(gsplEntry.govAccountType));
                    setGsplRank(gsplEntry.rank);
                    setGsplUri(gsplEntry.metadataUri);*/
                    exists = true;
                    //console.log("request status: ",gsplEntry.requestStatus);
                    // Set initial values directly from fetched data
                    setInitialGsplUri(fetchedGsplUri);
                    setInitialGsplName(fetchedGsplName);
                    setInitialGsplDaoType(fetchedGsplDaoType);
                    setInitialGsplRank(fetchedGsplRank);
                }
            }
        }
        //set default values if the DAO isn't listed yet
        if (!exists){
            setGsplName(realm.account?.name|| '');
            setGsplStatus("Pending");
            setGsplRank(0);

            // Set initial values for a new listing
            setInitialGsplUri('');
            setInitialGsplName(realm.account?.name|| '');
            setInitialGsplDaoType('');
            setInitialGsplRank(0);
        }
        setListingExists(exists); // Update state

        if (exists){
                // Set initial values based on the props or fetched data
                setInitialGsplUri(gsplUri|| '');
                setInitialGsplName(gsplName|| '');
                setInitialGsplDaoType(gsplDaoType|| '');
                setInitialGsplRank(gsplRank|| null);
        }
    }

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
                        Welcome to the GSPL Directory Extension.  Create a proposal to get your DAO listed or update its current listing.
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
                            onChange={(e) => setGsplUri(e.target.value)}
                            sx={{textAlign:"center"}}
                        />
                        {listingExists && (
                            <Box mt={2} textAlign="right">
                                <Button 
                                    variant="contained" 
                                    color="primary" 
                                    onClick={handleUpdateProposal}
                                    startIcon={<EditIcon />}
                                    disabled={isEditButtonDisabled} // Conditionally disable/enable button need to look at it doesn't seem to work
                                >
                                    Proposal to Update Listing
                                </Button>
                            </Box>
                        )}
                        {!listingExists && (
                            <Box mt={2} textAlign="right">
                                <Button 
                                    variant="contained" 
                                    color="primary" 
                                    onClick={handleSubmitProposal}
                                    startIcon={<AddCircleIcon />}
                                >
                                    Submit Listing Proposal
                                </Button>
                            </Box>
                        )}
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}