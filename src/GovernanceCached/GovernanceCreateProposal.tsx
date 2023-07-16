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
    createInstructionData  } from '@solana/spl-governance';

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
  FormGroup
} from '@mui/material/';

import TextareaAutosize from '@mui/base/TextareaAutosize';
import { Title } from '@devexpress/dx-react-chart';

export default function GovernanceCreateProposalView(props: any){

    const showGovernanceTitle = true;
    const realmName = 'Test';
    const [title, setTitle] = React.useState(null);
    const [description, setDescription] = React.useState(null);
    const maxTitleLen = 130;
    const maxDescriptionLen = 255;

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

    
    return (
        <>
            <Box
                height='100%'
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
                                    
                                    {/*
                                    <Grid item xs={12}>
                                        <Button
                                            size='small'
                                            sx={{color:'white', borderRadius:'17px'}}
                                            href={`https://realms.today/dao/${governanceAddress}/proposal/${proposalPk}`}
                                            target='blank'
                                        >
                                            <Typography variant="caption">
                                            View on Realms <OpenInNewIcon fontSize='inherit'/>
                                            </Typography>
                                        </Button>
                                    </Grid>
                                    */}
                                </Grid>
                            </Grid>
                        </Grid>
                    }
                </>
            </Box>

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
                        backgroundColor:'rgba(0,0,0,0.5)', 
                        p:1,pr:3}}
                >
                
                    <TextField 
                        fullWidth 
                        label="Title" 
                        id="fullWidth"
                        value={title}
                        onChange={(e) => {
                            if (!title || title.length < maxTitleLen)
                                setTitle(e.target.value)
                            }}
                        sx={{borderRadius:'17px', maxlength:maxDescriptionLen}} 
                    />
                    <Grid sx={{textAlign:'right',}}>
                    <Typography variant="caption">{title ? title.length > 0 ? maxTitleLen - title.length : maxTitleLen : maxTitleLen} characters remaining</Typography>
                    </Grid>
                    
                    <TextField 
                        fullWidth
                        label="Description"
                        multiline
                        rows={4}
                        maxRows={4}
                        value={description}
                        onChange={(e) => {
                            if (!description || description.length < maxDescriptionLen)
                                setDescription(e.target.value)
                            }}
                        
                        sx={{maxlength:maxDescriptionLen}}
                        />
                    <Grid sx={{textAlign:'right',}}>
                    <Typography variant="caption">{description ? description.length > 0 ? maxDescriptionLen - description.length : maxDescriptionLen : maxDescriptionLen} characters remaining</Typography>
                    </Grid>
                    <br/>
                    <FormControlLabel required control={<Switch />} label="Council Vote" />
                </Box>

            </Grid>
        </>
    );

}