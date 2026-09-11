import React from 'react';
import BigNumber from 'bignumber.js';
import { assessGovernanceSwaps } from '../../server/grants/swap-threshold';
import { PublicKey } from '@solana/web3.js';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Autocomplete, Box, Button, Chip, LinearProgress, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

type Grant = {id:string;signature:string;timestamp:number;recipient:string;amount:string;kind?:string};
type Event = {signature:string;slot?:number;timestamp:number;type:string;amount:string;governanceBasis?:string|null;basisSignature?:string|null;swapPercent?:string|null;thresholdExceeded?:boolean|null};
const short = (s:string) => `${s.slice(0,6)}…${s.slice(-6)}`;
const sum = (values:string[]) => values.reduce((n,v)=>n.plus(v),new BigNumber(0)).toFormat();
const txLink = (signature:string) => <Link href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener noreferrer">{short(signature)}</Link>;
async function request(params:Record<string,string>) {
  const response=await fetch(`/api/grant-tracking?${new URLSearchParams(params)}`);
  const data=await response.json();
  if(!response.ok) throw new Error(data.error || 'Unable to load tracking data.');
  return data;
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}) {
  return <Box sx={{flex:1,minWidth:180,p:2,border:'1px solid rgba(255,255,255,0.12)',borderRadius:2}}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={{my:0.5,fontVariantNumeric:'tabular-nums',overflowWrap:'anywhere'}}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{detail}</Typography>
  </Box>;
}
function RecipientActivity({wallet,mint,realm,since,grants,onClose,onAssessment}:{wallet:string;mint:string;realm:string;since:number;grants:Grant[];onClose:()=>void;onAssessment:(status:string)=>void}) {
  const alive=React.useRef(true);
  const [positionChanges,setPositionChanges]=React.useState<any[]>([]);
  const [positionSnapshot,setPositionSnapshot]=React.useState<any>(null);
  const [positionNext,setPositionNext]=React.useState<string|null>(null);
  const [positionComplete,setPositionComplete]=React.useState(false);
  const [positionBusy,setPositionBusy]=React.useState(false);
  const [positionError,setPositionError]=React.useState('');
  const loadPosition=async()=>{
    setPositionBusy(true);setPositionError('');
    let cursor=positionNext, anchor=positionSnapshot, changes=positionChanges;
    try {
      for(let page=0;page<5;page++){
        const data=await request({mode:'governance',wallet,mint,realm,...(cursor?{before:cursor,positionSlot:String(anchor.slot),decimals:String(anchor.decimals)}:{})});
        if(!alive.current) return;
        if(!anchor) anchor=data.snapshot;
        changes=Array.from(new Map([...changes,...data.changes].map(c=>[c.id,c])).values());
        if(data.next && data.next===cursor) throw new Error('Governance history did not advance. Please retry.');
        cursor=data.next;
        setPositionChanges(changes);setPositionSnapshot(anchor);setPositionNext(cursor);
        if(!cursor){setPositionComplete(true);break;}
      }
    }catch(e){if(alive.current)setPositionError(e.message);}
    finally{if(alive.current)setPositionBusy(false);}
  };
  const [filter,setFilter]=React.useState('all');
  const [events,setEvents]=React.useState<Event[]>([]);
  const [next,setNext]=React.useState<string|null>(null);
  const [loaded,setLoaded]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [balance,setBalance]=React.useState<string|null>(null);
  const [balanceError,setBalanceError]=React.useState(false);
  const [oldest,setOldest]=React.useState<number|null>(null);
  const load=async(before?:string)=>{
    setBusy(true);setError('');
    try {
      const data=await request({mode:'recipient',wallet,mint,since:String(since),...(before?{before}:{})});
      setEvents(previous=>Array.from(new Map([...previous,...data.rows].map((e:Event)=>[`${e.signature}:${e.type}`,e])).values()));
      setNext(data.next);setOldest(data.oldest);setLoaded(true);
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  };
  React.useEffect(()=>{
    alive.current=true;
    load();loadPosition();
    request({mode:'balance',wallet,mint}).then(data=>setBalance(data.balance)).catch(()=>setBalanceError(true));
    return ()=>{alive.current=false;};
  },[]);
  const assessedEvents=React.useMemo(()=>assessGovernanceSwaps(events,positionChanges,positionSnapshot,positionComplete),[events,positionChanges,positionSnapshot,positionComplete]);
  const swaps=assessedEvents.filter(e=>e.type==='swap');
  const flagged=swaps.filter(e=>e.thresholdExceeded===true);
  const unknown=swaps.filter(e=>e.thresholdExceeded==null);
  const assessment=flagged.length?'Swap ≥10% found':unknown.length?'Governance basis unavailable':!positionComplete?'Governance scan incomplete':next?'Partial scan':'No swaps ≥10% found';
  React.useEffect(()=>{if(loaded) onAssessment(assessment);},[loaded,assessment,onAssessment]);
  const visibleEvents=assessedEvents.filter(e=>filter==='all'||(filter==='flagged'?e.thresholdExceeded===true:e.type===filter)).sort((a,b)=>b.timestamp-a.timestamp);
  return <Box sx={{mt:3,p:2,border:'1px solid rgba(255,255,255,0.15)',borderRadius:2}}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h6">Wallet activity</Typography>
      <Button onClick={onClose}>Back to recipients</Button>
    </Stack>
    <Link sx={{overflowWrap:'anywhere'}} href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noopener noreferrer">{wallet}</Link>
    <Typography variant="body2" color="text.secondary" sx={{my:2}}>Activity since {new Date(since*1000).toLocaleDateString()} · earliest loaded grant</Typography>
    <Stack direction={{xs:'column',md:'row'}} spacing={1.5}>
      <Metric label="Tokens granted" value={sum(grants.map(g=>g.amount))} detail={`${grants.length} grants in loaded history`}/>
      <Metric label="Current governance position" value={positionSnapshot?new BigNumber(positionSnapshot.position).toFormat():positionBusy?'Loading…':'Unavailable'} detail="Community tokens deposited in this DAO"/>
      <Metric label="Current wallet balance" value={balance!==null?new BigNumber(balance).toFormat():balanceError?'Unavailable':'Loading…'} detail="For reference only · not used for the 10% check"/>
    </Stack>
    <Box component="details" sx={{my:2}}>
      <Typography component="summary" sx={{cursor:'pointer'}}>Grant breakdown · direct tokens and governance power</Typography>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Grant type</TableCell><TableCell align="right">Tokens granted</TableCell><TableCell>Transaction</TableCell></TableRow></TableHead><TableBody>
        {grants.map(g=><TableRow key={g.id}><TableCell>{new Date(g.timestamp*1000).toLocaleDateString()}</TableCell><TableCell>{g.kind==='governance deposit'?'Governance power':'Direct to wallet'}</TableCell><TableCell align="right">{new BigNumber(g.amount).toFormat()}</TableCell><TableCell>{txLink(g.signature)}</TableCell></TableRow>)}
      </TableBody></Table></TableContainer>
    </Box>
    {positionBusy && <Typography variant="body2" sx={{my:1}}>Checking governance deposits and withdrawals…</Typography>}
    {positionError && <Alert severity="info">{positionError}</Alert>}
    {!positionBusy && !positionComplete && <Button onClick={loadPosition}>{positionError?'Retry governance history':'Continue governance history scan'}</Button>}
    {busy && <LinearProgress sx={{my:2}}/>}
    {error && <Alert severity="error">{error}</Alert>}
    {loaded && <>
      <Alert severity={next?'info':'success'} sx={{my:2}}>{next?`Partial history: loaded back to ${oldest?new Date(oldest*1000).toLocaleString():'an unknown date'}. Load older activity before treating totals as complete.`:'Reached the tracking date or the end of provider history. Unrecognized swaps may remain classified as transfers.'}</Alert>
      <Alert severity={flagged.length?'warning':'info'} sx={{mb:2}}>
        {flagged.length ? `${flagged.length} swap transaction(s) equaled at least 10% of the governance position.` : unknown.length ? 'Some swaps cannot be assessed because their governance position could not be established.' : 'No swaps of 10% or more found in the loaded activity.'}
        {' '}Each swap is compared with community tokens deposited in this DAO. A withdrawal retains the position from before that withdrawal until a later deposit or revocation updates it. Wallet balances and transfers do not set the threshold.
        {unknown.length>0 && ` ${unknown.length} swap(s) have an unavailable percentage.`}
      </Alert>
      <Typography variant="h6" sx={{mt:2,mb:1}}>Outgoing activity {next?'· partial totals':''}</Typography>
      <Stack direction={{xs:'column',md:'row'}} spacing={1.5}>
        <Metric label="Swapped out" value={sum(events.filter(e=>e.type==='swap').map(e=>e.amount))} detail="Community tokens exchanged in confirmed swaps"/>
        <Metric label="Transferred out" value={sum(events.filter(e=>e.type==='transfer').map(e=>e.amount))} detail="Other outgoing tokens · not confirmed sales"/>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{my:2}}>A highlight means the swap was at least 10% of the governance position used for review; it does not prove which tokens were sold. Transfers alone are not flagged.</Typography>
      <Stack direction="row" spacing={1} sx={{mb:2}}>{[['all','All activity'],['swap','Swaps'],['transfer','Transfers'],['flagged','Swaps ≥10%']].map(([value,label])=><Chip key={value} label={label} clickable color={filter===value?'primary':'default'} variant={filter===value?'filled':'outlined'} aria-pressed={filter===value} onClick={()=>setFilter(value)}/>)}</Stack>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Activity</TableCell><TableCell align="right">Community tokens</TableCell><TableCell align="right">Governance position used</TableCell><TableCell align="right">% of governance position</TableCell><TableCell>Transaction</TableCell></TableRow></TableHead><TableBody>
        {visibleEvents.map(e=><TableRow key={`${e.signature}:${e.type}`} sx={e.thresholdExceeded?{backgroundColor:'rgba(255,167,38,0.10)'}:undefined}><TableCell>{new Date(e.timestamp*1000).toLocaleString()}</TableCell><TableCell>{e.type==='swap'?'Swap':'Transfer'}</TableCell><TableCell align="right">{new BigNumber(e.amount).toFormat()}</TableCell><TableCell align="right">{e.type==='swap'?(e.governanceBasis?<><Typography variant="body2">{new BigNumber(e.governanceBasis).toFormat()}</Typography>{e.basisSignature && txLink(e.basisSignature)}</>:'Unavailable'):'—'}</TableCell><TableCell align="right">{e.type==='swap'?(e.swapPercent!=null?<Chip size="small" color={e.thresholdExceeded?'warning':'default'} label={`${new BigNumber(e.swapPercent).toFormat(2,BigNumber.ROUND_DOWN)}%${e.thresholdExceeded?' · ≥10%':''}`}/>:'Unavailable'):'—'}</TableCell><TableCell>{txLink(e.signature)}</TableCell></TableRow>)}
        {!visibleEvents.length && <TableRow><TableCell colSpan={6}>No matching activity in the loaded history.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </>}
    {(next || error) && <Button disabled={busy} onClick={()=>load(next||undefined)}>{error?'Retry':'Load older activity'}</Button>}
  </Box>;
}

export default function GrantTrackingView({mint,realm,wallets,grantors=[]}:{mint:string;realm:string;wallets:string[];grantors?:string[]}) {
  const [assessments,setAssessments]=React.useState<Record<string,string>>({});
  const [source,setSource]=React.useState(grantors[0] || '');
  const [active,setActive]=React.useState('');
  const [grants,setGrants]=React.useState<Grant[]>([]);
  const [next,setNext]=React.useState<string|null>(null);
  const [loaded,setLoaded]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [selected,setSelected]=React.useState('');
  const [scanned,setScanned]=React.useState(0);
  const [oldest,setOldest]=React.useState<number|null>(null);
  const load=async(older=false)=>{
    const wallet=older?active:source.trim();
    try {new PublicKey(wallet);} catch {setError('Enter a valid distribution wallet address.');return;}
    setBusy(true);setError('');
    if(!older){setGrants([]);setSelected('');setNext(null);setLoaded(false);setScanned(0);setActive(wallet);}
    try {
      const data=await request({mode:'payments',wallet,mint,...(older&&next?{before:next}:{})});
      setGrants(previous=>Array.from(new Map([...(older?previous:[]),...data.rows].map((p:Grant)=>[p.id,p])).values()));
      setNext(data.next);setScanned(n=>(older?n:0)+data.scanned);setOldest(data.oldest);setLoaded(true);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const recipients=Array.from(new Set(grants.map(p=>p.recipient)));
  const recipientGrants=grants.filter(p=>p.recipient===selected);
  const assessmentKey=JSON.stringify([active,selected,mint,grants.filter(g=>g.recipient===selected).map(g=>g.id)]);
  const recordAssessment=React.useCallback((status:string)=>setAssessments(previous=>previous[assessmentKey]===status?previous:{...previous,[assessmentKey]:status}),[assessmentKey]);
  const since=recipientGrants.length?Math.min(...recipientGrants.map(p=>p.timestamp)):0;
  return <Accordion sx={{my:2,background:'rgba(255,255,255,0.03)'}}>
    <AccordionSummary expandIcon={<ExpandMoreIcon/>}><Typography variant="h6">Grant tracking</Typography></AccordionSummary>
    <AccordionDetails>
      <Typography sx={{mb:2}}>Choose the wallet that issued the grants, then select a recipient to review their tokens and activity.</Typography>
      <Box component="details" sx={{mb:2}}><Typography component="summary" sx={{cursor:'pointer'}}>How grant tracking works</Typography><Typography variant="body2" color="text.secondary" sx={{mt:1}}>Direct grants deliver tokens to a member’s wallet. Governance power grants deposit tokens into governance for the member. Later swaps may include previously owned tokens; transfers alone are not sales.</Typography></Box>
      <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
        <Autocomplete freeSolo fullWidth options={Array.from(new Set([...grantors,...wallets]))} inputValue={source} disabled={busy}
          onInputChange={(_,value)=>setSource(value)}
          renderOption={(props,wallet)=><li {...props}><Box><Typography variant="body2">{grantors.includes(wallet)?'Grantor':'Treasury'}</Typography><Typography variant="caption" sx={{overflowWrap:'anywhere'}}>{wallet}</Typography></Box></li>}
          renderInput={params=><TextField {...params} label="Grantor wallet" helperText="Select a known wallet or paste an address"/>}/>
        <Button sx={{minWidth:140,alignSelf:'flex-start',minHeight:56}} variant="contained" disabled={busy||!mint||!source.trim()} onClick={()=>load()}>Find grants</Button>
      </Stack>
      {busy && <LinearProgress sx={{my:2}}/>}{error && <Alert severity="error">{error}</Alert>}
      {loaded && !selected && <>
        <Typography variant="body2" sx={{my:2}}>{scanned} transactions scanned for {short(active)}{oldest?` back to ${new Date(oldest*1000).toLocaleString()}`:''}. {next?'Partial grant history—load older grants to extend coverage.':'Reached the end of provider history.'}</Typography>
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Recipient wallet</TableCell><TableCell align="right">Grants found</TableCell><TableCell align="right">Total tokens granted</TableCell><TableCell align="right">Granted to wallet</TableCell><TableCell align="right">Granted into governance</TableCell><TableCell>Swap review</TableCell><TableCell>Inspect</TableCell></TableRow></TableHead><TableBody>
          {recipients.map(wallet=>{const rows=grants.filter(p=>p.recipient===wallet);return <TableRow key={wallet} hover><TableCell><Link href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noopener noreferrer" title={wallet}>{short(wallet)}</Link></TableCell><TableCell align="right">{rows.length}</TableCell><TableCell align="right">{sum(rows.map(p=>p.amount))}</TableCell><TableCell align="right">{sum(rows.filter(p=>p.kind!=='governance deposit').map(p=>p.amount))}</TableCell><TableCell align="right">{sum(rows.filter(p=>p.kind==='governance deposit').map(p=>p.amount))}</TableCell><TableCell>{(()=>{const status=assessments[JSON.stringify([active,wallet,mint,rows.map(g=>g.id)])];return <Chip size="small" color={status==='Swap ≥10% found'?'warning':'default'} label={status||'Not scanned'}/>;})()}</TableCell><TableCell><Button onClick={()=>setSelected(wallet)}>View activity</Button></TableCell></TableRow>;})}
          {!recipients.length && <TableRow><TableCell colSpan={7}>No community-token grants found in the loaded history.</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        {next && <Button disabled={busy} onClick={()=>load(true)}>Load older grants</Button>}
      </>}
      {selected && <RecipientActivity key={`${active}:${selected}:${since}:${mint}`} wallet={selected} mint={mint} realm={realm} since={since} grants={recipientGrants} onAssessment={recordAssessment} onClose={()=>setSelected('')}/>}
    </AccordionDetails>
  </Accordion>;
}
