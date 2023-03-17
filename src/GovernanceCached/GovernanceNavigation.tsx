
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
  Tooltip,
  Button,
  Grid,
  Box,
  ButtonGroup,
} from '@mui/material/';

import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';

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
                    <Tooltip title="Proposals">
                        <Button
                            component={Link}
                            to={'/cachedgovernance/'+governanceAddress}
                        ><HowToVoteIcon /></Button>
                    </Tooltip>
                    <Tooltip title="Metrics">
                        <Button
                            component={Link}
                            to={'/metrics/'+governanceAddress}
                        ><ShowChartIcon /></Button>
                    </Tooltip>
                    <Tooltip title="Treasury">
                        <Button
                            disabled={true}
                        ><AccountBalanceIcon /></Button>
                    </Tooltip>
                    <Tooltip title="Members">
                        <Button
                            disabled={true}
                        ><GroupIcon /></Button>
                    </Tooltip>

                </ButtonGroup>
                
        </Box>
    );
}