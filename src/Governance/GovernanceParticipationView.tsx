import React from "react";
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
// @ts-ignore
import { PublicKey, Connection } from '@solana/web3.js';

import { 
    getRealms, 
    getTokenOwnerRecordsByOwner,
    getTokenOwnerRecord
} from '@solana/spl-governance';
import { 
    getRealmIndexed,
    getProposalIndexed,
    getProposalNewIndexed,
    getAllProposalsIndexed,
    getGovernanceIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getTokenOwnerRecordsByOwnerIndexed,
    getTokenOwnerRecordsByRealmIndexed,
} from './api/queries';

import ExplorerView from '../utils/grapeTools/Explorer';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';

import GovernanceDetailsView from './GovernancePlugin';
import { TokenAmount } from '../utils/grapeTools/safe-math';
import { useWallet } from '@solana/wallet-adapter-react';

import {
    Grid,
    Button,
    LinearProgress,
    Typography, 
    CircularProgress,
    Card,
    CardContent,
    Tooltip,
    Avatar,
    Box,
} from '@mui/material';
import { Link } from "react-router-dom";

import { RPC_CONNECTION, RPC_ENDPOINT
} from '../utils/grapeTools/constants';

function GovernanceParticipationView(props: any) {
    const pubkey = props.pubkey;
    const metadataMap = props.metadataMap;
    const governanceLookup = props.governanceLookup;
    const [realms, setRealms] = React.useState(null);
    const [governanceRecordRows, setGovernanceRecordRows] = React.useState(null);
    const [loadingGovernance, setLoadingGovernance] = React.useState(false);
    
    const fetchGovernance = async () => {
        const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
        const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);

        try {
            const rlms = await getRealms(RPC_CONNECTION, [programId]);
            const uTable = rlms.reduce((acc, it) => (acc[it.pubkey.toBase58()] = it, acc), {});
            setRealms(uTable);

            const ownerRecordsbyOwner = await getTokenOwnerRecordsByOwnerIndexed(
                null, programId.toBase58(), new PublicKey(pubkey).toBase58()
            );

            const governanceMap = new Map();

            for (const item of ownerRecordsbyOwner) {
                const realmKey = item.account.realm.toBase58();
                const realm = uTable[realmKey];
                const name = realm?.account?.name || "Unknown Realm";
                const votes = item.account.governingTokenDepositAmount.toNumber();
                
                if (votes > 0) {
                    if (!governanceMap.has(realmKey)) {
                        governanceMap.set(realmKey, {
                            id: realmKey,
                            realm: name,
                            communityVotes: 0,
                            councilVotes: 0,
                            totalVotesCount: item.account.totalVotesCount,
                            unrelinquishedVotesCount: item.account.unrelinquishedVotesCount,
                        });
                    }

                    const existingRecord = governanceMap.get(realmKey);
                    
                    if (realm?.account?.config?.councilMint?.toBase58() === item?.account?.governingTokenMint?.toBase58()) {
                        existingRecord.councilVotes += votes;
                    } else {
                        existingRecord.communityVotes += votes;
                    }

                    governanceMap.set(realmKey, existingRecord);
                }
            }

            setGovernanceRecordRows(Array.from(governanceMap.values()));
        } catch (e) {
            console.log("ERR: " + e);
        }
    };

    const fetchGovernancePositions = async () => {
        setLoadingGovernance(true);
        await fetchGovernance();
        setLoadingGovernance(false);
    };

    React.useEffect(() => {
        if (pubkey && governanceLookup && metadataMap) {
            fetchGovernancePositions();
        }
    }, [pubkey, governanceLookup, metadataMap]);

    return (
        <Box sx={{ mt: 2, pb: 4 }}> {/* Added bottom padding */}
            {loadingGovernance && pubkey ? (
                <Grid container justifyContent="center">
                    <CircularProgress />
                </Grid>
            ) : pubkey && governanceRecordRows && governanceRecordRows.length > 0 ? (
                <>
                    <Typography variant="h6" align="center" sx={{ mb: 2 }}>
                        Governance Participation
                    </Typography>

                    <Grid container spacing={2} justifyContent="center">
                        {governanceRecordRows.map((row: any) => {
                            let metadata = null;
                            
                            for (let glItem of governanceLookup) {
                                if (glItem.governanceAddress === row.id) {
                                    metadata = (glItem?.gspl && glItem.gspl?.metadataUri) ? metadataMap[glItem.gspl.metadataUri] : {};
                                    break;
                                }
                            }

                            const displayName = metadata?.displayName || row.realm;
                            const logoUrl = metadata?.ogImage && !metadata.ogImage.endsWith("/")
                                ? (metadata.ogImage.startsWith("http") ? metadata.ogImage : `https://realms.today${metadata.ogImage}`)
                                : null;

                            return (
                                <Grid item xs={6} sm={4} md={3} lg={2} key={row.id}>
                                    <Card 
                                        elevation={3} 
                                        sx={{
                                            borderRadius: 3,
                                            textAlign: 'center',
                                            p: 2,
                                            height: 140, // Fixed height for uniformity
                                            width: 140,  // Fixed width for uniformity
                                            backgroundColor: "transparent", // Transparent background
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "transform 0.2s",
                                            "&:hover": { transform: "scale(1.05)" }
                                        }}
                                    >
                                        <CardContent sx={{ p: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <Tooltip title={`View ${displayName} Governance`}>
                                                <Button
                                                    component={Link}
                                                    to={'/dao/' + row.id}
                                                    color="inherit"
                                                    sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        textTransform: "none"
                                                    }}
                                                >
                                                    {/* Governance Icon */}
                                                    <Avatar
                                                        src={logoUrl}
                                                        alt={displayName}
                                                        sx={{
                                                            width: 50,
                                                            height: 50,
                                                            mb: 1,
                                                            boxShadow: "0px 4px 10px rgba(0,0,0,0.3)",
                                                            backgroundColor: logoUrl ? "transparent" : "#ddd"
                                                        }}
                                                    >
                                                        {!logoUrl && displayName.charAt(0)} {/* Show first letter if no image */}
                                                    </Avatar>

                                                    {/* Governance Name */}
                                                    <Typography 
                                                        variant="subtitle2"
                                                        fontWeight="bold"
                                                        sx={{ 
                                                            maxWidth: "100%", 
                                                            whiteSpace: "nowrap", 
                                                            overflow: "hidden", 
                                                            textOverflow: "ellipsis",
                                                            textAlign: "center"
                                                        }}
                                                    >
                                                        {displayName}
                                                    </Typography>
                                                </Button>
                                            </Tooltip>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </>
            ) : (
                <>
                {pubkey &&
                    <Grid container justifyContent="center">
                        <Typography align="center">No governance records with voting power found.</Typography>
                    </Grid>
                }
                </>
            )}
        </Box>
    );
}

export default GovernanceParticipationView;