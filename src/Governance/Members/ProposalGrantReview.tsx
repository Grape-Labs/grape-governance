import React from 'react';
import {Box,Button,Typography,TableContainer,Table,TableHead,TableRow,TableCell,TableBody,Chip,Stack,LinearProgress} from '@mui/material';
import GrantTrackingView from './GrantTrackingView';

export default function ProposalGrantReview({details,realm,mint,grantor}:{details:any[];realm:string;mint:string;grantor:string}){
  const wallets=Array.from(new Set<string>(details.filter(d=>Number(d.amount)>0).map(d=>{
    // A token account address must never be treated as its owner's wallet.
    if(d.type==='SPL Governance Program by Solana')return d.grantRecipientWallet || null;
    return d.tokenOwner || (d.recipientWallet && String(d.recipientWallet)!==String(d.destinationAta)?String(d.recipientWallet):null);
  }).filter(Boolean)));
  const [positions,setPositions]=React.useState<Record<string,string>>({});
  const [errors,setErrors]=React.useState<Record<string,string>>({});
  const [busy,setBusy]=React.useState(false);
  const [started,setStarted]=React.useState(false);
  const alive=React.useRef(true);
  React.useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  const check=async()=>{
    setStarted(true);setBusy(true);setErrors({});setPositions({});
    // Bound concurrency so a large award proposal does not flood the provider.
    for(let offset=0;offset<wallets.length && alive.current;offset+=3){
      await Promise.all(wallets.slice(offset,offset+3).map(async wallet=>{
        try{
          const response=await fetch(`/api/grant-tracking?${new URLSearchParams({mode:'position',wallet,realm,mint})}`);
          const data=await response.json();
          if(!response.ok || data.position==null)throw new Error(data.error||'Position unavailable');
          if(alive.current)setPositions(previous=>({...previous,[wallet]:data.position}));
        }catch(error){if(alive.current)setErrors(previous=>({...previous,[wallet]:error.message}));}
      }));
    }
    if(alive.current)setBusy(false);
  };
  if(!wallets.length)return <Typography variant="body2" sx={{m:2}}>Recipient retention check unavailable: no supported award wallets have been resolved.</Typography>;
  return <Box sx={{m:1,p:2,border:'1px solid rgba(255,255,255,0.12)',borderRadius:2}}>
    <Stack direction={{xs:'column',sm:'row'}} spacing={2} justifyContent="space-between" alignItems={{xs:'stretch',sm:'center'}}>
      <Box>
        <Typography variant="h6">Recipient deposits</Typography>
        <Typography variant="body2" color="text.secondary">Check tokens staked by {wallets.length} recipient{wallets.length===1?'':'s'}, then compare with previous grants.</Typography>
      </Box>
      <Button variant="contained" disabled={busy} onClick={check} sx={{flexShrink:0}}>{busy?'Checking deposits…':started?'Refresh deposits':'Check recipient deposits'}</Button>
    </Stack>
    {busy && <LinearProgress sx={{mt:2}}/>}
    {started && <Typography role="status" variant="body2" color="text.secondary" sx={{mt:1}}>{Object.keys(positions).length} of {wallets.length} deposits checked{Object.keys(errors).length?` · ${Object.keys(errors).length} unavailable — refresh to retry`:''}</Typography>}
    <Box component="details" sx={{mt:1.5}}>
      <Typography component="summary" variant="body2" color="text.secondary" sx={{cursor:'pointer'}}>How this check works</Typography>
      <Typography variant="body2" color="text.secondary" sx={{mt:1}}>Checks current token retention only. Proposed awards are not included in grant totals. For executed proposals, results reflect current holdings and history, not eligibility at execution time. Only resolved award wallets are listed; unsupported voting plugins and failed lookups remain unavailable.</Typography>
    </Box>
    {started && <>
    <GrantTrackingView mint={mint} realm={realm} grantors={grantor?[grantor]:[]} loadWallets={async()=>grantor?[grantor]:[]}>
      {(cell,exportMembers,qualify)=><>
        <Typography variant="body2" color="text.secondary" sx={{mb:1}}>Load previous grants above to complete the retention check. Include older history before relying on a passing result.</Typography>
        <Button onClick={()=>exportMembers(wallets.map(address=>({address,staked:{depositedAmountExact:positions[address]}})))}>Export recipients CSV</Button>
        <TableContainer><Table size="small" aria-label="Recipient deposit checks"><TableHead><TableRow><TableCell>Recipient</TableCell><TableCell align="right">Tokens staked</TableCell><TableCell align="right">Previous grants</TableCell><TableCell>Retention check</TableCell></TableRow></TableHead><TableBody>
          {wallets.map(wallet=>{
            const result=positions[wallet]===undefined?(errors[wallet]?'Position unavailable':busy?'Checking…':'Not checked'):qualify(wallet,positions[wallet]);
            return <TableRow key={wallet}><TableCell sx={{overflowWrap:'anywhere',maxWidth:240}}>{wallet}</TableCell><TableCell align="right" title={errors[wallet]}>{positions[wallet]??'—'}</TableCell><TableCell>{cell(wallet,positions[wallet])}</TableCell><TableCell><Chip size="small" label={result} color={result==='Below retention requirement'?'warning':result==='Meets retention requirement'?'success':'default'}/></TableCell></TableRow>;
          })}
        </TableBody></Table></TableContainer>
      </>}
    </GrantTrackingView>
    </>}
  </Box>;
}
