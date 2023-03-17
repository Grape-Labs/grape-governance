
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import Gist from 'react-gist';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  Typography,
  Button,
  Grid,
  Box,
  ButtonGroup,
} from '@mui/material/';

export default function GovernanceNavigation(props: any){
    const governanceAddress = props.governanceAddress;

    return(
        <Box
            m={1}
            //margin
            display="flex"
            justifyContent="flex-end"
            alignItems="flex-end"
            >
                <ButtonGroup
                    color='inherit'
                    size='small'
                    variant='outlined'
                    sx={{borderRadius:'17px'}}
                >
                    <Button
                        component={Link}
                        to={'/cachedgovernance/'+governanceAddress}
                    >Proposals</Button>
                    <Button
                        component={Link}
                        to={'/metrics/'+governanceAddress}
                    >Metrics</Button>
                    <Button
                        disabled={true}
                    >Treasury</Button>
                    <Button
                        disabled={true}
                    >Members</Button>

                </ButtonGroup>
                
        </Box>
    );
}