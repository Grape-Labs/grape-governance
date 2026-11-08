const {JSDOM, ResourceLoader, VirtualConsole} = require('jsdom');
const {TextEncoder, TextDecoder} = require('node:util');
const {webcrypto} = require('node:crypto');
const base = new URL(process.argv[2] || 'http://127.0.0.1:3100').origin;
const errors=[];
process.on('unhandledRejection', error => errors.push(error?.message || String(error)));
class LocalResources extends ResourceLoader {
  fetch(url, options) {return new URL(url).origin === base ? super.fetch(url,options) : null;}
}
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => {if(error.type==='unhandled-exception')errors.push(error.cause?.message || error.message);});
(async () => {
  const dom = await JSDOM.fromURL(base + '/directory', {
    runScripts:'dangerously',resources:new LocalResources(),virtualConsole,pretendToBeVisual:true,
    beforeParse(window) {
      Object.assign(window,{TextEncoder,TextDecoder,Buffer,Headers,Request,Response,AbortController,AbortSignal});
      window.fetch=async (url,init) => {
        const target=new URL(typeof url==='string'?url:url.url,window.location.href);
        return target.origin===base ? fetch(target,init) : Response.json({error:'Test network disabled'},{status:503});
      };
      window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      window.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
      window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};
      window.scrollTo=()=>{};window.URL.createObjectURL=()=> 'blob:test';window.URL.revokeObjectURL=()=>{};
      Object.defineProperty(window,'crypto',{value:webcrypto});
      window.XMLHttpRequest=class {
        open(){} setRequestHeader(){} getAllResponseHeaders(){return 'content-type: application/json';}
        send(){queueMicrotask(()=>{this.status=503;this.statusText='Unavailable';this.responseText='{}';this.readyState=4;this.onreadystatechange?.();this.onloadend?.();});}
        abort(){}
      };
    },
  });
  const deadline=Date.now()+15000;
  while(Date.now()<deadline&&!dom.window.document.querySelector('.header-logo')&&!errors.length)await new Promise(resolve=>setTimeout(resolve,100));
  await new Promise(resolve=>setTimeout(resolve,500));
  const logo=dom.window.document.querySelector('.header-logo');
  if (logo) {
    const source = logo.getAttribute('src') || '';
    if (!source.startsWith('/_next/static/media/governance-logo.')) errors.push('Logo is not an emitted asset URL.');
    else {
      const response = await fetch(base + source);
      if (response.status !== 200 || !(await response.text()).includes('<svg')) errors.push('Emitted logo does not serve valid SVG.');
    }
  }
  console.log(JSON.stringify({renderedLogo:!!logo,logoSource:logo?.getAttribute('src'),links:dom.window.document.querySelectorAll('a').length,errors},null,2));
  dom.window.close();
  if(!logo||errors.length)process.exitCode=1;
})().catch(error => {console.error(error.message);process.exitCode=1;});
