import pako from 'pako';
import { GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';

export const formatBytes = (bytes: any, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const fetchGovernanceLookupFile = async(storagePool:string) => {
    try{
        const url = GGAPI_STORAGE_URI+"/"+storagePool+'/governance_lookup.json';
        const response = await window.fetch(url, {
            method: 'GET',
            headers: {
            }
          });

          const compressed = await response.arrayBuffer(); //.text();
          //const decompressed = compressed;
          // if compressed we need to decompress:
        try{
            const decompressed = pako.inflate(new Uint8Array(compressed), { to: 'string' });
            //let decompressed:any = pako.ungzip((compressed), {"to": "string"});
            const json = decompressed === "" ? {} : JSON.parse(decompressed);
            return json;
        }catch(err){ 
            console.log("err decompressed: "+JSON.stringify(compressed))
            return null;
        }
    } catch(e){
        console.log("ERR: "+e)
        return null;
    }
}

export const fetchLookupFile = async(fileName:string,storagePool:string) => {
    try{
        const url = GGAPI_STORAGE_URI+"/"+storagePool+'/'+fileName+'';
        const response = await window.fetch(url, {
            method: 'GET',
            headers: {
            }
        });
        const compressed = await response.arrayBuffer(); //.text();
        //const decompressed = compressed;
        // if compressed we need to decompress:
        try{
            const decompressed = pako.inflate(new Uint8Array(compressed), { to: 'string' });
            const json = decompressed === "" ? {} : JSON.parse(decompressed);
            return json;
        }catch(e){
            console.log("err decompressed: "+JSON.stringify(compressed))
            return null;
        }
    } catch(e){
        console.log("ERR: "+e)
        return null;
    }
}

export const getFileFromLookup  = async (fileName:string, storagePool:string) => {
    const fgl = await fetchLookupFile(fileName, storagePool);
    return fgl;
} 