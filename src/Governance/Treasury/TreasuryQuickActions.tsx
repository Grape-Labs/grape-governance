import React from 'react';
import { Box, Typography } from '@mui/material';
import BatchSendView from './plugins/BatchSendView';
import IntraDAOView from './plugins/IntraDAOView';

export default function TreasuryQuickActions(props: any) {
  return <Box sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid rgba(130,210,185,0.25)', background: 'rgba(130,210,185,0.04)' }}>
    <Typography variant="overline" color="text.secondary">Frequent actions</Typography>
    <Typography variant="body2" sx={{ mb: 1.5 }}>Pay multiple wallets or grant DAO members voting power in one proposal.</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
      <BatchSendView {...props} useButton submitLabel={props.editingDraft ? 'Add batch to instruction list' : undefined} />
      <IntraDAOView {...props} useButton initialAction="grant" initialBulkGrant
        initialTargetRealm={props.governanceAddress}
        initialTargetMint={props.realm?.account?.communityMint?.toBase58?.()}
        submitLabel={props.editingDraft ? 'Add grants to instruction list' : undefined} />
    </Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
      {props.editingDraft ? 'Review the batch in the instruction list, then choose Add to Draft.' : 'These actions prepare governance proposals. Transfers and grants execute after approval.'}
    </Typography>
  </Box>;
}
