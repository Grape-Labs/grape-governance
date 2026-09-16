import BigNumber from 'bignumber.js';
export function grantQualification(grants,wallet,staked,loaded,partial,threshold){
 if(staked==null)return 'Position unavailable';
 if(!loaded)return 'Load grant history';
 const total=grants.filter(g=>g.recipient===wallet).reduce((n,g)=>n.plus(g.amount),new BigNumber(0));
 const position=new BigNumber(staked);
 if(!position.isFinite()||position.lt(0))return 'Position unavailable';
 if(!total.gt(0))return partial?'Incomplete history':'No prior grants';
 const shortfall=total.minus(position).dividedBy(total).times(100);
 if(shortfall.gt(0)&&shortfall.gte(threshold))return 'Below retention requirement';
 return partial?'Within threshold · partial history':'Meets retention requirement';
}
