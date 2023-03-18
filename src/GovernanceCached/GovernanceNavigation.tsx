
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
import BarChartIcon from '@mui/icons-material/BarChart';
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
                    <Tooltip title={
                            <>Proposals<br/>* Via Cached Storage
                            </>
                        }>
                        <Button
                            component={Link}
                            to={'/cachedgovernance/'+governanceAddress}
                        ><HowToVoteIcon /></Button>
                    </Tooltip>
                    <Tooltip title={
                        <>Metrics<br/>* Via Cached Storage
                        </>}>
                        <Button
                            component={Link}
                            to={'/metrics/'+governanceAddress}
                        ><BarChartIcon /></Button>
                    </Tooltip>
                    <Tooltip title={
                        <>Members<br/>* Via Cached Storage
                        </>}>
                        <Button
                            component={Link}
                            to={'/members/'+governanceAddress}
                        ><GroupIcon /></Button>
                    </Tooltip>
                    <Tooltip title="Treasury (coming soon)">
                        <Button
                            sx={{color:'#999', ml:1}}
                        ><AccountBalanceIcon /></Button>
                    </Tooltip>

                </ButtonGroup>
                
        </Box>
    );
}