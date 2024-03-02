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
    FormControl,
    FormControlLabel,
    Switch,
} from '@mui/material/';

export default function AdvanvedProposalView(props: any){
    const proposalTitle = props?.proposalTitle;
    const setProposalTitle = props?.setProposalTitle;
    const proposalDescription = props?.proposalDescription;
    const setProposalDescription = props?.setProposalDescription;
    const toggleGoverningMintSelected = props?.toggleGoverningMintSelected;
    const isGoverningMintCouncilSelected = props?.isGoverningMintCouncilSelected;
    const isGoverningMintSelectable = props?.isGoverningMintSelectable;
    const isDraft = props?.isDraft;
    const setIsDraft = props?.setIsDraft;
    
    const maxTitleLen = 130;
    const maxDescriptionLen = 350;//512;

    return (
        <>
            <Box
                sx={{
                    border:'1px solid #333',
                    borderRadius:'17px',
                    p:2,
                }}
            >
                
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField
                    autoFocus
                    required
                    margin="dense"
                    id="proposal_title"
                    name="proposal_title"
                    label="Proposal TItle"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={proposalTitle}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    sx={{textAlign:"center"}}
                    />
                
                <Grid sx={{textAlign:'right',}}>
                    <Typography variant="caption">{proposalTitle ? proposalTitle.length > 0 ? maxTitleLen - proposalTitle.length : maxTitleLen : maxTitleLen} characters remaining</Typography>
                </Grid>
            </FormControl>

            <FormControl fullWidth  sx={{mb:2}}> 
                <TextField
                    autoFocus
                    required
                    margin="dense"
                    id="proposal_dsecription"
                    name="proposal_description"
                    label="Proposal Description"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={proposalDescription}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => setProposalDescription(e.target.value)}
                    sx={{textAlign:"center"}}
                    />
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption">{proposalDescription ? proposalDescription.length > 0 ? maxDescriptionLen - proposalDescription.length : maxDescriptionLen : maxDescriptionLen} characters remaining</Typography>
                    </Grid>
                </FormControl>

                <FormControl fullWidth >
                    <FormControlLabel 
                    control={
                        <Switch 
                        checked={isGoverningMintCouncilSelected} //communitySupport ? false : true}
                        onChange={
                            (e) => {
                                toggleGoverningMintSelected(e.target.checked)
                            }
                        }
                        disabled={!isGoverningMintSelectable}
                        />
                    } 
                    label="Council" />
                </FormControl>

                <FormControl fullWidth >
                    <FormControlLabel 
                    control={
                        <Switch 
                            checked={isDraft}
                            onChange={
                                (e) => {
                                    setIsDraft(!isDraft)
                                }
                            }
                        />
                    } 
                    label="Draft" />
                </FormControl>
            </Box>
        </>
    )
}