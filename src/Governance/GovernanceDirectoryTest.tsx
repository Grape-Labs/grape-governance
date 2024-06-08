import React, { useCallback } from 'react';
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults"
import {getChildren, getEntryAddressFromName, getRealmAddressFromName, getRealms, RequestStatus} from "gspl-directory";
import {publicKey as UmiPK, unwrapOption} from "@metaplex-foundation/umi";

import { RPC_CONNECTION, RPC_ENDPOINT } from '../utils/grapeTools/constants';

export function GovernanceDirectoryTestView() {
    const [gsplDir, setGsplDir] = React.useState(null);

    const CONFIG = UmiPK("GrVTaSRsanVMK7dP4YZnxTV6oWLcsFDV1w6MHGvWnWCS");
    
    const initGrapeGovernanceDirectory = async() => {
        try{
            const umi = createUmi(RPC_ENDPOINT);
            const entries = await getRealms(umi, CONFIG, RequestStatus.Approved);
            console.log("Entries: "+JSON.stringify(entries));
            return entries;
        } catch(e){
            console.log("Could not load GSPL");
            return null;
        }
    }

    const callGovernanceLookup = async() => {
        const gsplret = await initGrapeGovernanceDirectory();
        //console.log("GSPL: "+gsplret);
        setGsplDir(JSON.stringify(gsplret));
    }

    React.useEffect(() => {
            callGovernanceLookup();
    }, []);

    return <p><br/><br/><br/>GSPL: {gsplDir}</p>
}