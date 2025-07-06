import {createUmi} from "@metaplex-foundation/umi-bundle-defaults";
import {getRealms, RequestStatus} from "gspl-directory";
import {publicKey as UmiPK} from "@metaplex-foundation/umi";
import {Connection} from "@solana/web3.js";

import { 
    RPC_CONNECTION, SHYFT_RPC_ENDPOINT } from '../../utils/grapeTools/constants';

export const CONFIG = UmiPK("GrVTaSRsanVMK7dP4YZnxTV6oWLcsFDV1w6MHGvWnWCS");

const TEST_PUBLIC_KEY = UmiPK("11111111111111111111111111111111"); // Dummy PK

const createUmiWithFallback = async (rpcUrls: Connection[]): Promise<any> => {
    for (let url of rpcUrls) {
        try {
            const umi = createUmi(url);
            // Make a basic health check — try fetching an account or block height
            await umi.rpc.getAccount(TEST_PUBLIC_KEY); // Simple lightweight call
            console.log(`✅ Using RPC: ${url}`);
            return umi;
        } catch (e) {
            console.warn(`❌ RPC failed: ${url}`, e.message);
        }
    }
    throw new Error("All RPC endpoints failed.");
};

export const initGrapeGovernanceDirectory = async () => {
    try {
        const umi = await createUmiWithFallback([RPC_CONNECTION, new Connection(SHYFT_RPC_ENDPOINT)]);
        const entries = await getRealms(umi, CONFIG, RequestStatus.Approved);
        return entries;
    } catch (e) {
        console.error("Could not load GSPL from any RPC:", e);
        return [];
    }
};
