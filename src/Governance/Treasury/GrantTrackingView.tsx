import React from 'react';
import BigNumber from 'bignumber.js';
import { PublicKey } from '@solana/web3.js';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Box, Button, LinearProgress, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

type Payment = {id:string;signature:string;timestamp:number;recipient:string;amount:string;kind?:string};
type Event = {signature:string;timestamp:number;type:string;amount:string};
const short = (s:string) => `${s.slice(0,6)}…${s.slice(-6)}`;
const sum = (values:string[]) => values.reduce((n,v)=>n.plus(v),new BigNumber(0)).toFormat();
const txLink = (signature:string) => <Link href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener noreferrer">{short(signature)}</Link>;
async function request(params:Record<string,string>) {
  const response=await fetch(`/api/grant-tracking?${new URLSearchParams(params)}`);
  const data=await response.json();
  if(!response.ok) throw new Error(data.error || 'Unable to load tracking data.');
  return data;
}

function RecipientActivity({wallet,mint,since}:{wallet:string;mint:string;since:number}) {
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
    load();
    request({mode:'balance',wallet,mint}).then(data=>setBalance(data.balance)).catch(()=>setBalanceError(true));
  },[]);
  return <Box sx={{mt:3,p:2,border:'1px solid rgba(255,255,255,0.15)',borderRadius:2}}>
    <Typography variant="h6">Recipient activity · {short(wallet)}</Typography>
    <Link href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noopener noreferrer">View wallet</Link>
    <Typography variant="body2" sx={{my:1}}>Tracking from the earliest loaded payment: {new Date(since*1000).toLocaleString()}.</Typography>
    <Typography variant="body2">Current wallet balance: {balance!==null?new BigNumber(balance).toFormat():balanceError?'Unavailable':'Loading…'} community tokens. Staked, escrowed, and other-wallet holdings are excluded.</Typography>
    {busy && <LinearProgress sx={{my:2}}/>}
    {error && <Alert severity="error">{error}</Alert>}
    {loaded && <>
      <Alert severity={next?'info':'success'} sx={{my:2}}>{next?`Partial history: loaded back to ${oldest?new Date(oldest*1000).toLocaleString():'an unknown date'}. Load older activity before treating totals as complete.`:'Reached the tracking date or the end of provider history. Unrecognized swaps may remain classified as transfers.'}</Alert>
      <Typography>Confirmed swaps out: {sum(events.filter(e=>e.type==='swap').map(e=>e.amount))} · Other outgoing transfers: {sum(events.filter(e=>e.type==='transfer').map(e=>e.amount))}</Typography>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Activity</TableCell><TableCell align="right">Community tokens</TableCell><TableCell>Transaction</TableCell></TableRow></TableHead><TableBody>
        {events.map(e=><TableRow key={`${e.signature}:${e.type}`}><TableCell>{new Date(e.timestamp*1000).toLocaleString()}</TableCell><TableCell>{e.type==='swap'?'Confirmed swap out':'Other outgoing transfer'}</TableCell><TableCell align="right">{new BigNumber(e.amount).toFormat()}</TableCell><TableCell>{txLink(e.signature)}</TableCell></TableRow>)}
        {!events.length && <TableRow><TableCell colSpan={4}>No outgoing activity found in the loaded history.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </>}
    {(next || error) && <Button disabled={busy} onClick={()=>load(next||undefined)}>{error?'Retry':'Load older activity'}</Button>}
  </Box>;
}

export default function GrantTrackingView({mint,wallets,grantors=[]}:{mint:string;wallets:string[];grantors?:string[]}) {
  const [source,setSource]=React.useState(grantors[0] || '');
  const [active,setActive]=React.useState('');
  const [payments,setPayments]=React.useState<Payment[]>([]);
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
    if(!older){setPayments([]);setSelected('');setNext(null);setLoaded(false);setScanned(0);setActive(wallet);}
    try {
      const data=await request({mode:'payments',wallet,mint,...(older&&next?{before:next}:{})});
      setPayments(previous=>Array.from(new Map([...(older?previous:[]),...data.rows].map((p:Payment)=>[p.id,p])).values()));
      setNext(data.next);setScanned(n=>(older?n:0)+data.scanned);setOldest(data.oldest);setLoaded(true);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const recipients=Array.from(new Set(payments.map(p=>p.recipient)));
  const recipientPayments=payments.filter(p=>p.recipient===selected);
  const since=recipientPayments.length?Math.min(...recipientPayments.map(p=>p.timestamp)):0;
  return <Accordion sx={{my:2,background:'rgba(255,255,255,0.03)'}}>
    <AccordionSummary expandIcon={<ExpandMoreIcon/>}><Typography variant="h6">Grant tracking</Typography></AccordionSummary>
    <AccordionDetails>
      <Typography sx={{mb:2}}>Select a wallet used for community-token distributions. Review recipients and inspect swaps after their payments.</Typography>
      <Alert severity="info" sx={{mb:2}}>Payments are not automatically verified grants. Confirm their purpose against governance proposals. Tokens mix with existing holdings: a later swap does not prove the granted tokens were sold. Transfers alone are not sales.</Alert>
      <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
        <TextField fullWidth label="Distribution wallet" value={source} disabled={busy} onChange={e=>setSource(e.target.value)} />
        <Button variant="contained" disabled={busy||!mint||!source.trim()} onClick={()=>load()}>Find payments</Button>
      </Stack>
      <Box sx={{my:1}}>{grantors.map(wallet=><Button key={wallet} size="small" disabled={busy} onClick={()=>setSource(wallet)}>Grantor {short(wallet)}</Button>)}{wallets.filter(wallet=>!grantors.includes(wallet)).map(wallet=><Button key={wallet} size="small" disabled={busy} onClick={()=>setSource(wallet)}>Treasury {short(wallet)}</Button>)}</Box>
      {busy && <LinearProgress sx={{my:2}}/>}{error && <Alert severity="error">{error}</Alert>}
      {loaded && <>
        <Typography variant="body2" sx={{my:2}}>{scanned} transactions scanned for {short(active)}{oldest?` back to ${new Date(oldest*1000).toLocaleString()}`:''}. {next?'Partial payment history—load older payments to extend coverage.':'Reached the end of provider history.'}</Typography>
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Recipient wallet</TableCell><TableCell align="right">Payments found</TableCell><TableCell align="right">Community tokens received</TableCell><TableCell>Inspect</TableCell></TableRow></TableHead><TableBody>
          {recipients.map(wallet=>{const rows=payments.filter(p=>p.recipient===wallet);return <TableRow key={wallet}><TableCell>{short(wallet)}</TableCell><TableCell align="right">{rows.length}</TableCell><TableCell align="right">{sum(rows.map(p=>p.amount))}</TableCell><TableCell><Button onClick={()=>setSelected(wallet)}>Activity</Button></TableCell></TableRow>;})}
          {!recipients.length && <TableRow><TableCell colSpan={4}>No community-token payments found in the loaded history.</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        {next && <Button disabled={busy} onClick={()=>load(true)}>Load older payments</Button>}
      </>}
      {selected && <>
        <Typography sx={{mt:2}}>Payments to {short(selected)}:</Typography>
        {recipientPayments.map(p=><Typography variant="body2" key={p.id}>{new Date(p.timestamp*1000).toLocaleString()} · {new BigNumber(p.amount).toFormat()} · {p.kind} · {txLink(p.signature)}</Typography>)}
        <RecipientActivity key={`${active}:${selected}:${since}:${mint}`} wallet={selected} mint={mint} since={since}/>
      </>}
    </AccordionDetails>
  </Accordion>;
}
