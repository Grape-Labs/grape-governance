import { membersCsv, downloadMembersCsv } from './membersCsv';
import React from 'react';
import BigNumber from 'bignumber.js';
import { votingPowerDrop, governancePositionDrop, governanceReductionHistory, governanceGrantsSincePeak, netTransferEvents } from './reviewSummary';
import { assessGovernanceSwaps, reconstructGovernanceTimeline } from '../../server/grants/swap-threshold';
import { PublicKey } from '@solana/web3.js';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Autocomplete, Box, Button, Chip, Dialog, DialogContent, Tooltip, LinearProgress, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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
function RecipientActivity({wallet,mint,realm,since,grants,onClose,onAssessment,threshold,grantsLoaded,grantorWallets}:{grantorWallets:string[];grantsLoaded:boolean;threshold:number;wallet:string;mint:string;realm:string;since:number;grants:Grant[];onClose:()=>void;onAssessment:(status:string)=>void}) {
  const alive=React.useRef(true);
  const [trackingSince,setTrackingSince]=React.useState(since);
  const [referenceRecord,setReferenceRecord]=React.useState('');
  const [positionScanned,setPositionScanned]=React.useState(0);
  const [votes,setVotes]=React.useState<any[]>([]);
  const [activityScanned,setActivityScanned]=React.useState(0);
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
      for(let page=0;page<20;page++){
        const data=await request({mode:'governance',wallet,mint,realm,...(cursor?{before:cursor,positionSlot:String(anchor.slot),decimals:String(anchor.decimals)}:{})});
        if(!alive.current) return;
        setPositionScanned(n=>n+(data.scanned||0));
        if(!anchor) anchor=data.snapshot;
        setVotes(previous=>Array.from(new Map([...(data.votes||[]),...previous].map(v=>[v.record,v])).values()));
        changes=Array.from(new Map([...changes,...data.changes].map(c=>[c.id,c])).values());
        if(data.next && data.next===cursor) throw new Error('Governance history did not advance. Please retry.');
        cursor=data.next;
        setPositionChanges(changes);setPositionSnapshot(anchor);setPositionNext(cursor);
        if(!cursor){setPositionComplete(true);break;}
      }
    }catch(e){if(alive.current)setPositionError(e.message);}
    finally{if(alive.current)setPositionBusy(false);}
  };
  const [filter,setFilter]=React.useState('swap');
  const [events,setEvents]=React.useState<Event[]>([]);
  const [next,setNext]=React.useState<string|null>(null);
  const [loaded,setLoaded]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [balance,setBalance]=React.useState<string|null>(null);
  const [balanceError,setBalanceError]=React.useState(false);
  const [oldest,setOldest]=React.useState<number|null>(null);
  const load=async(before?:string,pages=1)=>{
    setBusy(true);setError('');
    try {
      let cursor=before;
      for(let page=0;page<pages;page++){
        const data=await request({mode:'recipient',wallet,mint,since:String(trackingSince),...(cursor?{before:cursor}:{})});
        if(!alive.current)return;
        if(data.next && data.next===cursor)throw new Error('Activity history did not advance. Please retry.');
        setEvents(previous=>Array.from(new Map([...previous,...data.rows].map((e:Event)=>[`${e.signature}:${e.type}`,e])).values()));
        setActivityScanned(n=>n+(data.scanned||0));
        setNext(data.next);setOldest(data.oldest);setLoaded(true);
        cursor=data.next;
        if(!cursor)break;
      }
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  };
  React.useEffect(()=>{
    alive.current=true;
    loadPosition();
    request({mode:'balance',wallet,mint}).then(data=>setBalance(data.balance)).catch(()=>setBalanceError(true));
    return ()=>{alive.current=false;};
  },[]);
  React.useEffect(()=>{
    setEvents([]);setNext(null);setOldest(null);setLoaded(false);setActivityScanned(0);
    void load();
  },[trackingSince]);
  const assessedEvents=React.useMemo(()=>assessGovernanceSwaps(events,positionChanges,positionSnapshot,positionComplete,threshold),[events,positionChanges,positionSnapshot,positionComplete,threshold]);
  const swaps=assessedEvents.filter(e=>e.type==='swap');
  const flagged=swaps.filter(e=>e.thresholdExceeded===true);
  const unknown=swaps.filter(e=>e.thresholdExceeded==null);
  const transfers=events.filter(e=>e.type==='transfer');
  const incoming=events.filter(e=>e.type==='incoming');
  const assessment=[
    flagged.length?`Swap ≥${threshold}% found`:swaps.length?'Swaps found':'',
    transfers.length?'Transfers found':'',
    unknown.length?'Governance basis unavailable':'',
    !positionComplete||next?'Partial scan':'',
  ].filter(Boolean).join(' · ')||'No outgoing activity found';
  const history=React.useMemo(()=>reconstructGovernanceTimeline(positionChanges,positionSnapshot,positionComplete),[positionChanges,positionSnapshot,positionComplete]);
  const recentVotes=[...votes].sort((a,b)=>b.slot-a.slot).slice(0,10);
  const periodGrants=governanceGrantsSincePeak(history,positionSnapshot?.position,grantorWallets,wallet);
  const reductions=governanceReductionHistory(history,positionSnapshot?.position);
  const peakDrop=governancePositionDrop(history,positionSnapshot?.position);
  const drop=referenceRecord ? votingPowerDrop(recentVotes,positionSnapshot?.position,referenceRecord==='votes'?undefined:referenceRecord) : peakDrop||votingPowerDrop(recentVotes,positionSnapshot?.position);
  const governanceReference=drop?.reference?.source==='governance';
  const movementEvents=netTransferEvents(assessedEvents);
  const reviewAssessment=[drop && new BigNumber(drop.difference).gt(0)?`Position down ${new BigNumber(drop.percent).toFormat(2)}%`:'',assessment].filter(Boolean).join(' · ');
  React.useEffect(()=>{if(loaded) onAssessment(reviewAssessment);},[loaded,reviewAssessment,onAssessment]);
  const visibleEvents=movementEvents.filter(e=>filter==='all'||(filter==='flagged'?e.thresholdExceeded===true:e.type===filter)).sort((a,b)=>b.timestamp-a.timestamp);
  return <Box sx={{mt:3,p:2,border:'1px solid rgba(255,255,255,0.15)',borderRadius:2}}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h6">Wallet activity</Typography>
      <Button onClick={onClose}>Close activity</Button>
    </Stack>
    <Link sx={{display:'block',overflowWrap:'anywhere',mb:1}} href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noopener noreferrer">{wallet}</Link>
    <TextField select size="small" label="Activity period" value={trackingSince} disabled={busy} SelectProps={{native:true}} sx={{my:2,minWidth:240}} onChange={e=>setTrackingSince(Number(e.target.value))}>
      <option value={since}>{grants.length?'Since earliest loaded grant':'Last 90 days'}</option>
      <option value={1}>Full available history</option>
    </TextField>
    <Typography variant="caption" display="block" sx={{mb:2}}>Scan coverage: {oldest?new Date(oldest*1000).toLocaleDateString():'not loaded'} to the latest loaded activity. {next?'More history available.':''}</Typography>
    <Box sx={{p:2,mb:2,borderRadius:2,border:drop && new BigNumber(drop.difference).gt(0)?'1px solid rgba(255,167,38,0.65)':'1px solid rgba(255,255,255,0.15)',backgroundColor:drop && new BigNumber(drop.difference).gt(0)?'rgba(255,167,38,0.06)':undefined}}>
      <Typography variant="h6">Change in governance position</Typography>
      <Typography variant="body2" color="text.secondary" sx={{mb:2}}>Compare the current DAO deposit with its highest verified historical position or a recorded vote. A decrease is not automatically a sale.</Typography>
      {drop ? <>
        <Stack direction={{xs:'column',md:'row'}} spacing={1.5}>
          <Metric label={governanceReference?"Highest verified governance position":"Previously recorded voting power"} value={new BigNumber(drop.reference.weight).toFormat()} detail={new Date(drop.reference.timestamp*1000).toLocaleDateString()}/>
          <Metric label="Current governance position" value={new BigNumber(drop.current).toFormat()} detail="Community tokens deposited now"/>
          <Metric label={new BigNumber(drop.difference).gte(0)?'Position decrease':'Position increase'} value={new BigNumber(drop.difference).abs().toFormat()} detail={`${new BigNumber(drop.percent).abs().toFormat(2)}% of the selected reference`}/>
        </Stack>
        <Alert severity={new BigNumber(drop.difference).gt(0)?"warning":"info"} sx={{mt:2,fontSize:18,fontWeight:600}}>{new BigNumber(drop.difference).gt(0)?`Down ${new BigNumber(drop.difference).toFormat()} tokens (${new BigNumber(drop.percent).toFormat(2)}%). ${new BigNumber(drop.percent).gte(threshold)?'At or above':'Below'} the ${threshold}% review threshold.`:'No decrease against this reference.'}</Alert>
        <TextField select fullWidth size="small" label="Comparison reference" InputLabelProps={{shrink:true}} value={referenceRecord} SelectProps={{native:true}} sx={{mt:2}} onChange={e=>setReferenceRecord(e.target.value)}>
          <option value="">{peakDrop?"Highest verified governance position":"Highest loaded vote (governance scan pending)"}</option>
          <option value="votes">Highest voting power in the latest 10 loaded votes</option>
          {recentVotes.filter(v=>v.weight!=null).map(v=><option key={v.record} value={v.record}>{new Date(v.timestamp*1000).toLocaleDateString()} · {new BigNumber(v.weight).toFormat()} · {v.name||short(v.proposal)}</option>)}
        </TextField>
        {governanceReference?<Box sx={{mt:1}}>Peak position recorded {new Date(drop.reference.timestamp*1000).toLocaleDateString()} · {txLink(drop.reference.signature)}</Box>:<Link href={`/proposal/${realm}/${drop.reference.proposal}`} target="_blank" rel="noopener noreferrer">View reference proposal</Link>}
      </> : <Typography>{positionBusy?'Loading governance position and recorded votes…':'A current position and an earlier recorded vote are needed for this comparison.'}</Typography>}
      <Typography variant="caption" color="text.secondary" display="block" sx={{mt:1}}>The governance peak uses completed transactions in reconciled history. Until that scan completes, the reference uses loaded votes. A position decline is separate from the per-swap threshold; it remains highlighted even below that threshold.</Typography>
    </Box>
    {reductions && new BigNumber(reductions.cumulative).gt(0) && <Box sx={{p:2,mb:2,borderRadius:2,border:'1px solid rgba(255,167,38,0.65)',background:'rgba(255,167,38,0.06)'}}>
      <Typography variant="h6">Earlier reductions, before later deposits</Typography>
      <Stack direction={{xs:'column',md:'row'}} spacing={1.5} sx={{my:2}}>
        <Metric label="Largest decline from peak at daily close" value={new BigNumber(reductions.drawdown).toFormat()} detail={`${new BigNumber(reductions.drawdownPercent).toFormat(2)}% · lowest daily closing position: ${new BigNumber(reductions.lowest).toFormat()}`}/>
        <Metric label="Cumulative daily decreases" value={new BigNumber(reductions.cumulative).toFormat()} detail={`${new BigNumber(reductions.cumulativePercent).toFormat(2)}% of the verified peak`}/>
      </Stack>
      <Alert severity="warning">Later deposits reduce the current net decline but do not erase earlier reductions. Cumulative decreases add separate downward movements; they are not tokens currently missing or proof of sales.</Alert>
      <Typography variant="caption" display="block" sx={{my:1}}>Based on UTC daily closing governance positions since the verified peak. Withdrawals and redeposits within the same day are netted. Repeated reductions of restored tokens may be counted more than once.</Typography>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date (UTC)</TableCell><TableCell align="right">Before</TableCell><TableCell align="right">After</TableCell><TableCell align="right">Reduction</TableCell><TableCell>Evidence</TableCell></TableRow></TableHead><TableBody>
        {reductions.reductions.map(r=><TableRow key={r.date}><TableCell>{r.date}</TableCell><TableCell align="right">{new BigNumber(r.before).toFormat()}</TableCell><TableCell align="right">{new BigNumber(r.after).toFormat()}</TableCell><TableCell align="right">{new BigNumber(r.amount).toFormat()}</TableCell><TableCell>{txLink(r.signature)}</TableCell></TableRow>)}
      </TableBody></Table></TableContainer>
    </Box>}
    <Box sx={{p:2,mb:2,borderRadius:2,border:'1px solid rgba(255,255,255,0.15)'}}>
      <Typography variant="h6">Governance power granted during this period</Typography>
      {periodGrants ? <>
        <Typography variant="body2" color="text.secondary" sx={{my:1}}>After the peak recorded {new Date(periodGrants.reference.timestamp*1000).toLocaleDateString()} through the current governance snapshot. The grant that established the peak is already included in the starting position.</Typography>
        <Stack direction={{xs:'column',md:'row'}} spacing={1.5}>
          <Metric label="Governance tokens granted" value={new BigNumber(periodGrants.amount).toFormat()} detail={`${periodGrants.grants.length} deposits issued by identified grantors`}/>
          <Metric label="Other governance deposits" value={new BigNumber(periodGrants.otherDeposits).toFormat()} detail="Includes redeposits and deposits not attributed to identified grantors"/>
        </Stack>
        <Typography variant="caption" display="block" sx={{mt:1}}>Grant authorities: {periodGrants.grantors.map(short).join(', ')}. Counts direct-to-governance deposits only; wallet grants are separate. This identifies the issuing authority, not the authorizing proposal.</Typography>
        {periodGrants.unidentified>0 && <Typography variant="caption" display="block">{periodGrants.unidentified} deposits have no identified authority and are excluded from the grant total.</Typography>}
        <Box component="details" sx={{mt:2}}><Typography component="summary" sx={{cursor:'pointer'}}>Grant evidence · {periodGrants.grants.length}</Typography>
          <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Grant authority</TableCell><TableCell align="right">Governance tokens</TableCell><TableCell>Evidence</TableCell></TableRow></TableHead><TableBody>
            {periodGrants.grants.map(g=><TableRow key={g.id}><TableCell>{new Date(g.timestamp*1000).toLocaleDateString()}</TableCell><TableCell><Link href={`https://solscan.io/account/${g.grantAuthority}`} target="_blank" rel="noopener noreferrer">{short(g.grantAuthority)}</Link></TableCell><TableCell align="right">{new BigNumber(g.amount).toFormat()}</TableCell><TableCell>{txLink(g.signature)}</TableCell></TableRow>)}
            {!periodGrants.grants.length && <TableRow><TableCell colSpan={4}>No deposits from the identified grantors in this period.</TableCell></TableRow>}
          </TableBody></Table></TableContainer>
        </Box>
      </> : <Typography variant="body2" sx={{mt:1}}>{!history?'Finish the governance history scan to calculate grants over the same period.':'Select a grantor in Members to identify governance grants for this period.'}</Typography>}
    </Box>
    <Box component="details" sx={{mb:2}}><Typography component="summary" sx={{cursor:'pointer'}}>Grant history and liquid wallet balance</Typography>
    <Stack direction={{xs:'column',md:'row'}} spacing={1.5}>
      <Metric label="Tokens granted" value={grantsLoaded?sum(grants.map(g=>g.amount)):'Not loaded'} detail={grantsLoaded?`${grants.length} grants in loaded history`:'Load a grantor’s history in Members to review grants'}/>
      <Metric label="Current governance position" value={positionSnapshot?new BigNumber(positionSnapshot.position).toFormat():positionBusy?'Loading…':'Unavailable'} detail="Community tokens deposited in this DAO"/>
      <Metric label="Current wallet balance" value={balance!==null?new BigNumber(balance).toFormat():balanceError?'Unavailable':'Loading…'} detail="For reference only · not used for the swap threshold"/>
    </Stack>
    <Box component="details" sx={{my:2}}>
      <Typography component="summary" sx={{cursor:'pointer'}}>Grant breakdown · direct tokens and governance power</Typography>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Grant type</TableCell><TableCell align="right">Tokens granted</TableCell><TableCell>Transaction</TableCell></TableRow></TableHead><TableBody>
        {grants.map(g=><TableRow key={g.id}><TableCell>{new Date(g.timestamp*1000).toLocaleDateString()}</TableCell><TableCell>{g.kind==='governance deposit'?'Governance power':'Direct to wallet'}</TableCell><TableCell align="right">{new BigNumber(g.amount).toFormat()}</TableCell><TableCell>{txLink(g.signature)}</TableCell></TableRow>)}
      </TableBody></Table></TableContainer>
    </Box>
    </Box>
    {positionBusy && <Typography variant="body2" sx={{my:1}}>Checking governance history… {positionScanned.toLocaleString()} transactions scanned.</Typography>}
    {positionError && <Alert severity="info">{positionError}</Alert>}
    {!positionBusy && !positionComplete && <Button onClick={loadPosition}>{positionError?'Retry governance history':'Continue governance history scan'}</Button>}
    {busy && <LinearProgress sx={{my:2}}/>}
    {error && <Alert severity="error">{error}</Alert>}
    {loaded && <>
      <Box component="details"><Typography component="summary" sx={{cursor:'pointer',fontWeight:600}}>Swap and transfer review · {swaps.length} swaps</Typography>
      <Alert severity="info" sx={{my:2}}>{next?`Partial history: loaded back to ${oldest?new Date(oldest*1000).toLocaleString():'an unknown date'}. Load older activity before treating totals as complete.`:`Wallet activity scan reached its stopping point. Governance history is ${positionComplete?'loaded':'still incomplete'}; these are separate scans.`}</Alert>
      <Alert severity={flagged.length?'warning':'info'} sx={{mb:2}}>
        {flagged.length ? `${flagged.length} swap transaction(s) equaled at least ${threshold}% of the governance position.` : unknown.length ? 'Swap percentages are pending: governance history is incomplete or could not be reconciled.' : `No swaps of ${threshold}% or more found in the loaded activity.`}
        {' '}Each swap is compared with community tokens deposited in this DAO. A withdrawal retains the position from before that withdrawal until a later deposit or revocation updates it. Wallet balances and transfers do not set the threshold.
        {unknown.length>0 && ` ${unknown.length} swap(s) have an unavailable percentage.`}
      </Alert>
      <Typography variant="body2" color="text.secondary" sx={{mb:1}}>{activityScanned.toLocaleString()} wallet transactions scanned · {swaps.length} swaps · {transfers.length} outgoing transfers</Typography>
      <Typography variant="h6" sx={{mt:2,mb:1}}>Gross token movement {next?'· partial totals':''}</Typography>
      <Stack direction={{xs:'column',md:'row'}} spacing={1.5}>
        <Metric label="Swapped out" value={sum(events.filter(e=>e.type==='swap').map(e=>e.amount))} detail="Community tokens exchanged in confirmed swaps"/>
        <Metric label="Transferred out" value={sum(events.filter(e=>e.type==='transfer').map(e=>e.amount))} detail="Gross movements, including withdrawals/redeposits · not missing tokens"/>
        <Metric label="Transferred in" value={sum(incoming.map(e=>e.amount))} detail="Gross incoming movements · may include the same tokens returning"/>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{my:2}}>A highlight means the swap was at least {threshold}% of the governance position used for review; it does not prove which tokens were sold. Transfers are flagged separately for review, not classified as sales.</Typography>
      <Stack direction="row" spacing={1} sx={{mb:2}}>{[['all','All net activity'],['swap','Swaps'],['transfer','Transfers out'],['incoming','Transfers in'],['flagged',`Swaps ≥${threshold}%`]].map(([value,label])=><Chip key={value} label={label} clickable color={filter===value?'primary':'default'} variant={filter===value?'filled':'outlined'} aria-pressed={filter===value} onClick={()=>setFilter(value)}/>)}</Stack>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Activity</TableCell><TableCell align="right">Community tokens</TableCell><TableCell align="right">Governance position used</TableCell><TableCell align="right">% of governance position</TableCell><TableCell>Transaction</TableCell></TableRow></TableHead><TableBody>
        {visibleEvents.map(e=><TableRow key={`${e.signature}:${e.type}`} sx={e.thresholdExceeded?{backgroundColor:'rgba(255,167,38,0.10)'}:undefined}><TableCell>{new Date(e.timestamp*1000).toLocaleString()}</TableCell><TableCell>{e.type==='swap'?'Swap':e.type==='incoming'?'Net transfer in':e.type==='roundtrip'?'Transfer out and back':'Net transfer out'}{e.grossIncoming && <Typography variant="caption" display="block">In {new BigNumber(e.grossIncoming).toFormat()} · Out {new BigNumber(e.grossOutgoing).toFormat()}</Typography>}</TableCell><TableCell align="right">{new BigNumber(e.amount).toFormat()}</TableCell><TableCell align="right">{e.type==='swap'?(e.governanceBasis?<><Typography variant="body2">{new BigNumber(e.governanceBasis).toFormat()}</Typography>{e.basisSignature && txLink(e.basisSignature)}</>:'Unavailable'):'—'}</TableCell><TableCell align="right">{e.type==='swap'?(e.swapPercent!=null?<Chip size="small" color={e.thresholdExceeded?'warning':'default'} label={`${new BigNumber(e.swapPercent).toFormat(2,BigNumber.ROUND_DOWN)}%${e.thresholdExceeded?` · ≥${threshold}%`:''}`}/>:'Unavailable'):'—'}</TableCell><TableCell>{txLink(e.signature)}</TableCell></TableRow>)}
        {!visibleEvents.length && <TableRow><TableCell colSpan={6}>No matching activity in the loaded history.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
      </Box>
    </>}
    {next && <Button variant="outlined" disabled={busy} onClick={()=>load(next,5)}>Scan deeper · up to 500 transactions</Button>}
    {(next || error) && <Button disabled={busy} onClick={()=>load(next||undefined)}>{error?'Retry':'Load older activity'}</Button>}
    <Box component="details" sx={{mt:3}}>
      <Typography component="summary" sx={{cursor:'pointer',fontWeight:600}}>Governance position over time</Typography>
      {!history?<Typography sx={{my:1}}>Complete and reconcile governance history to view position changes.</Typography>:<>
        <Typography variant="body2" sx={{my:1}}>Native community-token deposits, withdrawals and revocations. These amounts are separate from voting power recorded on proposals.</Typography>
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Change</TableCell><TableCell align="right">Position after change</TableCell><TableCell>Evidence</TableCell></TableRow></TableHead><TableBody>
          {[...history].reverse().map(c=><TableRow key={c.id} sx={c.id===peakDrop?.reference.record?{backgroundColor:'rgba(255,167,38,0.12)'}:undefined}><TableCell>{c.timestamp?new Date(c.timestamp*1000).toLocaleDateString():'Unknown date'}</TableCell><TableCell>{c.kind}</TableCell><TableCell align="right">{new BigNumber(c.position).toFormat()}{c.id===peakDrop?.reference.record && <Typography variant="caption" display="block" color="warning.main">Highest verified position</Typography>}</TableCell><TableCell>{txLink(c.signature)}</TableCell></TableRow>)}
          {!history.length&&<TableRow><TableCell colSpan={4}>No governance changes found.</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      </>}
    </Box>
    <Box component="details" sx={{mt:3}}>
      <Typography component="summary" sx={{cursor:'pointer',fontWeight:600}}>Recent voting · {recentVotes.length} recorded votes</Typography>
      <Typography variant="body2" sx={{my:1}}>Latest 10 votes found in loaded governance history, including delegated votes. This is not a participation rate across all recent proposals. Missing or closed vote records remain unavailable.</Typography>

      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Proposal / choice</TableCell><TableCell align="right">Voting power used</TableCell><TableCell>Evidence</TableCell></TableRow></TableHead><TableBody>
        {recentVotes.map(v=><TableRow key={v.record}><TableCell>{v.timestamp?new Date(v.timestamp*1000).toLocaleDateString():'Unknown date'}</TableCell><TableCell><Link href={`/proposal/${realm}/${v.proposal}`} target="_blank" rel="noopener noreferrer">{v.name||short(v.proposal)}</Link><Typography variant="caption" display="block">{v.choice||'Choice unavailable'}{v.relinquished?' · Relinquished':''}</Typography></TableCell><TableCell align="right">{v.weight!=null?new BigNumber(v.weight).toFormat():'Unavailable'}</TableCell><TableCell>{txLink(v.signature)}</TableCell></TableRow>)}
        {!recentVotes.length&&<TableRow><TableCell colSpan={4}>{positionBusy?'Loading voting history…':'No recorded votes found in loaded history.'}</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </Box>
  </Box>;
}

export default function GrantTrackingView({mint,realm,loadWallets,grantors=[],children}:{children:(renderGrantCell:(wallet:string,staked?:string|number)=>React.ReactNode,exportMembers:(rows:any[])=>void)=>React.ReactNode;mint:string;realm:string;loadWallets:()=>Promise<string[]>;grantors?:string[]}) {
  const [defaultSince]=React.useState(()=>Math.floor(Date.now()/1000)-90*86400);
  const [thresholdInput,setThresholdInput]=React.useState('30');
  const enteredThreshold=Number(thresholdInput);
  const thresholdValid=Number.isFinite(enteredThreshold)&&enteredThreshold>0&&enteredThreshold<=100;
  const threshold=thresholdValid?enteredThreshold:30;
  const [wallets,setWallets]=React.useState<string[]>([]);
  const [walletsLoading,setWalletsLoading]=React.useState(false);
  const [walletsLoaded,setWalletsLoaded]=React.useState(false);
  const [walletsError,setWalletsError]=React.useState(false);
  const loadSuggestions=async()=>{
    if(walletsLoading||walletsLoaded)return;
    setWalletsLoading(true);setWalletsError(false);
    try {setWallets(await loadWallets());setWalletsLoaded(true);}
    catch {setWalletsError(true);}
    finally {setWalletsLoading(false);}
  };
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
  const renderGrantCell=(wallet:string,staked?:string|number)=>{
    const rows=grants.filter(g=>g.recipient===wallet);
    const status=assessments[JSON.stringify([active,wallet,mint,threshold,rows.map(g=>g.id)])];
    if(!loaded || !rows.length) return <Box sx={{textAlign:'right'}}>
      <Typography variant="caption" color="text.secondary">{!loaded?(busy?'Loading grants…':'Not loaded'):'None in loaded history'}</Typography>
      <Button size="small" color={status?.includes('Swap ≥')?'warning':'info'} title={status} onClick={event=>{event.stopPropagation();setSelected(wallet);}}>{status?'Activity reviewed · View':'Review activity'}</Button>
      {status && <Typography variant="caption" display="block" sx={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={status}>{status}</Typography>}
    </Box>;
    const granted=rows.reduce((total,grant)=>total.plus(grant.amount),new BigNumber(0));
    const deposited=new BigNumber(staked ?? NaN);
    const shortfall=granted.minus(deposited);
    const belowGrant=granted.isFinite() && granted.gt(0) && deposited.isFinite() && deposited.gte(0) && shortfall.gt(0);
    const percent=belowGrant?shortfall.dividedBy(granted).times(100):null;
    const warningExceeded=percent?.gte(threshold);
    const warning=percent?`${percent.lt(0.01)?'<0.01':percent.toFormat(2)}% less staked`:'';
    return <Tooltip title={`${belowGrant?`${warning}: ${shortfall.toFormat()} fewer tokens staked than the ${granted.toFormat()} granted. `:''}${status?`${status}. `:''}${rows.length} grants. Direct to wallet: ${sum(rows.filter(g=>g.kind!=='governance deposit').map(g=>g.amount))} · Into governance: ${sum(rows.filter(g=>g.kind==='governance deposit').map(g=>g.amount))}. Loaded grants only; these are not additional holdings.`}>
      <Button color={warningExceeded||status?.includes('Swap ≥')?'warning':status?.includes('Transfers found')||status?.includes('Swaps found')?'info':'inherit'} onClick={event=>{event.stopPropagation();setSelected(wallet);}} sx={{textTransform:'none',display:'block',textAlign:'right',width:'100%',backgroundColor:warningExceeded?'rgba(255,167,38,0.10)':undefined}} aria-label={`View grants and activity for ${wallet}`}>
        <Typography sx={{fontVariantNumeric:'tabular-nums'}}>{sum(rows.map(g=>g.amount))}</Typography>
        <Typography variant="caption" component="div" sx={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={status}>{belowGrant?<Box component="span" sx={{display:'inline-flex',alignItems:'center',gap:0.5,fontWeight:600}}>{warningExceeded && <WarningAmberIcon sx={{fontSize:16}}/>}{warning}</Box>:status||`${rows.length} grants · View activity`}</Typography>
      </Button>
    </Tooltip>;
  };
  const recipientGrants=grants.filter(p=>p.recipient===selected);
  const assessmentKey=JSON.stringify([active,selected,mint,threshold,grants.filter(g=>g.recipient===selected).map(g=>g.id)]);
  const recordAssessment=React.useCallback((status:string)=>setAssessments(previous=>previous[assessmentKey]===status?previous:{...previous,[assessmentKey]:status}),[assessmentKey]);
  const since=recipientGrants.length?Math.min(...recipientGrants.map(p=>p.timestamp)):defaultSince;
  return <><Accordion onChange={(_,expanded)=>{if(expanded)void loadSuggestions();}} sx={{my:2,background:'rgba(255,255,255,0.03)'}}>
    <AccordionSummary expandIcon={<ExpandMoreIcon/>}><Box><Typography variant="h6">Member grants</Typography><Typography variant="body2" color="text.secondary">Compare grants with tokens staked</Typography></Box></AccordionSummary>
    <AccordionDetails>
      <Typography variant="body2" color="text.secondary" sx={{mb:2}}>Select a grantor to add grant totals and staking shortfalls to the members table.</Typography>
      <Stack direction={{xs:'column',sm:'row'}} spacing={1.5}>
        <Autocomplete freeSolo fullWidth loading={walletsLoading} options={Array.from(new Set([...grantors,...wallets]))} inputValue={source} disabled={busy}
          onInputChange={(_,value)=>setSource(value)}
          renderOption={(props,wallet)=><li {...props}><Box><Typography variant="body2">{grantors.includes(wallet)?'Grantor':'Treasury'}</Typography><Typography variant="caption" sx={{overflowWrap:'anywhere'}}>{wallet}</Typography></Box></li>}
          renderInput={params=><TextField {...params} label="Grantor wallet" helperText="Select a known wallet or paste an address"/>}/>
        <Button sx={{minWidth:140,alignSelf:'flex-start',minHeight:56}} variant="contained" disabled={busy||!mint||!source.trim()} onClick={()=>load()}>{busy&&!loaded?'Loading grants…':loaded&&source.trim()===active?'Reload recent grants':'Load grants'}</Button>
      </Stack>
      {walletsError && <Alert severity="info" sx={{my:1}} action={<Button color="inherit" size="small" disabled={walletsLoading} onClick={loadSuggestions}>Retry</Button>}>Wallet suggestions could not be loaded. You can still paste a grantor address.</Alert>}
      {busy && <LinearProgress sx={{my:2}}/>}{error && <Alert severity="error">{error}</Alert>}
      {loaded && <Box role="status" sx={{mt:2,p:2,borderRadius:2,border:'1px solid rgba(255,255,255,0.12)',backgroundColor:'rgba(255,255,255,0.03)'}}>
        <Stack direction={{xs:'column',sm:'row'}} spacing={2} justifyContent="space-between" alignItems={{xs:'stretch',sm:'center'}}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{mb:0.5,flexWrap:'wrap'}}>
              <Typography variant="subtitle2">{grants.length.toLocaleString()} grants loaded</Typography>
              <Chip size="small" variant="outlined" color={next?'warning':'success'} label={next?'More history available':'History loaded'}/>
            </Stack>
            <Typography variant="body2" color="text.secondary">{oldest?'From '+new Date(oldest*1000).toLocaleDateString()+' · ':''}{scanned.toLocaleString()} transactions checked</Typography>
            <Typography variant="caption" color="text.secondary">Grantor {short(active)} · {next?'Totals cover loaded history only.':'Reached the end of available provider history.'}</Typography>
          </Box>
          {next && <Button variant="outlined" color="inherit" disabled={busy||source.trim()!==active} onClick={()=>load(true)} sx={{flexShrink:0,minHeight:40}}>{busy?'Loading history…':'Load more history'}</Button>}
        </Stack>
        {source.trim()!==active && <Typography variant="caption" color="warning.main" display="block" sx={{mt:1}}>Load grants to apply the new grantor. The table still shows {short(active)}.</Typography>}
        <Typography variant="caption" display="block" color="text.secondary" sx={{mt:1}}>Select a grant total in the table to view its transactions and wallet activity.</Typography>
      </Box>}
      <Box component="details" sx={{mt:2}}><Typography component="summary" variant="caption" color="text.secondary" sx={{cursor:'pointer'}}>About grant totals</Typography><Typography variant="body2" color="text.secondary" sx={{mt:1}}>Includes direct wallet grants and deposits into governance. Totals reflect the history loaded so far. Reloading recent grants starts a new scan. Recent results may be cached for 5 minutes; older history for 24 hours.</Typography></Box>
    </AccordionDetails>
  </Accordion>
  <Stack direction={{xs:'column',sm:'row'}} spacing={2} alignItems={{xs:'stretch',sm:'center'}} sx={{my:2,p:2,border:'1px solid rgba(255,255,255,0.12)',borderRadius:2}}>
    <TextField sx={{minWidth:210}} label="Warning threshold (%)" type="number" size="small" value={thresholdInput} error={!thresholdValid} helperText={thresholdValid?'Shortfall percentage · default 30%':'Enter a percentage greater than 0 and up to 100'} inputProps={{min:0.01,max:100,step:1}} onChange={e=>setThresholdInput(e.target.value)}/>
    <Box><Typography variant="body2">Warn when staked tokens are {Number((100-threshold).toFixed(2))}% or less of loaded grants.</Typography><Typography variant="caption" color="text.secondary">Also applies to individual swaps in activity reviews. Reopen previous reviews after changing this setting.</Typography></Box>
  </Stack>
  {children(renderGrantCell,rows=>downloadMembersCsv(membersCsv(rows,{grants,loaded,grantor:active,partial:!!next,threshold}),realm))}
  <Dialog open={!!selected} onClose={()=>setSelected('')} fullWidth maxWidth="lg">
    <DialogContent>
      {selected && <RecipientActivity key={`${active}:${selected}:${since}:${mint}`} wallet={selected} mint={mint} realm={realm} since={since} grants={recipientGrants} threshold={threshold} grantsLoaded={loaded} grantorWallets={Array.from(new Set([...grantors,...(active?[active]:[])]))} onAssessment={recordAssessment} onClose={()=>setSelected('')}/>}
    </DialogContent>
  </Dialog>
  </>;
}
