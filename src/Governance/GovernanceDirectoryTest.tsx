import React, { useCallback } from 'react';
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults"
import {getChildren, getEntryAddressFromName, getRealmAddressFromName, getRealms, RequestStatus} from "gspl-directory";
import {publicKey as UmiPK, unwrapOption} from "@metaplex-foundation/umi";

import { RPC_CONNECTION, RPC_ENDPOINT } from '../utils/grapeTools/constants';

import { initGrapeGovernanceDirectory } from './api/gspl_queries';

export function GovernanceDirectoryTestView() {
    const [gsplDir, setGsplDir] = React.useState(null);

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