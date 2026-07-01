import { PublicKey, TokenAmount, Connection, Transaction } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { getMint } from '@solana/spl-token-v2';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import axios from "axios";
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { initGrapeGovernanceDirectory } from './api/gspl_queries';
import { resolveRealmMetadata } from './api/realmMetadata';
import { 
    tryGetName,
} from '@cardinal/namespaces';

import { CardinalTwitterIdentityResolver } from '@dialectlabs/identity-cardinal';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import BN from 'bn.js';
import { styled, useTheme } from '@mui/material/styles';
import {
  Typography,
  Button,
  Grid,
  Box,
  Paper,
  Avatar,
  Table,
  TableContainer,
  TableCell,
  TableHead,
  TableBody,
  TableFooter,
  TableRow,
  TablePagination,
  Collapse,
  Tooltip,
  CircularProgress,
  LinearProgress,
} from '@mui/material/';

import { GovernanceHeaderView } from './GovernanceHeaderView';
import GovernanceNavigation from './GovernanceNavigation'; 
import GovernancePower from './GovernancePower';

import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers';
import ExplorerView from '../utils/grapeTools/Explorer';
import { getProfilePicture } from '@solflare-wallet/pfp';
import { findDisplayName } from '../utils/name-service';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';

import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import Chat from '@mui/icons-material/Chat';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import LastPageIcon from '@mui/icons-material/LastPage';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IconButton from '@mui/material/IconButton';

import { 
    getRealm, 
    getAllTokenOwnerRecords } from '@solana/spl-governance';
import { 
    getRealmIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getRealmConfigIndexed,
} from './api/queries';

import PropTypes from 'prop-types';
import { 
    RPC_CONNECTION,
    TX_RPC_ENDPOINT } from '../utils/grapeTools/constants';
import { getVoterPDA } from '../utils/governanceTools/components/instructions/account';
import { getVsrRegistrarInfo, isVsrPluginForRealm } from '../utils/governanceTools/vsrPlugin';
import {
    getStakingStakeAccountAddress,
    getStakingVoterRegistrar,
    isStakingVoterPlugin,
} from '../utils/governanceTools/stakingVoterPlugin';

const GOVERNANNCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing with Errors!',
}

const LARGE_REALM_PROGRESS_INTERVAL = 100;
const VSR_SIMULATION_MEMBER_THRESHOLD = 250;
const VSR_SIMULATION_TOP_DEPOSITORS_LIMIT = 150;

const toNumberSafe = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);

    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    if (typeof value?.toNumber === 'function') {
        try {
            return value.toNumber();
        } catch (_e) {
            return 0;
        }
    }

    if (typeof value?.toString === 'function') {
        const parsed = Number(value.toString());
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

const VSR_FACTOR_DENOMINATOR = 1_000_000_000n;

const toBigIntSafe = (value: any): bigint => {
    if (value === null || value === undefined) return 0n;
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return 0n;
        return BigInt(Math.trunc(value));
    }
    if (typeof value === 'string') {
        if (!value.length) return 0n;
        try {
            return BigInt(value);
        } catch (_e) {
            return 0n;
        }
    }
    if (typeof value?.toString === 'function') {
        try {
            return BigInt(value.toString());
        } catch (_e) {
            return 0n;
        }
    }

    return 0n;
};

const bigintMax = (a: bigint, b: bigint): bigint => (a > b ? a : b);
const bigintMin = (a: bigint, b: bigint): bigint => (a < b ? a : b);

const pow10BigInt = (power: number): bigint => {
    if (power <= 0) return 1n;
    return 10n ** BigInt(power);
};

const applyDigitShiftBigInt = (amount: bigint, digitShift: number): bigint => {
    if (digitShift === 0) return amount;
    if (digitShift > 0) {
        return amount * pow10BigInt(digitShift);
    }

    return amount / pow10BigInt(Math.abs(digitShift));
};

const applyScaledFactorBigInt = (amount: bigint, scaledFactor: bigint): bigint => {
    if (amount <= 0n || scaledFactor <= 0n) return 0n;
    return (amount * scaledFactor) / VSR_FACTOR_DENOMINATOR;
};

const getMintDecimalsSafe = async (
    connection: Connection,
    mintPk: PublicKey,
): Promise<number> => {
    try {
        const mintInfo = await getMint(connection, mintPk);
        return Number(mintInfo?.decimals ?? 0);
    } catch (_e) {
        return 0;
    }
};

const getVsrVotingPowerDisplayDecimals = (
    tokenDecimals: number,
    digitShift: number
): number => Math.max(0, tokenDecimals + digitShift);

const getMultipleAccountsInfoBatched = async (
    connection: Connection,
    publicKeys: PublicKey[],
    batchSize = 100
) => {
    const results: Awaited<ReturnType<Connection['getMultipleAccountsInfo']>> = [];

    for (let start = 0; start < publicKeys.length; start += batchSize) {
        const batch = publicKeys.slice(start, start + batchSize);
        const batchInfos = await connection.getMultipleAccountsInfo(batch);
        results.push(...batchInfos);
    }

    return results;
};

const getWalletBalanceAmountUi = (record: any): string | null =>
    record?.walletBalance?.tokenAmount?.amount
        ? (+(
              +record.walletBalance.tokenAmount.amount /
              Math.pow(10, record.walletBalance.tokenAmount.decimals || 0)
          ).toFixed(0))
              .toString()
        : null;

const getLockupKindName = (kind: any): string => {
    if (!kind || typeof kind !== 'object') return 'unknown';
    const key = Object.keys(kind)[0];
    return key || 'unknown';
};

const getVsrWithdrawableAmountNative = (deposit: any, nowTs: number): number => {
    const depositedNative = toNumberSafe(deposit?.amountDepositedNative);
    if (depositedNative <= 0) return 0;

    const lockupKind = getLockupKindName(deposit?.lockup?.kind);
    const endTs = toNumberSafe(deposit?.lockup?.endTs);

    if (lockupKind === 'none') {
        return depositedNative;
    }

    if (endTs > 0 && endTs <= nowTs) {
        return depositedNative;
    }

    return 0;
};

const getVsrLockupTimeRemainingSecs = (deposit: any, nowTs: number): bigint => {
    const startTs = BigInt(toNumberSafe(deposit?.lockup?.startTs));
    const endTs = BigInt(toNumberSafe(deposit?.lockup?.endTs));
    const currentTs = BigInt(nowTs);
    const lockupKind = getLockupKindName(deposit?.lockup?.kind);

    if (lockupKind === 'none') {
        return 0n;
    }

    if (lockupKind === 'constant') {
        return bigintMax(0n, endTs - startTs);
    }

    return bigintMax(0n, endTs - currentTs);
};

const getApproximateVsrVotingPowerNative = (
    deposits: any[],
    registrarState: any,
    nowTs: number
): bigint => {
    if (!registrarState?.votingMints?.length || !deposits?.length) {
        return 0n;
    }

    return deposits.reduce((sum: bigint, deposit: any) => {
        const configIndex = Number(deposit?.votingMintConfigIdx ?? 0);
        const votingMintConfig = registrarState.votingMints?.[configIndex];
        if (!votingMintConfig) {
            return sum;
        }

        const depositedNative = toBigIntSafe(deposit?.amountDepositedNative);
        const initiallyLockedNative = toBigIntSafe(deposit?.amountInitiallyLockedNative);
        const baselineFactor = toBigIntSafe(
            votingMintConfig?.baselineVoteWeightScaledFactor
        );
        const maxExtraFactor = toBigIntSafe(
            votingMintConfig?.maxExtraLockupVoteWeightScaledFactor
        );
        const saturationSecs = toBigIntSafe(votingMintConfig?.lockupSaturationSecs);
        const digitShift = Number(votingMintConfig?.digitShift || 0);
        const lockupTimeRemainingSecs = getVsrLockupTimeRemainingSecs(deposit, nowTs);

        const shiftedDepositedNative = applyDigitShiftBigInt(
            depositedNative,
            digitShift
        );
        const shiftedInitiallyLockedNative = applyDigitShiftBigInt(
            initiallyLockedNative,
            digitShift
        );

        const baselineVoteWeight = applyScaledFactorBigInt(
            shiftedDepositedNative,
            baselineFactor
        );
        const maxExtraVoteWeight = applyScaledFactorBigInt(
            shiftedInitiallyLockedNative,
            maxExtraFactor
        );

        let extraVoteWeight = 0n;
        if (maxExtraVoteWeight > 0n && lockupTimeRemainingSecs > 0n) {
            if (saturationSecs > 0n) {
                const effectiveRemainingSecs = bigintMin(
                    lockupTimeRemainingSecs,
                    saturationSecs
                );
                extraVoteWeight =
                    (maxExtraVoteWeight * effectiveRemainingSecs) / saturationSecs;
            } else {
                extraVoteWeight = maxExtraVoteWeight;
            }
        }

        return sum + baselineVoteWeight + extraVoteWeight;
    }, 0n);
};

