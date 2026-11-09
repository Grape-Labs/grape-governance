import React from 'react';
import {Box, Typography} from '@mui/material';
import {ManageGovernanceProposal} from '../ManageGovernanceProposal';

export default function ProposalManagementActions({connected, canManageDraft, pendingSigner, canFinalize, canCancel, managementProps, vetoAction}: {
  connected: boolean;
  canManageDraft: boolean;
  pendingSigner: boolean;
  canFinalize: boolean;
  canCancel: boolean;
  managementProps: any;
  vetoAction?: React.ReactNode;
}) {
  return <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
    {!connected ? <Typography>Connect your wallet to see available actions.</Typography> : <>
      {canManageDraft && <ManageGovernanceProposal {...managementProps} mode={2} />}
      {(canManageDraft || pendingSigner) && <ManageGovernanceProposal {...managementProps} mode={1} />}
      {canFinalize && <ManageGovernanceProposal {...managementProps} mode={5} />}
      {canCancel && <ManageGovernanceProposal {...managementProps} mode={3} />}
      {!canManageDraft && !pendingSigner && !canFinalize && !canCancel &&
        <Typography color="text.secondary">No signatory, sign-off, finalize, or cancel actions are available for this wallet at this stage.</Typography>}
      {vetoAction}
    </>}
  </Box>;
}
