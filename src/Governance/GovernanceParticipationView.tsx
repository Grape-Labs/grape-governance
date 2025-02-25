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
    Box,
    Card,
    CardActionArea,
    CardContent,
    ListItemButton,
    ListItemText,
    Collapse,
    Tooltip,
} from '@mui/material';

import VerifiedIcon from "@mui/icons-material/Verified";
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

    // Collapsible sections
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
                            name: metadata?.displayName || governanceItem.governanceName || "Unknown Governance",
                            governanceAddress: governanceItem.governanceAddress,
                            token: holdingsItem.address,
                            balance: holdingsItem.balance,
                            members: governanceItem.totalMembers || 0, // Ensure a valid members count
                            logoUrl: metadata?.ogImage && !metadata.ogImage.endsWith("/")
                                ? (metadata.ogImage.startsWith("http") ? metadata.ogImage : `https://realms.today${metadata.ogImage}`)
                                : null,
                            hasMetadata: !!metadata?.displayName // Check if metadata exists
                        });
                    }
                }
            }
        }
    
        // **Sorting: hasMetadata > members > token balance**
        potentialDao.sort((a, b) => {
            if (b.hasMetadata !== a.hasMetadata) return Number(b.hasMetadata) - Number(a.hasMetadata);
            if (b.members !== a.members) return b.members - a.members;
            return b.balance - a.balance;
        });
    
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
                            governanceAddress: realmKey,
                            name: name,
                            communityVotes: 0,
                            councilVotes: 0,
                            totalVotesCount: item.account.totalVotesCount,
                            unrelinquishedVotesCount: item.account.unrelinquishedVotesCount,
                            members: 0,
                        });
                    }

                    const existingRecord = governanceMap.get(realmKey);
                    existingRecord.communityVotes += votes;
                    governanceMap.set(realmKey, existingRecord);
                }
            }

            // **Map governance items to metadata & enrich data**
            const governanceArray = Array.from(governanceMap.values()).map(row => {
                const governanceItem = governanceLookup.find(glItem => glItem.governanceAddress === row.governanceAddress);
                let metadata = metadataMap[governanceItem?.gspl?.metadataUri] || {};

                return {
                    ...row,
                    displayName: metadata?.displayName || row?.account?.name || "Unknown Governance",
                    members: governanceItem?.totalMembers || 0, // Ensuring a valid members count
                    logoUrl: metadata?.ogImage && !metadata.ogImage.endsWith("/")
                        ? (metadata.ogImage.startsWith("http") ? metadata.ogImage : `https://realms.today${metadata.ogImage}`)
                        : null,
                    hasMetadata: !!metadata?.displayName, // Check if metadata exists
                    hasBothVotes: row.communityVotes > 0 && row.councilVotes > 0 // Check if both vote types exist
                };
            });

            // **Sorting: hasMetadata > members > both votes > community votes > council votes**
            governanceArray.sort((a, b) => {
                if (b.hasMetadata !== a.hasMetadata) return Number(b.hasMetadata) - Number(a.hasMetadata);
                if (b.members !== a.members) return b.members - a.members;
                if (b.hasBothVotes !== a.hasBothVotes) return Number(b.hasBothVotes) - Number(a.hasBothVotes);
                if (b.communityVotes !== a.communityVotes) return b.communityVotes - a.communityVotes;
                return b.councilVotes - a.councilVotes;
            });

            
            setGovernanceRecordRows(governanceArray);
        } catch (e) {
            console.log("ERR: " + e);
        }
    };

    React.useEffect(() => {
        if (pubkey && governanceLookup && metadataMap) {
            fetchGovernance();
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
                        <CollapsibleSection 
                            title="Join a DAO" 
                            open={openCanParticipate} 
                            setOpen={setOpenCanParticipate}
                            data={canParticipate} 
                        />
                    )}

                    {/* Governance Participation */}
                    {governanceRecordRows && governanceRecordRows.length > 0 && (
                        <CollapsibleSection 
                            title="Your Governance Participation" 
                            open={openParticipation} 
                            setOpen={setOpenParticipation}
                            data={governanceRecordRows} 
                        />
                    )}
                </>
            ) : null}
        </Box>
    );
}

// **Reusable DAO Item**
const DAOItem = ({ name, governanceAddress, logoUrl, balance, hasMetadata }) => (
    <Grid item xs={12} sm={6} md={4} lg={3} key={governanceAddress}>
        <Card sx={{ background: "rgba(0, 0, 0, 0.2)", borderRadius: 2 }}>
            <Tooltip 
                title={balance ? `Join ${name} with ${balance.toLocaleString()} voting power` : `Visit DAO`}
            >
                <CardActionArea component={Link} to={'/dao/' + governanceAddress}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar src={logoUrl} alt={name} sx={{ width: 40, height: 40 }} />
                        <Typography variant="body2">{name}</Typography>
                        {hasMetadata && 
                            <Tooltip title="Governance Verified">
                                <VerifiedIcon sx={{ color: "green", fontSize: 18 }} />
                            </Tooltip>
                        }
                    </CardContent>
                </CardActionArea>
            </Tooltip>
        </Card>
    </Grid>
);

// **Reusable Collapsible Section**
const CollapsibleSection = ({ title, open, setOpen, data }) => (
    <Box sx={{ mb: 2, background: 'rgba(0,0,0,0.2)', borderRadius: '17px' }}>
            <ListItemButton onClick={() => setOpen(!open)}
                sx={{
                    backgroundColor:'rgba(0,0,0,0.2)',
                    borderRadius:'17px',
                    borderBottomLeftRadius: open ? '0' : '17px',
                    borderBottomRightRadius: open ? '0' : '17px', 
                }}
            >
                <ListItemText primary={title} />
                {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItemButton>
        <Collapse in={open} timeout="auto" unmountOnExit sx={{ p: 2 }}>
            <Grid container spacing={2} justifyContent="center">
                {data.map((dao) => <DAOItem key={dao.governanceAddress} {...dao} />)}
            </Grid>
        </Collapse>
    </Box>
);

export default GovernanceParticipationView;