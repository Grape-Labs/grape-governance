// Public on-chain data: coalesce requests in an instance and share through the CDN.
export function cacheGrantResponses(handler, {now=Date.now, maxEntries=500}={}) {
  const entries=new Map();
  return async (req,res)=>{
    if(req.method!=='GET')return handler(req,res);
    const query=req.query||{};
    const key=JSON.stringify(Object.keys(query).sort().map(key=>[key,query[key]]));
    let entry=entries.get(key);
    if(!entry || entry.expires<=now()) {
      entry={expires:Infinity};
      entry.promise=(async()=>{
        let status=200;
        const headers={};
        let body;
        await handler(req,{setHeader(name,value){headers[name]=value;},status(code){status=code;return this;},json(value){body=value;return this;}});
        const ttl=query.mode==='balance'?30:query.before?86400:300;
        if(status===200){
          headers['Cache-Control']=`public, max-age=30, s-maxage=${ttl}`;
          entry.expires=now()+ttl*1000;
        }else{
          headers['Cache-Control']='no-store';
          entries.delete(key);
        }
        return {status,headers,body};
      })().catch(error=>{entries.delete(key);throw error;});
      entries.set(key,entry);
      if(entries.size>maxEntries)entries.delete(entries.keys().next().value);
    }
    const result=await entry.promise;
    for(const [name,value] of Object.entries(result.headers))res.setHeader?.(name,value);
    return res.status(result.status).json(result.body);
  };
}
