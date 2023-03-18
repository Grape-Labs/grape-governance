
import { GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';

export const fetchGovernanceLookupFile = async(storagePool:string) => {
    try{
        const url = GGAPI_STORAGE_URI+"/"+storagePool+'/governance_lookup.json';
        const response = await window.fetch(url, {
            method: 'GET',
            headers: {
            }
          });

          const string = await response.text();
          const json = string === "" ? {} : JSON.parse(string);
          return json;
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
          const string = await response.text();
          const json = string === "" ? {} : JSON.parse(string);
          return json;
    } catch(e){
        console.log("ERR: "+e)
        return null;
    }
}

export const getFileFromLookup  = async (fileName:string, storagePool:string) => {
    const fgl = await fetchLookupFile(fileName, storagePool);
    return fgl;
} 