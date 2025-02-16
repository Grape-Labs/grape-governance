import React, { useState } from "react";
import { PublicKey } from '@solana/web3.js';
import axios from "axios";

import { 
    getRealms, 
} from '@solana/spl-governance';
import { 
    getTokenOwnerRecordsByOwnerIndexed,
} from './api/queries';

import {
    Grid,
    CircularProgress,
    Typography,
    Avatar,
    Tooltip,
    Box,
    Card,
    CardActionArea,
    CardContent,
    ListItemButton,
    ListItemText,
    Collapse
} from '@mui/material';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Link } from "react-router-dom";

import { RPC_CONNECTION, SHYFT_KEY } from '../utils/grapeTools/constants';

function GovernanceParticipationView(props: any) {
    const pubkey = props.pubkey;
    const metadataMap = props.metadataMap;
    const governanceLookup = props.governanceLookup;
    const [realms, setRealms] = React.useState(null);
    const [governanceRecordRows, setGovernanceRecordRows] = React.useState(null);
    const [loadingGovernance, setLoadingGovernance] = React.useState(false);
    const [canParticipate, setCanParticipate] = React.useState(null);

    // Collapsible state
    const [openCanParticipate, setOpenCanParticipate] = useState(false);
    const [openParticipation, setOpenParticipation] = useState(true);

    const getWalletAllTokenBalance = async (tokenOwnerRecord: PublicKey) => {
        const uri = `https://api.shyft.to/sol/v1/wallet/all_tokens?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
        return axios.get(uri, {
            headers: {
                'x-api-key': SHYFT_KEY,
                'Accept-Encoding': 'gzip, deflate, br'
            }
        })
        .then(response => response.data?.result || null)
        .catch(error => {
            console.error(error);
            return null;
        });
    };

    const fetchDaoWalletHoldingsCheck = async (tokenOwnerRecord: PublicKey) => {
        const holdings = await getWalletAllTokenBalance(tokenOwnerRecord);
        let potentialDao = [];

        for (const holdingsItem of holdings) {
            if (holdingsItem.balance > 0) {
                for (const governanceItem of governanceLookup) {
                    if (governanceItem?.communityMint === holdingsItem.address || governanceItem?.councilMint === holdingsItem.address) {
                        let metadata = metadataMap[governanceItem.gspl?.metadataUri] || {};
                        potentialDao.push({
                            name: metadata?.displayName || governanceItem.governanceName,
                            governanceAddress: governanceItem.governanceAddress,
                            token: holdingsItem.address,
                            balance: holdingsItem.balance,
                            logoUrl: metadata?.ogImage && !metadata.ogImage.endsWith("/")
                                ? (metadata.ogImage.startsWith("http") ? metadata.ogImage : `https://realms.today${metadata.ogImage}`)
                                : null
                        });
                    }
                }
            }
        }
        setCanParticipate(potentialDao);
    };

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
                    existingRecord.communityVotes += votes;
                    governanceMap.set(realmKey, existingRecord);
                }
            }

            // **Fetch metadata correctly**
            const governanceArray = Array.from(governanceMap.values()).map(row => {
                let metadata = metadataMap[governanceLookup.find(glItem => glItem.governanceAddress === row.id)?.gspl?.metadataUri] || {};
                return {
                    ...row,
                    displayName: metadata?.displayName || row.realm,
                    logoUrl: metadata?.ogImage && !metadata.ogImage.endsWith("/")
                        ? (metadata.ogImage.startsWith("http") ? metadata.ogImage : `https://realms.today${metadata.ogImage}`)
                        : null
                };
            });

            setGovernanceRecordRows(governanceArray);
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
            fetchDaoWalletHoldingsCheck(pubkey);
        }
    }, [pubkey, governanceLookup, metadataMap]);

    return (
        <Box sx={{ mt: 2, pb: 4 }}>
            {loadingGovernance && pubkey ? (
                <Grid container justifyContent="center">
                    <CircularProgress />
                </Grid>
            ) : pubkey ? (
                <>
                    {/* DAOs You Can Join */}
                    {canParticipate && canParticipate.length > 0 && (
                        <Box sx={{ mb: 2, background: 'rgba(0,0,0,0.2)', borderRadius: '17px' }}>
                            <ListItemButton onClick={() => setOpenCanParticipate(!openCanParticipate)}>
                                <ListItemText primary="DAOs You Can Join" />
                                {openCanParticipate ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </ListItemButton>
                            <Collapse in={openCanParticipate} timeout="auto" unmountOnExit sx={{ p: 2 }}>
                                <Grid container spacing={2} justifyContent="center">
                                    {canParticipate.map((dao: any) => (
                                        <Grid item xs={12} sm={6} md={4} lg={3} key={dao.governanceAddress}>
                                            <Card sx={{ background: "rgba(0, 0, 0, 0.2)", borderRadius: 2 }}>
                                                <CardActionArea component={Link} to={'/dao/' + dao.governanceAddress}>
                                                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                                        <Avatar src={dao.logoUrl} alt={dao.name} sx={{ width: 40, height: 40 }} />
                                                        <Typography variant="body2" sx={{ fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {dao.name}
                                                        </Typography>
                                                    </CardContent>
                                                </CardActionArea>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Collapse>
                        </Box>
                    )}

                    {/* Governance Participation */}
                    {governanceRecordRows && governanceRecordRows.length > 0 && (
                        <Box sx={{ background: 'rgba(0,0,0,0.2)', borderRadius: '17px' }}>
                            <ListItemButton onClick={() => setOpenParticipation(!openParticipation)}>
                                <ListItemText primary="Your Governance Participation" />
                                {openParticipation ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </ListItemButton>
                            <Collapse in={openParticipation} timeout="auto" unmountOnExit sx={{ p: 2 }}>
                                <Grid container spacing={2} justifyContent="center">
                                    {governanceRecordRows.map((row: any) => (
                                        <Grid item xs={12} sm={6} md={4} lg={3} key={row.id}>
                                            <Card sx={{ background: "rgba(0, 0, 0, 0.2)", borderRadius: 2 }}>
                                                <CardActionArea component={Link} to={'/dao/' + row.id}>
                                                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                                        <Avatar src={row.logoUrl} alt={row.displayName} sx={{ width: 40, height: 40 }} />
                                                        <Typography variant="body2">{row.displayName}</Typography>
                                                    </CardContent>
                                                </CardActionArea>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Collapse>
                        </Box>
                    )}
                </>
            ) : null}
        </Box>
    );
}

export default GovernanceParticipationView;