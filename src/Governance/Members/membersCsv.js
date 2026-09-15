import BigNumber from 'bignumber.js';
const escape=value=>`"${String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')}"`;
export function membersCsv(rows,{grants,loaded,grantor,partial,threshold}) {
  const totals=new Map();
  for(const grant of grants){
    const previous=totals.get(grant.recipient)||{amount:new BigNumber(0),count:0};
    totals.set(grant.recipient,{amount:previous.amount.plus(grant.amount),count:previous.count+1});
  }
  const header=['Member','Delegate','Governance record','Votes staked','Granted tokens','Grant count','Voting power','Legacy deposit','Locked tokens','Withdrawable tokens','Wallet balance','Council votes','% of deposited governance','% of supply','Grant shortfall tokens','Grant shortfall %','Warning','Warning threshold %','Grantor','Grant coverage'];
  return '\uFEFF'+[header,...rows.map(row=>{
    const total=totals.get(row.address)||{amount:new BigNumber(0),count:0};
    const staked=row.staked?.depositedAmountExact??row.staked?.depositedAmount;
    const difference=total.amount.minus(staked);
    const valid=loaded&&total.amount.gt(0)&&difference.isFinite();
    const shortfall=valid?BigNumber.maximum(0,difference):null;
    const percent=shortfall?.dividedBy(total.amount).times(100);
    return [row.address,row.delegate,row.record,staked,loaded?total.amount.toFixed():'',loaded?total.count:'',row.votingPower?.votingPower,row.legacyDeposit?.legacyDepositAmount,row.locked?.lockedAmount,row.withdrawable?.withdrawableAmount,row.unstaked,row.member?.governingCouncilDepositAmount,row.percentDepositedGovernance,row.percentSupply,shortfall?.toFixed(),percent?.toFixed(2),percent?percent.gte(threshold)?'Below grant threshold':'':'',threshold,grantor,loaded?partial?'Partial loaded history':'Loaded provider history':'Not loaded'];
  })].map(row=>row.map(escape).join(',')).join('\r\n');
}
export function downloadMembersCsv(csv,realm){
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');
  link.href=url;link.download=`members-${realm}.csv`;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
