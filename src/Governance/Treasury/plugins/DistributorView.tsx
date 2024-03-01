import {
    createAllocTreeIx,
    ValidDepthSizePair,
    SPL_NOOP_PROGRAM_ID,
    SPL_ACCOUNT_COMPRESSION_PROGRAM_ID
} from '@solana/spl-account-compression';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, Transaction, Keypair } from '@solana/web3.js';
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
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import ShareIcon from '@mui/icons-material/Share';
import GetAppIcon from '@mui/icons-material/GetApp';
import ExtensionIcon from '@mui/icons-material/Extension';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { convertSecondsToLegibleFormat } from '../../../utils/grapeTools/helpers';

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

export default function DistributorExtensionView(props: any){
    const setReload = props?.setReload;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const editProposalAddress = props?.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const governanceAddress = props.governanceAddress;
    const title = props?.title || "Proposal";
    const realm = props?.realm;
    
    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const instructions = props?.instructions;
    const setInstructions = props?.setInstructions;
    
    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey } = useWallet();
    const wallet = useWallet();

    const [distributor, setDistributor] = React.useState(null);
    const [mintInfo, setMintInfo] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [open, setPropOpen] = React.useState(false);

    const [selectedToken, setSelectedToken] = React.useState(null);
    const [tokenRecipient, setTokenRecipient] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(null);


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
    };

    const handleClose = () => {
        setPropOpen(false);
        handleCloseExtMenu();
    };

    const handleProposalIx = async() => {
        handleCloseExtMenu();
        setPropOpen(false);

        const recipients = new Array();
        recipients.push(tokenRecipient);

        // Prepare data for Merkle tree
        const data = recipients.map((recipient) => ({
            address: recipient,
            amount: tokenAmount,
        }));

        const maxDepthSizePair: ValidDepthSizePair = { maxDepth: 16, maxBufferSize: 64 }; // Example depth and size
        const canopyDepth = 0;

        const treeKeypair = Keypair.generate();

        const ixs = await createAllocTreeIx(
            RPC_CONNECTION,
            treeKeypair.publicKey,
            new PublicKey(governanceNativeWallet),
            maxDepthSizePair,
            canopyDepth
        );

        console.log("ixs: "+JSON.stringify(ixs));
      
        if (ixs){

            const propIx = {
                title:'Distributor Ext',
                description:`Distributor ${mintInfo ? mintInfo?.name : selectedToken} Governance Power`,
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

    const checkMerkleStatus = async(tokenAddress?:string) => {
        /*
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
        */
    }

    const fetchClaimForToken = (tokenAddress:string) => {
        //setClaimTokenAddress(tokenAddress);
        //checkClaimStatus(tokenAddress);
    }

    const handleCheckClaimStatus = () => {
        //checkClaimStatus();
    }

    
    return (
        <>
            <Tooltip title="Highly Efficient Merkle Distributor" placement="right">
                <MenuItem onClick={handleClickOpen} disabled={true}>
                <ListItemIcon>
                    <ShareIcon fontSize="small" />
                </ListItemIcon>
                Distributor
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
                    Distributor
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText>
                        Welcome to the Grape Merkle Distributor
                    </DialogContentText>
                    
                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{mt:1,mb:1,textAlign:'center'}}>
                        <Stack direction="row" spacing={1}>
                            <Chip
                                disabled={loading}
                                variant="outlined"
                                label="USDC"
                                onClick={(e) => setSelectedToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")}
                                avatar={<Avatar alt="USDC" src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png" />}
                                />
                        
                        </Stack>
                    </Box>

                    {selectedToken ?
                        <>Selected Token: {selectedToken}</>
                        :
                        <></>
                    }


                        <TextField
                            autoFocus
                            required
                            margin="dense"
                            id="token_amount"
                            name="token_amount"
                            label="Amount"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={tokenAmount}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => setTokenAmount(e.target.value)}
                            sx={{textAlign:"center"}}
                            disabled={!selectedToken}
                            />

                        <TextField
                            autoFocus
                            required
                            margin="dense"
                            id="recipient_address"
                            name="recipient_address"
                            label="Recipient"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={tokenRecipient}
                            InputLabelProps={{ shrink: true }}
                            onChange={(e) => setTokenRecipient(e.target.value)}
                            sx={{textAlign:"center"}}
                            disabled={!selectedToken}
                            />
                    
                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                        <Typography variant="caption">Made with ❤️ by Grape #OPOS</Typography>
                    </Box>

                    <DialogActions>
                        {(publicKey) &&
                        <Button 
                            disabled={!selectedToken && !loading && !tokenRecipient && !tokenAmount}
                            autoFocus 
                            onClick={handleProposalIx}
                            sx={{
                                '&:hover .MuiSvgIcon-root': {
                                    color:'rgba(255,255,255,0.90)'
                                }
                            }}
                            startIcon={
                            <>
                                <ShareIcon 
                                    sx={{
                                        color:'rgba(255,255,255,0.25)',
                                        fontSize:"14px!important"}} />
                            </>
                            }
                        >
                            <>Distribute</>
                        </Button>
                        }
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}