const fetchStakingPluginMemberStats = async (
    realmPk: PublicKey,
    voterWeightAddinPk: PublicKey,
    participants: any[]
) => {
    const registrar = await getStakingVoterRegistrar(
        RPC_CONNECTION,
        realmPk,
        voterWeightAddinPk
    );

    if (!registrar) return null;

    const members = participants.map((participant: any) => {
        const ownerPk = new PublicKey(participant.governingTokenOwner);
        return {
            owner: ownerPk.toBase58(),
            ownerPk,
            stakeAccount: getStakingStakeAccountAddress(
                registrar.stakePool,
                ownerPk,
                registrar.stakingProgramId
            ),
        };
    });
    const accountInfos = await getMultipleAccountsInfoBatched(
        RPC_CONNECTION,
        members.map((item) => item.stakeAccount)
    );

    const memberStats: Record<string, any> = {};
    const totals = {
        totalDepositedNative: 0,
        totalLockedNative: 0,
        totalWithdrawableNative: 0,
        activeParticipants: 0,
        totalVotingPowerNative: 0,
    };

    members.forEach((member, index) => {
        const accountInfo = accountInfos[index];
        const stakedAmount =
            accountInfo?.data && accountInfo.data.length >= 80
                ? Number(accountInfo.data.readBigUInt64LE(72))
                : 0;

        memberStats[member.owner] = {
            depositedNative: stakedAmount,
            lockedNative: stakedAmount,
            withdrawableNative: 0,
            depositCount: stakedAmount > 0 ? 1 : 0,
            voterWeightNative: stakedAmount,
            voterWeightApproximate: false,
            voterWeightRecordFound: stakedAmount > 0,
            displayDecimals: null,
            votingPowerDisplayDecimals: null,
        };

        totals.totalDepositedNative += stakedAmount;
        totals.totalLockedNative += stakedAmount;
        totals.totalVotingPowerNative += stakedAmount;
        if (stakedAmount > 0) {
            totals.activeParticipants += 1;
        }
    });

    return {
        memberStats,
        totals,
        summaryDisplayConfig: null,
    };
};

const toBase58Safe = (value: any): string | null => {
    try {
        if (!value) return null;
        if (typeof value === 'string') return new PublicKey(value).toBase58();
        if (typeof value?.toBase58 === 'function') return value.toBase58();
        return new PublicKey(value).toBase58();
    } catch (_e) {
        return null;
    }
};

TablePaginationActions.propTypes = {
    count: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired,
    page: PropTypes.number.isRequired,
    rowsPerPage: PropTypes.number.isRequired,
};

function TablePaginationActions(props) {
    const theme = useTheme();
    const { count, page, rowsPerPage, onPageChange } = props;
  
    const handleFirstPageButtonClick = (event) => {
        onPageChange(event, 0);
    };

    const handleBackButtonClick = (event) => {
        onPageChange(event, page - 1);
    };
  
    const handleNextButtonClick = (event) => {
        onPageChange(event, page + 1);
    };
  
    const handleLastPageButtonClick = (event) => {
        onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
    };
    
    return (
        <Box sx={{ flexShrink: 0, ml: 2.5 }}>
            <IconButton
                onClick={handleFirstPageButtonClick}
                disabled={page === 0}
                aria-label="first page"
            >
                {theme.direction === "rtl" ? <LastPageIcon /> : <FirstPageIcon />}
            </IconButton>
            <IconButton
                onClick={handleBackButtonClick}
                disabled={page === 0}
                aria-label="previous page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowRight />
                ) : (
                    <KeyboardArrowLeft />
                )}
            </IconButton>
            <IconButton
                onClick={handleNextButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="next page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowLeft />
                ) : (
                    <KeyboardArrowRight />
                )}
            </IconButton>
            <IconButton
                onClick={handleLastPageButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="last page"
            >
                {theme.direction === "rtl" ? <FirstPageIcon /> : <LastPageIcon />}
            </IconButton>
        </Box>
    );
  }

function RenderGovernanceMembersTable(props:any) {
    const tokenMap = props.tokenMap;
    const memberMap = props.memberMap;
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const participating = props.participating;
    const members = props.members;
    const circulatingSupply = props.circulatingSupply;
    const totalDepositedVotes = props.totalDepositedVotes;
    const pluginDao = !!props.pluginDao;
    const [memberVotingResults, setMemberVotingResults] = React.useState(null);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    // Avoid a layout jump when reaching the last page with empty rows.
    const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - members.length) : 0;
    const token = props.token;
    const governingTokenMint = props?.governingTokenMint;
    const governingTokenDecimals = props?.governingTokenDecimals || 0;
    const defaultVsrTokenDecimals = props?.vsrTokenDecimals;
    const defaultVsrVotingPowerDecimals = props?.vsrVotingPowerDecimals;
    
    
    const memberresultscolumns: GridColDef[] = [
        { field: 'id', headerName: 'Rank', minWidth: 70, hide: true},
        { field: 'address', headerName: 'Address', minWidth: 70, hide: true},
        { field: 'record', headerName: 'Record', minWidth: 70, hide: true},
        { field: 'delegate', headerName: 'Delegate', minWidth: 200, hide: true},
        { field: 'member', headerName: 'Member', minWidth: pluginDao ? 260 : 200, flex: 1,
            renderCell: (params) => {
                return(
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            width: '100%',
                            minWidth: 0,
                        }}
                    >
                        <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                            <ExplorerView
                                showSolanaProfile={!pluginDao}
                                memberMap={memberMap}
                                grapeArtProfile={!pluginDao}
                                address={params.value.address}
                                type='address'
                                shorten={pluginDao ? 6 : 8}
                                hideTitle={false}
                                hideIcon={pluginDao}
                                style='text'
                                color='white'
                                fontSize={pluginDao ? '16px' : '18px'}
                            />
                        </Box>
                        {Number(params.value.governingCouncilDepositAmount) > 0 &&
                            <Tooltip title={`Council Member - Votes: ${Number(params.value.governingCouncilDepositAmount)}`}>
                                <Button
                                    color='inherit'
                                    sx={{
                                        minWidth: 36,
                                        px: 0.75,
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        background: 'rgba(255,255,255,0.04)',
                                        flexShrink: 0,
                                    }}
                                >
                                    <AssuredWorkloadIcon fontSize='small' />
                                </Button>
                            </Tooltip>
                        }
                    </Box>
                )
            }
        },
        { field: 'staked', headerName: pluginDao ? 'Deposited' : 'Votes Staked', minWidth: 170, flex: 1, headerAlign: 'center', align: 'right',
            sortable: true, // Enable sorting on this column
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                const param1 = cellParams1.value.depositedAmount || 0;
                const param2 = cellParams2.value.depositedAmount || 0;
                return param1 - param2;
            },   
            renderCell: (params) => {
                return(
                    <Box sx={{ textAlign: 'right', width: '100%' }}>
                        <Typography variant="h6">
                            {getFormattedNumberToLocale(params.value.depositedAmount)}
                        </Typography>
                        {pluginDao && params.value.depositCount > 0 && (
                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                {params.value.depositCount} VSR deposit{params.value.depositCount === 1 ? '' : 's'}
                            </Typography>
                        )}
                    </Box>
                )
            }
        },
        { field: 'legacyDeposit', headerName: 'Legacy Deposit', minWidth: 170, flex: 1, headerAlign: 'center', align: 'right',
            hide: !pluginDao,
            sortable: true,
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                const param1 = cellParams1.value?.legacyDepositAmount || 0;
                const param2 = cellParams2.value?.legacyDepositAmount || 0;
                return param1 - param2;
            },
            renderCell: (params) => (
                <Box sx={{ textAlign: 'right', width: '100%' }}>
                    <Typography variant="h6">
                        {getFormattedNumberToLocale(params.value?.legacyDepositAmount || 0)}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        SPL governance
                    </Typography>
                </Box>
            )
        },
        { field: 'votingPower', headerName: 'Voting Power', minWidth: 170, flex: 1, headerAlign: 'center', align: 'right',
            sortable: true,
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                const param1 = cellParams1.value?.votingPower ?? -1;
                const param2 = cellParams2.value?.votingPower ?? -1;
                return param1 - param2;
            },
            renderCell: (params) => (
                <Box sx={{ textAlign: 'right', width: '100%' }}>
                    <Typography variant="h6">
                        {params.value?.votingPower !== null && params.value?.votingPower !== undefined
                            ? getFormattedNumberToLocale(params.value.votingPower)
                            : '--'}
                    </Typography>
                    {pluginDao && params.value?.votingPowerSource === 'simulated' ? (
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            plugin weight
                        </Typography>
                    ) : pluginDao && params.value?.votingPowerSource === 'computed' ? (
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            computed
                        </Typography>
                    ) : pluginDao && params.value?.votingPowerRecord ? (
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            resolved
                        </Typography>
                    ) : pluginDao ? (
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            unresolved
                        </Typography>
                    ) : null}
                </Box>
            )
        },
        { field: 'locked', headerName: 'Locked', minWidth: 150, flex: 1, headerAlign: 'center', align: 'right',
            hide: !pluginDao,
            sortable: true,
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                const param1 = cellParams1.value?.lockedAmount || 0;
                const param2 = cellParams2.value?.lockedAmount || 0;
                return param1 - param2;
            },
            renderCell: (params) => (
                <Typography variant="h6">
                    {getFormattedNumberToLocale(params.value?.lockedAmount || 0)}
                </Typography>
            )
        },
        { field: 'withdrawable', headerName: 'Withdrawable', minWidth: 170, flex: 1, headerAlign: 'center', align: 'right',
            hide: !pluginDao,
            sortable: true,
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                const param1 = cellParams1.value?.withdrawableAmount || 0;
                const param2 = cellParams2.value?.withdrawableAmount || 0;
                return param1 - param2;
            },
            renderCell: (params) => (
                <Typography variant="h6">
                    {getFormattedNumberToLocale(params.value?.withdrawableAmount || 0)}
                </Typography>
            )
        },
        { field: 'unstaked', headerName: 'Not Staked', minWidth: 170, headerAlign: 'center', align: 'right', hide: true,
            renderCell: (params) => {
                return(
                    <Typography variant="caption">
                        {getFormattedNumberToLocale(params.value)}
                    </Typography>
                )
            }
        },
        { field: 'percentDepositedGovernance', headerName: '% of Deposited Governance', minWidth: 170, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {params.value}%
                    </Typography>
                )
            }
        },
        { field: 'percentSupply', headerName: '% of Supply', minWidth: 170, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {params.value}%
                    </Typography>
                )
            }
        },
    ];


    const handleChangePage = (event:any, newPage:number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event:any) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    /*
    const getProposals = async (GOVERNANCE_PROGRAM_ID:string) => {
        if (!loading){
            setLoading(true);
            
        }
        setLoading(false);
    }*/

    const createMemberTableRows = () => {
        const mmbr = new Array();
        let x = 0;
        const circulatingAmount = Number(circulatingSupply?.value?.amount || 0);
        for (const member of members){
            const legacyDepositedVotesRaw = Number(member?.governingTokenDepositAmount ?? 0);
            const vsrTokenDecimals = pluginDao
                ? Number(
                    member?.vsrDisplayDecimals ??
                    defaultVsrTokenDecimals ??
                    governingTokenDecimals ??
                    0
                )
                : governingTokenDecimals;
            const vsrVotingPowerDecimals = pluginDao
                ? Number(
                    member?.vsrVotingPowerDecimals ??
                    defaultVsrVotingPowerDecimals ??
                    vsrTokenDecimals ??
                    0
                )
                : governingTokenDecimals;
            const depositedVotesRaw = pluginDao
                ? Number(member?.vsrDepositedAmount ?? 0)
                : legacyDepositedVotesRaw;
            const lockedVotesRaw = Number(member?.vsrLockedAmount ?? 0);
            const withdrawableVotesRaw = Number(member?.vsrWithdrawableAmount ?? 0);
            const hasResolvedVsrVotingPower = !!member?.vsrVotingPowerRecord;
            const votingPowerSource = member?.vsrVotingPowerApproximate
                ? 'computed'
                : hasResolvedVsrVotingPower && member?.vsrDepositCount > 0
                ? 'simulated'
                : hasResolvedVsrVotingPower
                ? 'resolved'
                : null;
            const votingPowerRaw = pluginDao
                ? (hasResolvedVsrVotingPower ? Number(member?.vsrVotingPower ?? 0) : null)
                : Number(member?.governingTokenDepositAmount ?? 0);
            mmbr.push({
                id:x+1,
                address: member.governingTokenOwner.toBase58(),
                delegate: member?.governanceDelegate ? member.governanceDelegate.toBase58() : null,
                record: member.pubkey.toBase58(),
                member:{
                    address: member.governingTokenOwner.toBase58(),
                    governingCouncilDepositAmount:((Number(member.governingCouncilDepositAmount) > 0) ? Number(member.governingCouncilDepositAmount) : 0),
                    },
                staked:
                    {
                        depositedAmount:(+((depositedVotesRaw)/Math.pow(10, vsrTokenDecimals || 0)).toFixed(0)),
                        lockedAmount:(+((lockedVotesRaw)/Math.pow(10, vsrTokenDecimals || 0)).toFixed(0)),
                        withdrawableAmount:(+((withdrawableVotesRaw)/Math.pow(10, vsrTokenDecimals || 0)).toFixed(0)),
                        depositCount:Number(member?.vsrDepositCount || 0),
                        governingCouncilDepositAmount:((Number(member.governingCouncilDepositAmount) > 0) ? Number(member.governingCouncilDepositAmount) : 0),
                    },
                legacyDeposit:
                    {
                        legacyDepositAmount:(+((legacyDepositedVotesRaw)/Math.pow(10, governingTokenDecimals || 0)).toFixed(0)),
                    },
                votingPower:
                    {
                        votingPower:(votingPowerRaw !== null
                            ? (+((votingPowerRaw)/Math.pow(10, vsrVotingPowerDecimals || 0)).toFixed(0))
                            : null),
                        votingPowerRecord: pluginDao ? hasResolvedVsrVotingPower : true,
                        votingPowerSource,
                    },
                locked:
                    {
                        lockedAmount:(+((lockedVotesRaw)/Math.pow(10, vsrTokenDecimals || 0)).toFixed(0)),
                    },
                withdrawable:
                    {
                        withdrawableAmount:(+((withdrawableVotesRaw)/Math.pow(10, vsrTokenDecimals || 0)).toFixed(0)),
                    },
                unstaked:Number(member.walletBalanceAmount),
                percentDepositedGovernance:depositedVotesRaw > 0 && Number(totalDepositedVotes || 0) > 0 ? ((depositedVotesRaw/Number(totalDepositedVotes))*100).toFixed(2) : 0,
                percentSupply:
                    depositedVotesRaw > 0 && circulatingAmount > 0
                        ? ((depositedVotesRaw/circulatingAmount)*100).toFixed(2)
                        : 0,
            })
            x++;
        }
        setMemberVotingResults(mmbr);
    }

    React.useEffect(() => {
        if (members){
            createMemberTableRows();
        } else {
            setMemberVotingResults(null);
        }
    }, [members, pluginDao, totalDepositedVotes, governingTokenDecimals, circulatingSupply, defaultVsrTokenDecimals, defaultVsrVotingPowerDecimals]);

    if(loading){
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress sx={{borderRadius:'10px;'}} />
            </Box>
        )
    }
    
    return (
        
        <>
            {memberVotingResults &&
                <div style={{ height: 600, width: '100%' }}>
                    <div style={{ display: 'flex', height: '100%' }}>
                        <div style={{ flexGrow: 1 }}>
                                
                                <DataGrid
                                    //rows={mapMemberObject(memberVotingResults)}
                                    rows={memberVotingResults}
                                    columns={memberresultscolumns}
                                    initialState={{
                                        sorting: {
                                            sortModel: [{ field: 'staked', sort: 'desc' }],
                                        },
                                    }}
                                    //disableColumnFilter
                                    pageSize={25}
                                    rowsPerPageOptions={[]}
                                    sx={{
                                        borderRadius:'17px',
                                        borderColor:'rgba(255,255,255,0.25)',
                                        '& .MuiDataGrid-cell':{
                                            borderColor:'rgba(255,255,255,0.25)'
                                        }}}
                                    sortingOrder={['asc', 'desc', null]}
                                    disableSelectionOnClick
                                
                                />
                        </div>
                    </div>
                </div>
            }
        </>
    )
}

export function GovernanceMembersView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const governanceAddress = urlParams;
    const debugVsr = searchParams.get('debugVsr') === '1';
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    
    const [loading, setLoading] = React.useState(false);
    const [members, setMembers] = React.useState(null);
    const connection = RPC_CONNECTION;
    const { publicKey, wallet } = useWallet();
    const [realm, setRealm] = React.useState(null);
    const [realmName, setRealmName] = React.useState(null);
    const [participating, setParticipating] = React.useState(false)
    const [participatingRealm, setParticipatingRealm] = React.useState(null)
    const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [totalDepositedVotes, setTotalDepositedVotes] = React.useState(null);
    const [totalCouncilVotes, setTotalCouncilVotes] = React.useState(null);
    const [totalParticipants, setTotalParticipants] = React.useState(null);
    const [activeParticipants, setActiveParticipants] = React.useState(null);
    const [votingParticipants, setVotingParticipants] = React.useState(null);
    const [totalVotesCasted, setTotalVotesCasted] = React.useState(null);
    const [totalUnstakedVotes, setTotalUnstakedVotes] = React.useState(null);
    const [totalDepositedCouncilVotes, setDepositedTotalCouncilVotes] = React.useState(null);
    const [top10Participants, setTop10Participants] = React.useState(null);
    const [governingTokenMint, setGoverningTokenMint] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [vsrTokenDecimals, setVsrTokenDecimals] = React.useState<number | null>(null);
    const [vsrVotingPowerDecimals, setVsrVotingPowerDecimals] = React.useState<number | null>(null);
    const [circulatingSupply, setCirculatingSupply] = React.useState(null);
    const [csvGenerated, setCSVGenerated] = React.useState(null);
    const [recordCount, setRecordCount] = React.useState(null);
    const [pluginDao, setPluginDao] = React.useState(null);
    const [pluginProgramId, setPluginProgramId] = React.useState<string | null>(null);
    const [isVsrPluginRealm, setIsVsrPluginRealm] = React.useState(false);
    const [isStakingPluginRealm, setIsStakingPluginRealm] = React.useState(false);
    const [gspl, setGSPL] = React.useState(null);
    const [gsplMetadata, setGSPLMetadata] = React.useState(null);
    const [membersDebug, setMembersDebug] = React.useState<any>(null);
    const [vsrSummary, setVsrSummary] = React.useState<any>({
        totalDepositedNative: 0,
        totalLockedNative: 0,
        totalWithdrawableNative: 0,
        activeParticipants: 0,
    });

    const fetchVsrMemberStats = React.useCallback(async (
        realmPk: PublicKey,
        communityMintPk: PublicKey,
        voterWeightAddinPk: PublicKey,
        participantArray: any[]
    ) => {
        const registrarInfo = await getVsrRegistrarInfo(
            voterWeightAddinPk,
            realmPk,
            communityMintPk
        );

        if (!registrarInfo) {
            return null;
        }

        const { client, registrar, registrarState } = registrarInfo;

        const voterAccounts = await Promise.all(
            participantArray.map(async (participant: any) => {
                const ownerAddress = toBase58Safe(participant.governingTokenOwner);
                if (!ownerAddress) {
                    throw new Error('Invalid governing token owner while loading VSR member stats');
                }
                const ownerPk = new PublicKey(ownerAddress);
                const { voter } = await getVoterPDA(
                    registrar,
                    ownerPk,
                    client.program.programId
                );
                return {
                    ownerPk,
                    owner: ownerPk.toBase58(),
                    voter,
                };
            })
        );

        const voterAccountInfos = await getMultipleAccountsInfoBatched(
            RPC_CONNECTION,
            voterAccounts.map((item) => item.voter)
        );

        const coderAccounts = client.program.account.voter as any;
        const voterStates = voterAccountInfos.map((accountInfo) => {
            if (!accountInfo?.data) return null;
            try {
                return coderAccounts.coder.accounts.decode('voter', accountInfo.data);
            } catch (_e) {
                return null;
            }
        });

        const usedConfigCounts: Record<number, number> = {};
        const usedConfigDeposits: Record<number, number> = {};
        for (const voterState of voterStates || []) {
            for (const deposit of voterState?.deposits || []) {
                if (!deposit?.isUsed || toNumberSafe(deposit?.amountDepositedNative) <= 0) {
                    continue;
                }
                const configIndex = Number(deposit?.votingMintConfigIdx ?? 0);
                usedConfigCounts[configIndex] = Number(usedConfigCounts[configIndex] || 0) + 1;
                usedConfigDeposits[configIndex] =
                    Number(usedConfigDeposits[configIndex] || 0) +
                    toNumberSafe(deposit?.amountDepositedNative);
            }
        }

        const usedConfigIndexes = Object.keys(usedConfigCounts)
            .map((index) => Number(index))
            .filter((index) => Number.isFinite(index));
        const communityMintString = communityMintPk.toBase58();
        const configDisplayMeta: Record<number, any> = {};

        await Promise.all(
            usedConfigIndexes.map(async (configIndex) => {
                const votingMintConfig = registrarState?.votingMints?.[configIndex];
                const votingMintPk = votingMintConfig?.mint
                    ? new PublicKey(votingMintConfig.mint)
                    : null;
                if (!votingMintPk) {
                    return;
                }

                const depositDecimals = await getMintDecimalsSafe(
                    RPC_CONNECTION,
                    votingMintPk
                );
                const digitShift = Number(votingMintConfig?.digitShift || 0);
                configDisplayMeta[configIndex] = {
                    mint: votingMintPk.toBase58(),
                    depositDecimals,
                    votingPowerDecimals: getVsrVotingPowerDisplayDecimals(
                        depositDecimals,
                        digitShift
                    ),
                    digitShift,
                };
            })
        );

        const communityMintConfigIndex = usedConfigIndexes.find((configIndex) => {
            const mint = configDisplayMeta?.[configIndex]?.mint;
            return mint === communityMintString;
        });
        const summaryDisplayConfigIndex =
            communityMintConfigIndex ??
            usedConfigIndexes.sort((a, b) => {
                const depositDiff =
                    Number(usedConfigDeposits[b] || 0) - Number(usedConfigDeposits[a] || 0);
                if (depositDiff !== 0) return depositDiff;
                return Number(usedConfigCounts[b] || 0) - Number(usedConfigCounts[a] || 0);
            })[0] ??
            null;
        const summaryDisplayConfig =
            summaryDisplayConfigIndex !== null
                ? configDisplayMeta?.[summaryDisplayConfigIndex] || null
                : null;

        const votingPowerByOwner: Record<string, number> = {};
        const votingPowerResolvedByOwner: Record<string, boolean> = {};
        const simulationConnections = [RPC_CONNECTION];
        if (
            TX_RPC_ENDPOINT &&
            TX_RPC_ENDPOINT !== RPC_CONNECTION.rpcEndpoint
        ) {
            simulationConnections.push(new Connection(TX_RPC_ENDPOINT, 'confirmed'));
        }

        const decodeVoterInfoFromLogs = (logs: string[] | null | undefined): number | null => {
            for (const logLine of logs || []) {
                if (!logLine.startsWith('Program data: ')) {
                    continue;
                }

                try {
                    const event = client.program.coder.events.decode(
                        logLine.slice('Program data: '.length)
                    );
                    if (event?.name === 'VoterInfo') {
                        return toNumberSafe(event?.data?.votingPower);
                    }
                } catch (_decodeError) {
                    continue;
                }
            }

            return null;
        };

        const simulateVoterInfo = async (
            voter: PublicKey,
            ownerPk: PublicKey
        ): Promise<number | null> => {
            for (const connection of simulationConnections) {
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const instruction = await client.program.methods
                            .logVoterInfo(0, 64)
                            .accounts({
                                registrar,
                                voter,
                            })
                            .instruction();

                        const transaction = new Transaction();
                        transaction.feePayer = ownerPk;
                        transaction.recentBlockhash = (
                            await connection.getLatestBlockhash('confirmed')
                        ).blockhash;
                        transaction.add(instruction);

                        const simulation = await connection.simulateTransaction(transaction);
                        if (simulation.value.err) {
                            console.log('VSR logVoterInfo simulation error: ', simulation.value.err);
                            continue;
                        }

                        const votingPower = decodeVoterInfoFromLogs(simulation.value.logs);
                        if (votingPower !== null) {
                            return votingPower;
                        }
                    } catch (simulationError) {
                        console.log('Failed to simulate VSR voter info: ', simulationError);
                    }
                }
            }

            return null;
        };

        const nowTs = Math.floor(Date.now() / 1000);
        const normalizedVoters = voterAccounts.map((item, index) => {
            const voterState = voterStates?.[index];
            const hasVoterAccount = !!voterAccountInfos?.[index];
            const deposits = (voterState?.deposits || [])
                .map((deposit: any, depositIndex: number) => {
                    const amountDepositedNative = toNumberSafe(
                        deposit?.amountDepositedNative
                    );
                    const withdrawableAmount = getVsrWithdrawableAmountNative(
                        deposit,
                        nowTs
                    );
                    return {
                        ...deposit,
                        index: depositIndex,
                        isUsed: !!deposit?.isUsed,
                        amountDepositedNative,
                        withdrawableAmount,
                    };
                })
                .filter((deposit: any) => deposit.isUsed && deposit.amountDepositedNative > 0);

            const depositedNative = deposits.reduce(
                (sum: number, deposit: any) => sum + toNumberSafe(deposit.amountDepositedNative),
                0
            );
            const withdrawableNative = deposits.reduce(
                (sum: number, deposit: any) => sum + toNumberSafe(deposit.withdrawableAmount),
                0
            );
            const lockedNative = Math.max(0, depositedNative - withdrawableNative);
            const depositsByConfig: Record<number, number> = {};
            for (const deposit of deposits) {
                const configIndex = Number(deposit?.votingMintConfigIdx ?? 0);
                depositsByConfig[configIndex] =
                    Number(depositsByConfig[configIndex] || 0) +
                    toNumberSafe(deposit?.amountDepositedNative);
            }
            const primaryConfigIndex = Object.keys(depositsByConfig)
                .map((configIndex) => Number(configIndex))
                .sort(
                    (a, b) =>
                        Number(depositsByConfig[b] || 0) - Number(depositsByConfig[a] || 0)
                )[0];

            return {
                ...item,
                hasVoterAccount,
                voterState,
                deposits,
                depositedNative,
                withdrawableNative,
                lockedNative,
                primaryConfigIndex,
            };
        });

        const simulationCandidates = normalizedVoters
            .filter((item) => item.hasVoterAccount && item.deposits.length > 0)
            .sort((a, b) => b.depositedNative - a.depositedNative);
        const membersToSimulate =
            simulationCandidates.length > VSR_SIMULATION_MEMBER_THRESHOLD
                ? simulationCandidates.slice(0, VSR_SIMULATION_TOP_DEPOSITORS_LIMIT)
                : simulationCandidates;

        const simulationBatchSize = 3;
        for (let start = 0; start < membersToSimulate.length; start += simulationBatchSize) {
            const batch = membersToSimulate.slice(start, start + simulationBatchSize);
            const batchResults = await Promise.all(
                batch.map(async (item) => ({
                    owner: item.owner,
                    votingPower: await simulateVoterInfo(item.voter, item.ownerPk),
                }))
            );

            for (const result of batchResults) {
                if (result.votingPower !== null) {
                    votingPowerByOwner[result.owner] = result.votingPower;
                    votingPowerResolvedByOwner[result.owner] = true;
                }
            }
        }

        const memberStats: Record<string, any> = {};
        const totals = {
            totalDepositedNative: 0,
            totalLockedNative: 0,
            totalWithdrawableNative: 0,
            activeParticipants: 0,
            totalVotingPowerNative: 0,
        };

        for (const normalizedVoter of normalizedVoters) {
            const owner = normalizedVoter.owner;
            const hasVoterAccount = normalizedVoter.hasVoterAccount;
            const deposits = normalizedVoter.deposits;
            const primaryConfigIndex = normalizedVoter.primaryConfigIndex;
            const displayConfig =
                (Number.isFinite(primaryConfigIndex)
                    ? configDisplayMeta?.[primaryConfigIndex]
                    : null) ||
                summaryDisplayConfig;
            const depositedNative = normalizedVoter.depositedNative;
            const withdrawableNative = normalizedVoter.withdrawableNative;
            const lockedNative = normalizedVoter.lockedNative;
            const approximateVotingPowerNative = Number(
                getApproximateVsrVotingPowerNative(deposits, registrarState, nowTs)
            );
            const voterWeightNative = Object.prototype.hasOwnProperty.call(
                votingPowerByOwner,
                owner
            )
                ? Number(votingPowerByOwner[owner] || 0)
                : approximateVotingPowerNative;
            const isZeroPowerMember = !hasVoterAccount || deposits.length === 0;

            memberStats[owner] = {
                depositedNative,
                lockedNative,
                withdrawableNative,
                depositCount: deposits.length,
                voterWeightNative,
                voterWeightApproximate:
                    !Object.prototype.hasOwnProperty.call(votingPowerByOwner, owner) &&
                    approximateVotingPowerNative > 0,
                voterWeightRecordFound:
                    isZeroPowerMember ||
                    approximateVotingPowerNative > 0 ||
                    Object.prototype.hasOwnProperty.call(
                        votingPowerResolvedByOwner,
                        owner
                    ),
                displayDecimals: displayConfig?.depositDecimals ?? null,
                votingPowerDisplayDecimals:
                    displayConfig?.votingPowerDecimals ??
                    displayConfig?.depositDecimals ??
                    null,
            };

            totals.totalDepositedNative += depositedNative;
            totals.totalLockedNative += lockedNative;
            totals.totalWithdrawableNative += withdrawableNative;
            totals.totalVotingPowerNative += voterWeightNative;
            if (depositedNative > 0) {
                totals.activeParticipants += 1;
            }
        }

        return {
            memberStats,
            totals,
            summaryDisplayConfig,
        };
    }, []);

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            let tmap  = null;
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tokenMp = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map());
                setTokenMap(tokenMp);
                setTokenArray(tarray);
                tmap = tokenMp;
            });
            return tmap;
        } catch(e){console.log("ERR: "+e); return null;}
    }

    

    const getGovernanceMembers = async () => {
        if (!loading){
            setLoading(true);
            let grealm = null;
            const debugInfo: any = {
                requestedGovernanceAddress: governanceAddress,
                realmSource: null,
                memberSource: null,
                indexedRecordCount: null,
                rpcRecordCount: null,
                pluginProgramId: null,
            };
            try{  
                const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
                
                console.log("SPL Governnace: "+governanceAddress);
                
                try {
                    grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress));
                    debugInfo.realmSource = 'rpc';
                } catch (_rpcRealmError) {
                    grealm = await getRealmIndexed(governanceAddress, undefined);
                    debugInfo.realmSource = 'index';
                }
                if (!grealm) {
                    throw new Error('Unable to load realm from rpc or indexed queries');
                }
                const realmPk = new PublicKey(grealm.pubkey);
                debugInfo.resolvedRealm = realmPk.toBase58();
                debugInfo.realmName = grealm.account?.name || null;
                debugInfo.realmOwner = grealm.owner?.toBase58?.() || `${grealm.owner || ''}`;
                debugInfo.communityMint =
                    grealm.account?.communityMint?.toBase58?.() || `${grealm.account?.communityMint || ''}`;
                setRealm(grealm);
                setRealmName(grealm.account.name);
                
                //const config = await tryGetRealmConfig(RPC_CONNECTION, new PublicKey(grealm.owner), new PublicKey(grealm.pubkey));
                const config = await getRealmConfigIndexed(null, grealm.owner, realmPk);
                const voterWeightAddin = toBase58Safe(
                    config?.account?.communityTokenConfig?.voterWeightAddin
                );
                const resolvedIsVsrPluginRealm = voterWeightAddin
                    ? await isVsrPluginForRealm(
                        voterWeightAddin,
                        realmPk,
                        grealm.account?.communityMint
                    )
                    : false;
                const resolvedIsStakingPluginRealm = isStakingVoterPlugin(voterWeightAddin);
                debugInfo.pluginProgramId = voterWeightAddin;
                debugInfo.isVsrPluginRealm = resolvedIsVsrPluginRealm;
                debugInfo.isStakingPluginRealm = resolvedIsStakingPluginRealm;

                if (voterWeightAddin){
                    setPluginDao(true);
                    setPluginProgramId(voterWeightAddin);
                    setIsVsrPluginRealm(resolvedIsVsrPluginRealm);
                    setIsStakingPluginRealm(resolvedIsStakingPluginRealm);
                    if (!resolvedIsVsrPluginRealm && !resolvedIsStakingPluginRealm) {
                        setVsrTokenDecimals(null);
                        setVsrVotingPowerDecimals(null);
                        setVsrSummary({
                            totalDepositedNative: 0,
                            totalLockedNative: 0,
                            totalWithdrawableNative: 0,
                            activeParticipants: 0,
                        });
                    }
                } else {
                    setPluginDao(false);
                    setPluginProgramId(null);
                    setIsVsrPluginRealm(false);
                    setIsStakingPluginRealm(false);
                    setVsrTokenDecimals(null);
                    setVsrVotingPowerDecimals(null);
                    setVsrSummary({
                        totalDepositedNative: 0,
                        totalLockedNative: 0,
                        totalWithdrawableNative: 0,
                        activeParticipants: 0,
                    });
                }

                //console.log("realm: "+JSON.stringify(grealm))

                setGoverningTokenMint(new PublicKey(grealm.account.communityMint).toBase58());
                let resolvedCirculatingSupply = null;
                try {
                    resolvedCirculatingSupply = await connection.getTokenSupply(
                        new PublicKey(grealm.account.communityMint)
                    );
                    setCirculatingSupply(resolvedCirculatingSupply);
                    debugInfo.circulatingSupplyAmount =
                        resolvedCirculatingSupply?.value?.amount || null;
                    debugInfo.circulatingSupplyDecimals =
                        resolvedCirculatingSupply?.value?.decimals ?? null;
                } catch (tokenSupplyError) {
                    console.log('ERR(getTokenSupply): ', tokenSupplyError);
                    setCirculatingSupply(null);
                    debugInfo.circulatingSupplyError = `${tokenSupplyError}`;
                }
                // with realm check if this is a backed token
                let thisTokenDecimals = 0;

                const communityMintKey = new PublicKey(grealm.account?.communityMint).toBase58();
                if (tokenMap?.get?.(communityMintKey)) {
                    thisTokenDecimals = Number(tokenMap.get(communityMintKey).decimals || 0);
                } else {
                    thisTokenDecimals = 6;
                }
                setGoverningTokenDecimals(thisTokenDecimals);
                
                let trecords = null;
                let indexedTokenOwnerRecords: any[] = [];
                let rpcTokenOwnerRecords: any[] = [];

                const realmOwnerString = grealm?.owner?.toBase58 ? grealm.owner.toBase58() : `${grealm?.owner || ''}`;

                if (resolvedIsVsrPluginRealm) {
                    try {
                        rpcTokenOwnerRecords = await getAllTokenOwnerRecords(
                            RPC_CONNECTION,
                            new PublicKey(realmOwnerString),
                            realmPk
                        );
                    } catch (rpcTokenOwnerRecordsError) {
                        console.log('ERR(getAllTokenOwnerRecords rpc): ', rpcTokenOwnerRecordsError);
                    }

                    try {
                        const indexedResults = await getAllTokenOwnerRecordsIndexed(
                            realmPk.toBase58(),
                            realmOwnerString,
                            undefined,
                            undefined,
                            true
                        );
                        indexedTokenOwnerRecords = Array.isArray(indexedResults) ? indexedResults : [];
                    } catch (indexedTokenOwnerRecordsError) {
                        console.log('ERR(getAllTokenOwnerRecords indexed): ', indexedTokenOwnerRecordsError);
                    }

                    trecords = rpcTokenOwnerRecords.length > 0 ? rpcTokenOwnerRecords : indexedTokenOwnerRecords;
                    debugInfo.memberSource = rpcTokenOwnerRecords.length > 0 ? 'rpc' : 'index';
                } else {
                    try {
                        const indexedResults = await getAllTokenOwnerRecordsIndexed(
                            realmPk.toBase58(),
                            realmOwnerString,
                            undefined,
                            undefined,
                            true
                        );
                        indexedTokenOwnerRecords = Array.isArray(indexedResults) ? indexedResults : [];
                    } catch (indexedTokenOwnerRecordsError) {
                        console.log('ERR(getAllTokenOwnerRecords indexed): ', indexedTokenOwnerRecordsError);
                    }

                    if (indexedTokenOwnerRecords.length > 0) {
                        trecords = indexedTokenOwnerRecords;
                        debugInfo.memberSource = 'index';
                    } else {
                        try {
                            rpcTokenOwnerRecords = await getAllTokenOwnerRecords(
                                RPC_CONNECTION,
                                new PublicKey(realmOwnerString),
                                realmPk
                            );
                        } catch (rpcTokenOwnerRecordsError) {
                            console.log('ERR(getAllTokenOwnerRecords rpc): ', rpcTokenOwnerRecordsError);
                        }
                        trecords = rpcTokenOwnerRecords;
                        debugInfo.memberSource = 'rpc';
                    }
                }

                debugInfo.indexedRecordCount = indexedTokenOwnerRecords.length;
                debugInfo.rpcRecordCount = rpcTokenOwnerRecords.length;
                
                //console.log("indexTokenOwnerRecords: ("+indexedTokenOwnerRecords.length+") "+JSON.stringify(indexedTokenOwnerRecords));
                //console.log("grealm: "+JSON.stringify(grealm))
                let hasVoterWeight = false;
                if (grealm?.account?.config?.useCommunityVoterWeightAddin){
                    console.log("Has Voter Weight Plugin!");
                    hasVoterWeight = true;
                }

                let hasMaxVoterWeight = false;
                if (grealm?.account?.config?.useMaxCommunityVoterWeightAddin){
                    console.log("Has MAX Voter Weight Addin!");
                    hasMaxVoterWeight = true;
                }
                
                {
                    // generate a super array with merged information
                    const participantMap = new Map<string, any>();
                    let tVotes = 0;
                    let tCouncilVotes = 0;
                    let tVotesCasted = 0;
                    let tDepositedCouncilVotesCasted = 0;
                    const activeParticipantOwners = new Set<string>();
                    const depositedParticipantOwners = new Set<string>();
                    let csvFile = '';
                    const councilMintString = grealm.account.config?.councilMint
                        ? new PublicKey(grealm.account.config.councilMint).toBase58()
                        : null;

                    for (let cntr = 0; cntr < trecords.length; cntr++) {
                        const record = trecords[cntr];
                        if (
                            cntr % LARGE_REALM_PROGRESS_INTERVAL === 0 ||
                            cntr === trecords.length - 1
                        ) {
                            setRecordCount(`${cntr + 1} of ${trecords.length}`);
                        }

                        const ownerPk = new PublicKey(record.account.governingTokenOwner);
                        const owner = ownerPk.toBase58();
                        const governingTokenMintPk = new PublicKey(record.account.governingTokenMint);
                        const governingTokenMintString = governingTokenMintPk.toBase58();
                        const isCouncilToken = !!councilMintString && governingTokenMintString === councilMintString;
                        const walletBalanceAmount = getWalletBalanceAmountUi(record);
                        const totalVotesCount = Number(record.account?.totalVotesCount ?? 0);
                        const governingTokenDepositAmount = Number(
                            record.account?.governingTokenDepositAmount ?? 0
                        );

                        const existingParticipant = participantMap.get(owner);
                        if (!existingParticipant) {
                            participantMap.set(owner, {
                                pubkey: new PublicKey(record.pubkey),
                                governanceDelegate: record.account?.governanceDelegate
                                    ? new PublicKey(record.account.governanceDelegate)
                                    : null,
                                governingTokenMint: isCouncilToken ? null : governingTokenMintPk,
                                governingTokenOwner: ownerPk,
                                totalVotesCount: isCouncilToken ? 0 : totalVotesCount,
                                councilVotesCount: isCouncilToken ? totalVotesCount : 0,
                                governingTokenDepositAmount: isCouncilToken
                                    ? new BN(0)
                                    : governingTokenDepositAmount,
                                governingCouncilDepositAmount: isCouncilToken
                                    ? governingTokenDepositAmount
                                    : new BN(0),
                                walletBalanceAmount,
                            });
                        } else {
                            existingParticipant.governanceDelegate = record.account?.governanceDelegate
                                ? new PublicKey(record.account.governanceDelegate)
                                : existingParticipant.governanceDelegate;

                            if (!isCouncilToken) {
                                existingParticipant.governingTokenMint = governingTokenMintPk;
                                existingParticipant.totalVotesCount = totalVotesCount;
                                existingParticipant.governingTokenDepositAmount =
                                    governingTokenDepositAmount;
                            } else {
                                existingParticipant.councilVotesCount = totalVotesCount;
                                existingParticipant.governingCouncilDepositAmount =
                                    governingTokenDepositAmount;
                            }

                            if (
                                record.account.governingTokenMint === record.walletBalance?.mint ||
                                (!existingParticipant.walletBalanceAmount && walletBalanceAmount)
                            ) {
                                existingParticipant.walletBalanceAmount = walletBalanceAmount;
                            }
                        }

                        if (totalVotesCount > 0) {
                            activeParticipantOwners.add(owner);
                        }
                        if (governingTokenDepositAmount > 0) {
                            depositedParticipantOwners.add(owner);
                        }

                        if (!isCouncilToken) {
                            tVotes += governingTokenDepositAmount;
                            tVotesCasted += totalVotesCount;
                        } else {
                            tCouncilVotes += totalVotesCount;
                            tDepositedCouncilVotesCasted += governingTokenDepositAmount;
                        }
                    }
                    let participantArray = Array.from(participantMap.values());
                    const tParticipants = participantArray.length;
                    const aParticipants = activeParticipantOwners.size;
                    const lParticipants = depositedParticipantOwners.size;
                    const tUnstakedVotes = participantArray.reduce(
                        (sum: number, participant: any) =>
                            sum + Number(participant?.walletBalanceAmount || 0),
                        0
                    );
                    let enrichedParticipants = participantArray;
                    let effectiveDepositedVotes = tVotes;
                    let effectiveActiveParticipants = lParticipants;
                    let effectiveVsrTokenDecimals: number | null = null;
                    let effectiveVsrVotingPowerDecimals: number | null = null;
                    const resolvedHasPluginPower =
                        resolvedIsVsrPluginRealm || resolvedIsStakingPluginRealm;

                    if (resolvedIsVsrPluginRealm && voterWeightAddin && participantArray.length > 0) {
                        try {
                            const vsrData = await fetchVsrMemberStats(
                                realmPk,
                                new PublicKey(grealm.account.communityMint),
                                new PublicKey(voterWeightAddin),
                                participantArray
                            );

                            if (vsrData) {
                                enrichedParticipants = participantArray.map((participant: any) => {
                                    const owner = participant.governingTokenOwner.toBase58();
                                    const stats = vsrData.memberStats?.[owner];

                                    return {
                                        ...participant,
                                        vsrDepositedAmount: Number(stats?.depositedNative || 0),
                                        vsrLockedAmount: Number(stats?.lockedNative || 0),
                                        vsrWithdrawableAmount: Number(stats?.withdrawableNative || 0),
                                        vsrDepositCount: Number(stats?.depositCount || 0),
                                        vsrVotingPower: Number(stats?.voterWeightNative || 0),
                                        vsrVotingPowerApproximate: !!stats?.voterWeightApproximate,
                                        vsrVotingPowerRecord: !!stats?.voterWeightRecordFound,
                                        vsrDisplayDecimals: stats?.displayDecimals ?? null,
                                        vsrVotingPowerDecimals:
                                            stats?.votingPowerDisplayDecimals ?? null,
                                    };
                                });
                                effectiveDepositedVotes = Number(vsrData.totals?.totalDepositedNative || 0);
                                effectiveActiveParticipants = Number(vsrData.totals?.activeParticipants || 0);
                                effectiveVsrTokenDecimals = Number(
                                    vsrData?.summaryDisplayConfig?.depositDecimals ?? thisTokenDecimals
                                );
                                effectiveVsrVotingPowerDecimals = Number(
                                    vsrData?.summaryDisplayConfig?.votingPowerDecimals ??
                                    effectiveVsrTokenDecimals
                                );
                                setVsrTokenDecimals(effectiveVsrTokenDecimals);
                                setVsrVotingPowerDecimals(effectiveVsrVotingPowerDecimals);
                                setVsrSummary(vsrData.totals);
                            }
                        } catch (vsrError) {
                            console.log("Failed to load VSR member stats: ", vsrError);
                            setVsrTokenDecimals(null);
                            setVsrVotingPowerDecimals(null);
                            setVsrSummary({
                                totalDepositedNative: 0,
                                totalLockedNative: 0,
                                totalWithdrawableNative: 0,
                                activeParticipants: 0,
                            });
                        }
                    } else if (resolvedIsStakingPluginRealm && voterWeightAddin && participantArray.length > 0) {
                        try {
                            const stakingData = await fetchStakingPluginMemberStats(
                                realmPk,
                                new PublicKey(voterWeightAddin),
                                participantArray
                            );

                            if (stakingData) {
                                enrichedParticipants = participantArray.map((participant: any) => {
                                    const owner = participant.governingTokenOwner.toBase58();
                                    const stats = stakingData.memberStats?.[owner];

                                    return {
                                        ...participant,
                                        vsrDepositedAmount: Number(stats?.depositedNative || 0),
                                        vsrLockedAmount: Number(stats?.lockedNative || 0),
                                        vsrWithdrawableAmount: 0,
                                        vsrDepositCount: Number(stats?.depositCount || 0),
                                        vsrVotingPower: Number(stats?.voterWeightNative || 0),
                                        vsrVotingPowerApproximate: false,
                                        vsrVotingPowerRecord: !!stats?.voterWeightRecordFound,
                                        vsrDisplayDecimals: thisTokenDecimals,
                                        vsrVotingPowerDecimals: thisTokenDecimals,
                                    };
                                });
                                effectiveDepositedVotes = Number(stakingData.totals?.totalDepositedNative || 0);
                                effectiveActiveParticipants = Number(stakingData.totals?.activeParticipants || 0);
                                effectiveVsrTokenDecimals = thisTokenDecimals;
                                effectiveVsrVotingPowerDecimals = thisTokenDecimals;
                                setVsrTokenDecimals(effectiveVsrTokenDecimals);
                                setVsrVotingPowerDecimals(effectiveVsrVotingPowerDecimals);
                                setVsrSummary({
                                    totalDepositedNative: Number(stakingData.totals?.totalDepositedNative || 0),
                                    totalLockedNative: Number(stakingData.totals?.totalLockedNative || 0),
                                    totalWithdrawableNative: 0,
                                    activeParticipants: Number(stakingData.totals?.activeParticipants || 0),
                                });
                            }
                        } catch (stakingError) {
                            console.log("Failed to load staking plugin member stats: ", stakingError);
                            setVsrTokenDecimals(null);
                            setVsrVotingPowerDecimals(null);
                            setVsrSummary({
                                totalDepositedNative: 0,
                                totalLockedNative: 0,
                                totalWithdrawableNative: 0,
                                activeParticipants: 0,
                            });
                        }
                    }

                    let pcount = 0;
                    for (let singleParticipant of enrichedParticipants){
                            if (pcount > 0)
                                csvFile += '\r\n';
                            else
                                csvFile = 'Member,VotesDeposited,LegacyVotesDeposited,TokenDecimals,RawVotesDeposited,RawLegacyVotesDeposited,CouncilVotesDeposited,VsrLockedRaw,VsrWithdrawableRaw\r\n';
                            
                            const rawDepositedAmount = resolvedHasPluginPower
                                ? Number(singleParticipant?.vsrDepositedAmount ?? 0)
                                : Number(singleParticipant?.governingTokenDepositAmount ?? 0);
                            const rawLegacyDepositedAmount = Number(singleParticipant?.governingTokenDepositAmount ?? 0);
                            const participantDisplayDecimals = resolvedHasPluginPower
                                ? Number(
                                    singleParticipant?.vsrDisplayDecimals ??
                                    effectiveVsrTokenDecimals ??
                                    thisTokenDecimals ??
                                    0
                                )
                                : thisTokenDecimals;
                            let formattedDepositedAmount = (+((rawDepositedAmount)/Math.pow(10, participantDisplayDecimals || 0)).toFixed(0));
                            let formattedLegacyDepositedAmount = (+((rawLegacyDepositedAmount)/Math.pow(10, thisTokenDecimals || 0)).toFixed(0));
                            //csvFile += record.account.governingTokenOwner.toBase58()+','+record.account.governingTokenDepositAmount.toNumber();
                            csvFile += singleParticipant.governingTokenOwner.toBase58()+','+formattedDepositedAmount+','+formattedLegacyDepositedAmount+','+participantDisplayDecimals+','+rawDepositedAmount+','+rawLegacyDepositedAmount+','+Number(singleParticipant?.governingCouncilDepositAmount ?? 0)+','+Number(singleParticipant?.vsrLockedAmount ?? 0)+','+Number(singleParticipant?.vsrWithdrawableAmount ?? 0);
                        
                            pcount++;
                    }

                    const jsonCSVString = encodeURI(`data:text/csv;chatset=utf-8,${csvFile}`);
                    //console.log("jsonCSVString: "+JSON.stringify(jsonCSVString));
                    
                    setCSVGenerated(jsonCSVString);
                    setRecordCount(null);
                    setTotalUnstakedVotes(tUnstakedVotes > 0 ? tUnstakedVotes : null);
                    setTotalDepositedVotes(effectiveDepositedVotes > 0 ? effectiveDepositedVotes : null);
                    setTotalVotesCasted(tVotesCasted > 0 ? tVotesCasted : null);
                    setTotalCouncilVotes(tCouncilVotes > 0 ? tCouncilVotes : null);
                    setDepositedTotalCouncilVotes(tDepositedCouncilVotesCasted > 0 ? tDepositedCouncilVotesCasted : null);
                    setTotalParticipants(tParticipants > 0 ? tParticipants : null);
                    setActiveParticipants(effectiveActiveParticipants > 0 ? effectiveActiveParticipants : null);
                    setVotingParticipants(aParticipants > 0 ? aParticipants : null);

                    //console.log("participantArray: "+JSON.stringify(participantArray));
                    const getDepositedAmount = (member: any) =>
                        resolvedHasPluginPower
                            ? Number(member?.vsrDepositedAmount ?? 0)
                            : Number(member?.governingTokenDepositAmount ?? 0);
                    const presortedResults = enrichedParticipants.sort((a,b) => (a.totalVotesCount > b.totalVotesCount) ? 1 : -1);
                    const sortedResults = presortedResults.sort((a,b) => (getDepositedAmount(a) < getDepositedAmount(b)) ? 1 : -1);

                    let top10 = null;
                    let count = 0;
                    let totalTopVotes = 0;
                    let totalTopSupply = 0;
                    let totalTopCirculatingSupply = 0;
                    let totalTopGovernanceSupply = 0;
                    const supplyAmount = Number(resolvedCirculatingSupply?.value?.amount || 0);
                    const topLevelDisplayDecimals =
                        effectiveVsrTokenDecimals ?? thisTokenDecimals ?? 0;
                    for (var member of sortedResults){
                        if (count < 10){
                            const memberDepositedAmount = getDepositedAmount(member);
                            const memberDisplayDecimals = resolvedHasPluginPower
                                ? Number(member?.vsrDisplayDecimals ?? topLevelDisplayDecimals)
                                : thisTokenDecimals;
                            totalTopVotes += memberDepositedAmount/Math.pow(10, memberDisplayDecimals || 0);
                            if (supplyAmount > 0){
                                totalTopCirculatingSupply += (memberDepositedAmount/supplyAmount)*100
                                totalTopGovernanceSupply += effectiveDepositedVotes > 0
                                    ? (memberDepositedAmount/effectiveDepositedVotes)*100
                                    : 0;
                            }
                        }
                        count++
                    }

                    top10 = {
                        votes:totalTopVotes,
                        percentageOfSupply:totalTopCirculatingSupply,
                        percentageOfGovernanceSupply:totalTopGovernanceSupply
                    }

                    if (top10)
                        setTop10Participants(top10);
                    setMembers(sortedResults);
                    debugInfo.vsrTokenDecimals = effectiveVsrTokenDecimals;
                    debugInfo.vsrVotingPowerDecimals = effectiveVsrVotingPowerDecimals;
                    debugInfo.finalMemberCount = sortedResults.length;
                }
            
            }catch(e){console.log("ERR: "+e); debugInfo.error = `${e}`;}
        
            const fetchedgspl = await initGrapeGovernanceDirectory();
            setGSPL(fetchedgspl);
            console.log("fetchedgspl: "+JSON.stringify(fetchedgspl));
            if (grealm){
                const resolvedMetadata = await resolveRealmMetadata(grealm, fetchedgspl).catch((error) => {
                    console.log('ERR(resolveRealmMetadata): ' + error);
                    return null;
                });
                if (resolvedMetadata){
                    setGSPLMetadata(resolvedMetadata);
                }
            }
            setMembersDebug(debugInfo);
        }
        setLoading(false);
        endTimer();
    }

    const startTimer = () => {
        setStartTime(Date.now());
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    React.useEffect(() => { 
        if (tokenMap && governanceAddress){  
            startTimer();
            getGovernanceMembers();
        }
    }, [tokenMap, governanceAddress]);

    React.useEffect(() => { 
        if (!loading){
            if (!tokenMap){
                getTokens();
            }
        }
    }, []);

    const allVotersCount = Number(totalParticipants || 0);
    const activeVotersCount = Number(activeParticipants || 0);
    const participatingVotersCount = Number(votingParticipants || 0);
    const activeVoterRate = allVotersCount > 0 ? (activeVotersCount / allVotersCount) * 100 : 0;
    const participatingVoterRate = allVotersCount > 0 ? (participatingVotersCount / allVotersCount) * 100 : 0;
    const isPluginPowerRealm = isVsrPluginRealm || isStakingPluginRealm;
    const isVsrRealm = isVsrPluginRealm;
    const depositDisplayDecimals = isPluginPowerRealm
        ? Number(vsrTokenDecimals ?? governingTokenDecimals ?? 0)
        : Number(governingTokenDecimals ?? 0);
    const communityVotesDepositedUi = totalDepositedVotes
        ? +((totalDepositedVotes) / Math.pow(10, depositDisplayDecimals || 0)).toFixed(0)
        : 0;
    const councilVotesDepositedUi = Number(totalDepositedCouncilVotes || 0);
    const vsrLockedUi = +((Number(vsrSummary?.totalLockedNative || 0)) / Math.pow(10, depositDisplayDecimals || 0)).toFixed(0);
    const vsrWithdrawableUi = +((Number(vsrSummary?.totalWithdrawableNative || 0)) / Math.pow(10, depositDisplayDecimals || 0)).toFixed(0);
    const top10Votes = Number(top10Participants?.votes || 0);
    const top10GovernanceShare = Number(top10Participants?.percentageOfGovernanceSupply || 0);
    const top10SupplyShare = Number(top10Participants?.percentageOfSupply || 0);
    const circulatingAmount = Number(circulatingSupply?.value?.amount || 0);
    const depositedCirculatingShare = circulatingAmount > 0 && totalDepositedVotes
        ? (Number(totalDepositedVotes) / circulatingAmount) * 100
        : null;
    const delegatedVotersCount = Array.isArray(members)
        ? members.reduce((count: number, member: any) => {
            try {
                const owner = member?.governingTokenOwner?.toBase58?.() || `${member?.governingTokenOwner || ''}`;
                const delegate = member?.governanceDelegate?.toBase58?.() || `${member?.governanceDelegate || ''}`;
                if (delegate && owner && delegate !== owner) return count + 1;
            } catch (e) {
                // ignore malformed member rows in delegation metric
            }
            return count;
        }, 0)
        : 0;
    const undelegatedVotersCount = Math.max(0, allVotersCount - delegatedVotersCount);
    const delegationRate = allVotersCount > 0 ? (delegatedVotersCount / allVotersCount) * 100 : 0;

    
        if(loading){
            return (
                <Box
                    sx={{
                        mt:6,
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '17px',
                        p:4,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Typography variant="caption">Loading Governance Members {governanceAddress}
                        <><br/>For DAOs with over 2k voters this may take a minute</>
                        {recordCount && 
                            <><br/>Record: {recordCount}</>}
                    </Typography>
                    
                    <LinearProgress color="inherit" />
                </Box>
            )
        } else{
            if (members){
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
                        }} 
                    > 
                        {realm &&
                            <>
                                <Grid container>
                                    <GovernanceHeaderView
                                        governanceName={realmName}
                                        governanceAddress={governanceAddress}
                                        gsplMetadata={gsplMetadata}
                                    />
                                    <Grid item xs={6} container justifyContent="flex-end">
                                        <GovernanceNavigation governanceAddress={governanceAddress} />
                                    </Grid>
                                </Grid>
                            </>
                        }
                        {realm && (
                            <Box sx={{ px: 1, pt: 0.5 }}>
                                <GovernancePower governanceAddress={governanceAddress} realm={realm} />
                            </Box>
                        )}
                        {pluginDao ?
                            <Box
                                sx={{
                                    mx: 1,
                                    mt: 0.5,
                                    mb: 1,
                                    p: 1.25,
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
                                }}
                            >
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.88)' }}>
                                    {isVsrRealm
                                        ? 'VoteStakeRegistry deposits are shown here as deposited, locked, and withdrawable balances. Legacy SPL governance deposits remain visible in a separate column so members can still track balances that may need to be withdrawn through the standard governance flow. Connected wallets can manage and withdraw unlocked VSR deposits from the governance power card above.'
                                        : 'This DAO uses a governance voter plugin. Member balances may include plugin-specific voting power in addition to standard SPL governance deposits.'}
                                </Typography>
                            </Box>
                        :
                            <></>
                        }
                        {debugVsr && membersDebug && (
                            <Box
                                sx={{
                                    mx: 1,
                                    mt: 0.5,
                                    mb: 1,
                                    p: 1.25,
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    background: 'rgba(255,255,255,0.04)',
                                }}
                            >
                                <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.72)', mb: 0.5 }}>
                                    VSR Debug
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.9)' }}>
                                    {JSON.stringify(membersDebug, null, 2)}
                                </Typography>
                            </Box>
                        )}
                            {(totalDepositedVotes || totalCouncilVotes) &&
                                <Box sx={{ p:1}}>
                                    <Grid container spacing={1}>
                                        <Grid item xs={12} sm={6} md={6} lg={3}>
                                            <Tooltip
                                                title={
                                                    <>
                                                        <strong>Active:</strong> currently staked members
                                                        <br />
                                                        <strong>Participating:</strong> members who casted votes
                                                        <br />
                                                        <strong>All:</strong> lifetime token owner records
                                                    </>
                                                }
                                            >
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        borderRadius: '16px',
                                                        m: 0,
                                                        p: 1.25,
                                                        height: '100%',
                                                        background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        cursor: 'help',
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: '#8ec5ff', letterSpacing: 0.25, textTransform: 'uppercase' }}>
                                                        Active / Participating / All Voters
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            mt: 0.35,
                                                            fontSize: '1.45rem',
                                                            fontWeight: 700,
                                                            lineHeight: 1.15,
                                                            color: 'rgba(255,255,255,0.96)',
                                                        }}
                                                    >
                                                        {activeVotersCount}/{participatingVotersCount}/{allVotersCount}
                                                    </Typography>
                                                    <Box sx={{ mt: 1 }}>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(100, Math.max(0, activeVoterRate))}
                                                            sx={{
                                                                height: 6,
                                                                borderRadius: 99,
                                                                backgroundColor: 'rgba(255,255,255,0.14)',
                                                                '& .MuiLinearProgress-bar': {
                                                                    borderRadius: 99,
                                                                    backgroundColor: '#8ec5ff',
                                                                },
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.55, color: 'rgba(255,255,255,0.66)' }}>
                                                        {activeVoterRate.toFixed(1)}% active • {participatingVoterRate.toFixed(1)}% participating
                                                    </Typography>
                                                </Paper>
                                            </Tooltip>
                                        </Grid>

                                        <Grid item xs={12} sm={6} md={6} lg={3}>
                                            <Tooltip
                                                title={
                                                    <>
                                                        Top 10 holders by deposited community votes.
                                                        <br />
                                                        Shows concentration of governance power.
                                                    </>
                                                }
                                            >
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        borderRadius: '16px',
                                                        m: 0,
                                                        p: 1.25,
                                                        height: '100%',
                                                        background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        cursor: 'help',
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: '#72d38c', letterSpacing: 0.25, textTransform: 'uppercase' }}>
                                                        Top 10 Deposited Votes
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            mt: 0.35,
                                                            fontSize: '1.45rem',
                                                            fontWeight: 700,
                                                            lineHeight: 1.15,
                                                            color: 'rgba(255,255,255,0.96)',
                                                        }}
                                                    >
                                                        {getFormattedNumberToLocale(+(top10Votes.toFixed(0)))}
                                                    </Typography>
                                                    <Box sx={{ mt: 1 }}>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(100, Math.max(0, top10GovernanceShare))}
                                                            sx={{
                                                                height: 6,
                                                                borderRadius: 99,
                                                                backgroundColor: 'rgba(255,255,255,0.14)',
                                                                '& .MuiLinearProgress-bar': {
                                                                    borderRadius: 99,
                                                                    backgroundColor: '#72d38c',
                                                                },
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.55, color: 'rgba(255,255,255,0.66)' }}>
                                                        {top10GovernanceShare.toFixed(1)}% of deposited
                                                        {top10SupplyShare > 0 ? ` • ${top10SupplyShare.toFixed(1)}% of supply` : ''}
                                                    </Typography>
                                                </Paper>
                                            </Tooltip>
                                        </Grid>

                                        <Grid item xs={12} sm={6} md={6} lg={3}>
                                            <Tooltip
                                                title={
                                                    <>
                                                        Total votes currently deposited in governance.
                                                        <br />
                                                        Community / Council split when council exists.
                                                    </>
                                                }
                                            >
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        borderRadius: '16px',
                                                        m: 0,
                                                        p: 1.25,
                                                        height: '100%',
                                                        background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        cursor: 'help',
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: '#f8bc72', letterSpacing: 0.25, textTransform: 'uppercase' }}>
                                                        Total Votes Deposited
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            mt: 0.35,
                                                            fontSize: '1.45rem',
                                                            fontWeight: 700,
                                                            lineHeight: 1.15,
                                                            color: 'rgba(255,255,255,0.96)',
                                                        }}
                                                    >
                                                        {getFormattedNumberToLocale(communityVotesDepositedUi)}
                                                        {councilVotesDepositedUi > 0 ? ` / ${getFormattedNumberToLocale(councilVotesDepositedUi)}` : ''}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.55, color: 'rgba(255,255,255,0.66)' }}>
                                                        {isVsrRealm
                                                            ? `${getFormattedNumberToLocale(vsrLockedUi)} locked • ${getFormattedNumberToLocale(vsrWithdrawableUi)} withdrawable`
                                                            : totalUnstakedVotes
                                                            ? `${getFormattedNumberToLocale(totalUnstakedVotes)} unstaked in wallets`
                                                            : 'No unstaked amount found'}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.66)' }}>
                                                        {depositedCirculatingShare !== null
                                                            ? `${depositedCirculatingShare.toFixed(1)}% of circulating supply`
                                                            : 'Circulating supply unavailable'}
                                                    </Typography>
                                                </Paper>
                                            </Tooltip>
                                        </Grid>

                                        <Grid item xs={12} sm={6} md={6} lg={3}>
                                            <Tooltip
                                                title={
                                                    <>
                                                        Voters that delegated governance power to another wallet.
                                                        <br />
                                                        Excludes self-delegation.
                                                    </>
                                                }
                                            >
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        borderRadius: '16px',
                                                        m: 0,
                                                        p: 1.25,
                                                        height: '100%',
                                                        background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        cursor: 'help',
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: '#dcb3ff', letterSpacing: 0.25, textTransform: 'uppercase' }}>
                                                        Delegated Voters / Rate
                                                    </Typography>
                                                    <Typography
                                                        sx={{
                                                            mt: 0.35,
                                                            fontSize: '1.45rem',
                                                            fontWeight: 700,
                                                            lineHeight: 1.15,
                                                            color: 'rgba(255,255,255,0.96)',
                                                        }}
                                                    >
                                                        {delegatedVotersCount}/{allVotersCount} • {delegationRate.toFixed(1)}%
                                                    </Typography>
                                                    <Box sx={{ mt: 1 }}>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(100, Math.max(0, delegationRate))}
                                                            sx={{
                                                                height: 6,
                                                                borderRadius: 99,
                                                                backgroundColor: 'rgba(255,255,255,0.14)',
                                                                '& .MuiLinearProgress-bar': {
                                                                    borderRadius: 99,
                                                                    backgroundColor: '#dcb3ff',
                                                                },
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.55, color: 'rgba(255,255,255,0.66)' }}>
                                                        {undelegatedVotersCount} direct voters
                                                        {participatingVotersCount ? ` • ${participatingVotersCount} participating` : ''}
                                                    </Typography>
                                                </Paper>
                                            </Tooltip>
                                        </Grid>
                                    </Grid>
                                </Box>
                            }

                        <RenderGovernanceMembersTable members={members} memberMap={null} participating={participating} tokenMap={tokenMap} pluginDao={isPluginPowerRealm} governingTokenMint={governingTokenMint} governingTokenDecimals={governingTokenDecimals} vsrTokenDecimals={vsrTokenDecimals} vsrVotingPowerDecimals={vsrVotingPowerDecimals} circulatingSupply={circulatingSupply} totalDepositedVotes={totalDepositedVotes} />
                    
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Realtime<br/>
                            </Typography>
                        }
                    </Box>
                                
                );
            }else{
                /*
                if (!participating){
                    return (
                        <Box
                            sx={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '17px',
                                p:4
                            }} 
                        > 
                            <Typography variant="h4">
                                You are not participating in this governance
                            </Typography>
                        </Box>
                    );
                } else {
                    */
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '17px',
                            p:4,
                            alignItems: 'center', textAlign: 'center'
                        }} 
                    > 
                        <Typography variant="caption">Governance Members {governanceAddress}</Typography>
                        
                    </Box>
                );
                
            }
            
        }
    
}
