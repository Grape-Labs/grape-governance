import React from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { styled } from '@mui/material/styles';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from '@solana/spl-token-v2';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  ListItemIcon,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material/';
import LanguageIcon from '@mui/icons-material/Language';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useSnackbar } from 'notistack';
import AdvancedProposalView from './AdvancedProposalView';
import {
  getHashedName,
  getNameAccountKey,
  NameRegistryState,
  ROOT_DOMAIN_ACCOUNT,
  NAME_PROGRAM_ID,
  BONFIDA_FIDA_BNB,
  createSubdomain,
  getDomainKeysWithReverses,
  getTokenizedDomains,
  performReverseLookupBatch,
  registerDomainName,
  transferSubdomain,
  transferInstruction,
} from '../../../utils/web3/snsCompat';

type Mode = 'register' | 'ownership' | 'subdomain';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

function sanitizeDomainLabel(input: string): string {
  const value = `${input || ''}`.trim().toLowerCase();
  if (!value) return '';
  return value.endsWith('.sol') ? value.slice(0, -4) : value;
}

function isValidDomainLabel(label: string): boolean {
  // Keep this strict for treasury proposals: lowercase ascii labels, 1..63 chars.
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

function toPk(value: any): string {
  try {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value?.toBase58) return value.toBase58();
    return new PublicKey(value).toBase58();
  } catch {
    return '';
  }
}

function normalizeDomainName(value: any): string {
  const cleaned = String(value || '').replace(/\0/g, '').trim().toLowerCase();
  if (!cleaned || cleaned.includes(' ')) return '';
  if (cleaned.endsWith('.sol')) return cleaned;
  if (/^[a-z0-9][a-z0-9._-]{0,250}$/i.test(cleaned)) {
    return `${cleaned}.sol`;
  }
  return '';
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function SnsDomainView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [tab, setTab] = React.useState<Mode>('register');
  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(true);
  const [proposalTitle, setProposalTitle] = React.useState<string | null>('Manage SNS Domain');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>('Manage Bonfida SNS domain registration or ownership.');
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);

  const [registerDomain, setRegisterDomain] = React.useState('');
  const [registerSpace, setRegisterSpace] = React.useState<number>(1000);
  const [registerBuyer, setRegisterBuyer] = React.useState('');
  const [registerBuyerTokenAccount, setRegisterBuyerTokenAccount] = React.useState('');
  const [fidaMint, setFidaMint] = React.useState('');
  const [buyerFidaAtaExists, setBuyerFidaAtaExists] = React.useState<boolean | null>(null);
  const [buyerFidaAtaAmountUi, setBuyerFidaAtaAmountUi] = React.useState<string>('');
  const [autoFidaLoading, setAutoFidaLoading] = React.useState(false);
  const [buyerSignerSystemOk, setBuyerSignerSystemOk] = React.useState<boolean | null>(null);

  const [ownershipDomain, setOwnershipDomain] = React.useState('');
  const [newDomainOwner, setNewDomainOwner] = React.useState('');
  const [currentOwnerSigner, setCurrentOwnerSigner] = React.useState('');
  const [subdomainLabel, setSubdomainLabel] = React.useState('');
  const [subdomainParent, setSubdomainParent] = React.useState('');
  const [subdomainOwner, setSubdomainOwner] = React.useState('');
  const [subdomainSpace, setSubdomainSpace] = React.useState<number>(1000);
  const [subdomainOwnerSigner, setSubdomainOwnerSigner] = React.useState('');
  const [ownedDomains, setOwnedDomains] = React.useState<string[]>([]);
  const [loadingOwnedDomains, setLoadingOwnedDomains] = React.useState(false);

  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupDomain, setLookupDomain] = React.useState('');
  const [lookupNameAccount, setLookupNameAccount] = React.useState('');
  const [lookupExists, setLookupExists] = React.useState<boolean | null>(null);
  const [lookupRegistryOwner, setLookupRegistryOwner] = React.useState('');
  const [lookupNftOwner, setLookupNftOwner] = React.useState('');

  const stopInputKeyPropagation = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account?.config?.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
    }
  };

  React.useEffect(() => {
    if (!open) return;

    setIsGoverningMintSelectable(false);

    const hasCouncil = !!realm?.account?.config?.councilMint;
    const hasCommunity = !!(realm?.account?.communityMint || realm?.communityMint);
    const canUseCommunity =
      hasCommunity &&
      Number(rulesWallet?.account?.config?.minCommunityTokensToCreateProposal) !== 18446744073709551615;

    if (hasCouncil && canUseCommunity) {
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
      setIsGoverningMintSelectable(true);
      setIsGoverningMintCouncilSelected(false);
    } else if (hasCouncil) {
      setGoverningMint(realm?.account?.config?.councilMint);
      setIsGoverningMintCouncilSelected(true);
    } else if (hasCommunity) {
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
      setIsGoverningMintCouncilSelected(false);
    }

    const defaultBuyer = toPk(governanceNativeWallet) || toPk(rulesWallet?.pubkey);
    const defaultOwnerSigner = toPk(rulesWallet?.pubkey) || defaultBuyer;
    setRegisterBuyer(defaultBuyer);
    setCurrentOwnerSigner(defaultOwnerSigner);
    setSubdomainOwnerSigner(defaultBuyer);
    setSubdomainOwner(defaultBuyer);
  }, [open, realm, rulesWallet, governanceNativeWallet]);

  const autoFillBuyerFidaAccount = React.useCallback(
    async (buyerAddressOverride?: string) => {
      const buyerAddress = (buyerAddressOverride || registerBuyer || '').trim();
      if (!buyerAddress) return;
      try {
        setAutoFidaLoading(true);
        const buyerPk = new PublicKey(buyerAddress);

        const buyerInfo = await connection.getAccountInfo(buyerPk);
        const isSystemOwnedDataless =
          !!buyerInfo && buyerInfo.owner.equals(SystemProgram.programId) && buyerInfo.data.length === 0;
        setBuyerSignerSystemOk(isSystemOwnedDataless);

        let mintPk: PublicKey;
        if (fidaMint) {
          mintPk = new PublicKey(fidaMint);
        } else {
          // BONFIDA_FIDA_BNB is a FIDA token account; read mint directly from it.
          const vaultAccount = await getAccount(connection as any, BONFIDA_FIDA_BNB);
          mintPk = vaultAccount.mint;
          setFidaMint(mintPk.toBase58());
        }

        // Buyer can be a PDA/governance account, so allow off-curve owners.
        const buyerAta = await getAssociatedTokenAddress(mintPk, buyerPk, true);
        setRegisterBuyerTokenAccount(buyerAta.toBase58());

        const ataInfo = await connection.getAccountInfo(buyerAta);
        if (!ataInfo) {
          setBuyerFidaAtaExists(false);
          setBuyerFidaAtaAmountUi('');
          return;
        }

        const buyerAtaAccount = await getAccount(connection as any, buyerAta);
        setBuyerFidaAtaExists(true);
        setBuyerFidaAtaAmountUi((Number(buyerAtaAccount.amount.toString()) / 1_000_000).toLocaleString());
      } catch {
        setBuyerSignerSystemOk(null);
        setBuyerFidaAtaExists(null);
        setBuyerFidaAtaAmountUi('');
      } finally {
        setAutoFidaLoading(false);
      }
    },
    [registerBuyer, fidaMint, connection]
  );

  const resolveFidaMint = React.useCallback(async (): Promise<PublicKey> => {
    if (fidaMint) return new PublicKey(fidaMint);
    const vaultAccount = await getAccount(connection as any, BONFIDA_FIDA_BNB);
    const mintPk = vaultAccount.mint;
    setFidaMint(mintPk.toBase58());
    return mintPk;
  }, [fidaMint, connection]);

  React.useEffect(() => {
    if (!open) return;
    if (!registerBuyer) return;
    autoFillBuyerFidaAccount(registerBuyer);
  }, [open, registerBuyer, autoFillBuyerFidaAccount]);

  React.useEffect(() => {
    const fallbackTitle =
      tab === 'register'
        ? 'Register SNS Domain'
        : tab === 'ownership'
        ? 'Transfer SNS Domain Ownership'
        : 'Create SNS Subdomain';
    const fallbackDesc =
      tab === 'register'
        ? 'Register a Bonfida .sol domain for this governance.'
        : tab === 'ownership'
        ? 'Transfer Bonfida .sol domain ownership to a new owner.'
        : 'Create and assign a Bonfida SNS subdomain to a wallet.';
    if (!proposalTitle || proposalTitle === 'Manage SNS Domain') setProposalTitle(fallbackTitle);
    if (!proposalDescription || proposalDescription === 'Manage Bonfida SNS domain registration or ownership.')
      setProposalDescription(fallbackDesc);
  }, [tab, proposalTitle, proposalDescription]);

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const doLookup = React.useCallback(
    async (rawInput: string) => {
      const label = sanitizeDomainLabel(rawInput);
      if (!label || !isValidDomainLabel(label)) {
        enqueueSnackbar('Enter a valid domain label (example: grape).', { variant: 'error' });
        return null;
      }

      try {
        setLookupLoading(true);
        const hashed = await getHashedName(label);
        const nameAccount = await getNameAccountKey(hashed, undefined, ROOT_DOMAIN_ACCOUNT);
        const info = await connection.getAccountInfo(nameAccount);

        setLookupDomain(label);
        setLookupNameAccount(nameAccount.toBase58());

        if (!info) {
          setLookupExists(false);
          setLookupRegistryOwner('');
          setLookupNftOwner('');
          return {
            label,
            nameAccount,
            exists: false,
            registryOwner: '',
            nftOwner: '',
          };
        }

        const registry = await NameRegistryState.retrieve(connection, nameAccount);
        const registryOwner = toPk(registry?.registry?.owner);
        const nftOwner = toPk(registry?.nftOwner);

        setLookupExists(true);
        setLookupRegistryOwner(registryOwner);
        setLookupNftOwner(nftOwner);

        return {
          label,
          nameAccount,
          exists: true,
          registryOwner,
          nftOwner,
        };
      } catch (e: any) {
        console.error(e);
        enqueueSnackbar(e?.message || 'Domain lookup failed', { variant: 'error' });
        return null;
      } finally {
        setLookupLoading(false);
      }
    },
    [connection, enqueueSnackbar]
  );

  const handleBuildRegister = async () => {
    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    const label = sanitizeDomainLabel(registerDomain);
    if (!label || !isValidDomainLabel(label)) {
      enqueueSnackbar('Enter a valid domain label to register (without .sol).', { variant: 'error' });
      return;
    }

    let buyerPk: PublicKey;
    try {
      buyerPk = new PublicKey((registerBuyer || '').trim());
    } catch {
      enqueueSnackbar('Buyer signer must be a valid public key.', { variant: 'error' });
      return;
    }

    const buyerInfo = await connection.getAccountInfo(buyerPk);
    if (!buyerInfo || !buyerInfo.owner.equals(SystemProgram.programId) || buyerInfo.data.length !== 0) {
      enqueueSnackbar(
        'Buyer signer must be a system wallet account with no data (use governance native treasury wallet).',
        { variant: 'error' }
      );
      return;
    }

    let buyerTokenPk: PublicKey;
    let fidaMintPk: PublicKey;
    try {
      fidaMintPk = await resolveFidaMint();
      // Always use canonical ATA for buyer + FIDA mint to reduce simulation/account mismatch issues.
      buyerTokenPk = await getAssociatedTokenAddress(fidaMintPk, buyerPk, true);
      setRegisterBuyerTokenAccount(buyerTokenPk.toBase58());
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'Failed to derive buyer FIDA ATA.', { variant: 'error' });
      return;
    }

    const info = await doLookup(label);
    if (!info) return;
    if (info.exists) {
      enqueueSnackbar(`${label}.sol already exists.`, { variant: 'error' });
      return;
    }

    try {
      const preIxs = [];
      const ataInfo = await connection.getAccountInfo(buyerTokenPk);
      if (!ataInfo) {
        preIxs.push(
          createAssociatedTokenAccountInstruction(
            buyerPk, // payer
            buyerTokenPk, // ata
            buyerPk, // owner
            fidaMintPk // mint
          )
        );
      }

      const [setupIxs, registerIxs] = await registerDomainName(
        label,
        Math.max(1, Math.floor(Number(registerSpace) || 1)),
        buyerPk,
        buyerTokenPk,
        connection as any,
        fidaMintPk
      );
      const ix = [...preIxs, ...(setupIxs || []), ...(registerIxs || [])];
      if (!ix.length) {
        enqueueSnackbar('No SNS registration instructions were returned.', { variant: 'error' });
        return;
      }

      setInstructions({
        title: (proposalTitle || '').trim() || `Register ${label}.sol`,
        description:
          (proposalDescription || '').trim() ||
          `Register ${label}.sol via Bonfida SNS using buyer ${buyerPk.toBase58()} and token account ${buyerTokenPk.toBase58()}.`,
        ix,
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        allowMissingAccountsPreflight: true,
        draft: isDraft,
        editProposalAddress,
      });
      setExpandedLoader(true);
      handleClose();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to build domain registration instructions', { variant: 'error' });
    }
  };

  const handleBuildTransferOwner = async () => {
    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    const label = sanitizeDomainLabel(ownershipDomain);
    if (!label || !isValidDomainLabel(label)) {
      enqueueSnackbar('Enter a valid existing domain label (without .sol).', { variant: 'error' });
      return;
    }

    let nextOwnerPk: PublicKey;
    let signerPk: PublicKey;
    try {
      nextOwnerPk = new PublicKey((newDomainOwner || '').trim());
      signerPk = new PublicKey((currentOwnerSigner || '').trim());
    } catch {
      enqueueSnackbar('New owner and current owner signer must be valid public keys.', { variant: 'error' });
      return;
    }

    const info = await doLookup(label);
    if (!info) return;
    if (!info.exists) {
      enqueueSnackbar(`${label}.sol does not exist on SNS.`, { variant: 'error' });
      return;
    }

    if (info.registryOwner && signerPk.toBase58() !== info.registryOwner) {
      enqueueSnackbar(
        `Signer mismatch: on-chain owner is ${info.registryOwner}. Set Current Owner Signer to the actual owner.`,
        { variant: 'error' }
      );
      return;
    }

    try {
      const ix = transferInstruction(
        NAME_PROGRAM_ID,
        info.nameAccount,
        nextOwnerPk,
        signerPk,
        undefined,
        ROOT_DOMAIN_ACCOUNT
      );

      setInstructions({
        title: (proposalTitle || '').trim() || `Transfer ${label}.sol Ownership`,
        description:
          (proposalDescription || '').trim() ||
          `Transfer ${label}.sol owner from ${signerPk.toBase58()} to ${nextOwnerPk.toBase58()}.`,
        ix: [ix],
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
      });
      setExpandedLoader(true);
      handleClose();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to build ownership transfer instruction', { variant: 'error' });
    }
  };

  const loadOwnedDomainsForSigner = React.useCallback(async () => {
    const signer = (subdomainOwnerSigner || '').trim();
    if (!signer) {
      enqueueSnackbar('Set Parent Owner Signer first.', { variant: 'error' });
      return;
    }
    try {
      setLoadingOwnedDomains(true);
      const signerPk = new PublicKey(signer);
      const domainSet = new Set<string>();

      // Fast path: SDK helpers that resolve domains for owner directly.
      try {
        const domainsWithReverses = await withTimeout(
          getDomainKeysWithReverses(connection as any, signerPk),
          12000,
          'SNS domain lookup'
        );
        for (const item of domainsWithReverses || []) {
          const normalized = normalizeDomainName(item?.domain);
          if (normalized) domainSet.add(normalized);
        }
      } catch (error) {
        console.log('SNS domain lookup fallback to RPC path', error);
      }

      // Include tokenized parent domains owned by signer.
      try {
        const tokenizedDomains = await withTimeout(
          getTokenizedDomains(connection as any, signerPk),
          12000,
          'SNS tokenized domain lookup'
        );
        for (const item of tokenizedDomains || []) {
          const normalized = normalizeDomainName(item?.reverse);
          if (normalized) domainSet.add(normalized);
        }
      } catch (error) {
        console.log('SNS tokenized domain lookup error', error);
      }

      // Include all domains directly owned by signer (roots + subdomains).
      // This catches subdomains that may not appear in root-domain helpers.
      try {
        const ownedDomainAccounts = await withTimeout(
          connection.getProgramAccounts(NAME_PROGRAM_ID, {
            dataSlice: { offset: 0, length: 0 },
            filters: [{ memcmp: { offset: 32, bytes: signerPk.toBase58() } }],
          }),
          12000,
          'SNS owned domains lookup'
        );

        if (ownedDomainAccounts.length) {
          const pubkeys = ownedDomainAccounts.map((item) => item.pubkey);
          const chunkSize = 75;
          for (let i = 0; i < pubkeys.length; i += chunkSize) {
            const chunk = pubkeys.slice(i, i + chunkSize);
            try {
              const names = await withTimeout(
                performReverseLookupBatch(connection as any, chunk),
                10000,
                'SNS owned reverse lookup'
              );
              for (const name of names || []) {
                const normalized = normalizeDomainName(name);
                if (normalized) domainSet.add(normalized);
              }
            } catch {
              // Skip failed chunk and keep partial results responsive.
            }
          }
        }
      } catch (error) {
        console.log('SNS owned domain account lookup error', error);
      }

      // Fallback for edge RPCs where SDK helper returns empty.
      if (!domainSet.size) {
        const domainAccounts = await withTimeout(
          connection.getProgramAccounts(NAME_PROGRAM_ID, {
            dataSlice: { offset: 0, length: 0 },
            filters: [
              { memcmp: { offset: 32, bytes: signerPk.toBase58() } },
              { memcmp: { offset: 0, bytes: ROOT_DOMAIN_ACCOUNT.toBase58() } },
            ],
          }),
          12000,
          'SNS program accounts lookup'
        );

        if (domainAccounts.length) {
          const pubkeys = domainAccounts.map((item) => item.pubkey);
          const chunkSize = 75;

          for (let i = 0; i < pubkeys.length; i += chunkSize) {
            const chunk = pubkeys.slice(i, i + chunkSize);
            try {
              const names = await withTimeout(
                performReverseLookupBatch(connection as any, chunk),
                10000,
                'SNS reverse lookup'
              );
              for (const name of names || []) {
                const normalized = normalizeDomainName(name);
                if (normalized) domainSet.add(normalized);
              }
            } catch {
              // Skip failed chunk to keep UI responsive and avoid long hangs.
            }
          }
        }
      }

      const cleaned = Array.from(domainSet).sort((a, b) => a.localeCompare(b));
      setOwnedDomains(cleaned);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed loading owned domains', { variant: 'error' });
      setOwnedDomains([]);
    } finally {
      setLoadingOwnedDomains(false);
    }
  }, [subdomainOwnerSigner, connection, enqueueSnackbar]);

  const handleBuildSubdomain = async () => {
    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    const parentLabel = sanitizeDomainLabel(subdomainParent);
    const subLabel = sanitizeDomainLabel(subdomainLabel);
    if (!parentLabel || !isValidDomainLabel(parentLabel)) {
      enqueueSnackbar('Enter a valid parent domain (without .sol).', { variant: 'error' });
      return;
    }
    if (!subLabel || !isValidDomainLabel(subLabel)) {
      enqueueSnackbar('Enter a valid subdomain label.', { variant: 'error' });
      return;
    }

    let assignOwnerPk: PublicKey;
    let parentOwnerSignerPk: PublicKey;
    try {
      assignOwnerPk = new PublicKey((subdomainOwner || '').trim());
      parentOwnerSignerPk = new PublicKey((subdomainOwnerSigner || '').trim());
    } catch {
      enqueueSnackbar('Assigned owner and parent owner signer must be valid public keys.', { variant: 'error' });
      return;
    }

    try {
      const parentHashed = await getHashedName(parentLabel);
      const parentNameAccount = await getNameAccountKey(parentHashed, undefined, ROOT_DOMAIN_ACCOUNT);
      const parentInfo = await connection.getAccountInfo(parentNameAccount);
      if (!parentInfo) {
        enqueueSnackbar(`${parentLabel}.sol does not exist.`, { variant: 'error' });
        return;
      }

      const parentState = await NameRegistryState.retrieve(connection as any, parentNameAccount);
      const parentOwner = toPk(parentState?.registry?.owner);
      const parentNftOwner = toPk(parentState?.nftOwner);

      // Tokenized domains can have nftOwner as authority; allow either registry owner or nft owner.
      const allowedOwners = [parentOwner, parentNftOwner].filter(Boolean);
      if (allowedOwners.length > 0 && !allowedOwners.includes(parentOwnerSignerPk.toBase58())) {
        const shownOwner = allowedOwners.join(' / ');
        enqueueSnackbar(
          `Parent owner mismatch: ${parentLabel}.sol owner is ${shownOwner}. Set Parent Owner Signer to one of these wallets.`,
          { variant: 'error' }
        );
        return;
      }

      const subName = `\0${subLabel}`;
      const subHashed = await getHashedName(subName);
      const subNameAccount = await getNameAccountKey(subHashed, undefined, parentNameAccount);
      const existingSub = await connection.getAccountInfo(subNameAccount);
      if (existingSub) {
        enqueueSnackbar(`${subLabel}.${parentLabel}.sol already exists.`, { variant: 'error' });
        return;
      }

      let feePayerPk = parentOwnerSignerPk;
      try {
        const nativePk = new PublicKey(toPk(governanceNativeWallet) || '');
        const nativeInfo = await connection.getAccountInfo(nativePk);
        if (nativeInfo && nativeInfo.owner.equals(SystemProgram.programId) && nativeInfo.data.length === 0) {
          feePayerPk = nativePk;
        }
      } catch {
        // keep parent signer as fallback fee payer
      }

      const fqdn = `${subLabel}.${parentLabel}.sol`;
      const createIxs = await createSubdomain(
        connection as any,
        fqdn,
        parentOwnerSignerPk,
        Math.max(1, Math.floor(Number(subdomainSpace) || 1)),
        feePayerPk
      );
      const ix = [...createIxs];

      if (assignOwnerPk.toBase58() !== parentOwnerSignerPk.toBase58()) {
        const transferIx = await transferSubdomain(
          connection as any,
          fqdn,
          assignOwnerPk,
          false,
          parentOwnerSignerPk
        );
        ix.push(transferIx);
      }

      setInstructions({
        title: (proposalTitle || '').trim() || `Create ${subLabel}.${parentLabel}.sol`,
        description:
          (proposalDescription || '').trim() ||
          `Create subdomain ${subLabel}.${parentLabel}.sol and assign owner ${assignOwnerPk.toBase58()}.`,
        ix,
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        allowMissingAccountsPreflight: true,
        draft: isDraft,
        editProposalAddress,
      });
      setExpandedLoader(true);
      handleClose();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to build subdomain creation instruction', { variant: 'error' });
    }
  };

  return (
    <>
      <Tooltip title="Bonfida SNS Domain Tools" placement="right">
        <MenuItem onClick={publicKey ? () => setOpen(true) : undefined}>
          <ListItemIcon>
            <LanguageIcon fontSize="small" />
          </ListItemIcon>
          SNS Domains
        </MenuItem>
      </Tooltip>

      <BootstrapDialog
        fullWidth
        maxWidth="md"
        open={open}
        onClose={handleClose}
        onKeyDown={stopInputKeyPropagation}
        PaperProps={{
          style: {
            background: '#13151C',
            border: '1px solid rgba(255,255,255,0.05)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
          },
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2 }}>
          Bonfida SNS Domain Extension
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Register .sol domains and transfer existing domain ownership through governance proposals.
          </DialogContentText>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit" indicatorColor="secondary" sx={{ mb: 1.5 }}>
            <Tab value="register" label="Register Domain" />
            <Tab value="ownership" label="Ownership" />
            <Tab value="subdomain" label="Subdomain" />
          </Tabs>

          <FormControl fullWidth>
            <Grid container spacing={1.25}>
              {tab === 'register' ? (
                <>
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Domain Label (without .sol)"
                      value={registerDomain}
                      onChange={(e) => setRegisterDomain(sanitizeDomainLabel(e.target.value))}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Space (bytes)"
                      type="number"
                      value={registerSpace}
                      onChange={(e) => setRegisterSpace(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Buyer Signer (use governance native treasury wallet)"
                      value={registerBuyer}
                      onChange={(e) => setRegisterBuyer(e.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Buyer FIDA Token Account"
                      value={registerBuyerTokenAccount}
                      onChange={(e) => setRegisterBuyerTokenAccount(e.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => autoFillBuyerFidaAccount()}
                        disabled={autoFidaLoading || !registerBuyer}
                        sx={{ textTransform: 'none' }}
                      >
                        {autoFidaLoading ? 'Generating...' : 'Auto-generate Buyer FIDA ATA'}
                      </Button>
                      {buyerFidaAtaExists === true && (
                        <Chip
                          size="small"
                          color="success"
                          variant="outlined"
                          label={`Buyer ATA exists${buyerFidaAtaAmountUi ? ` • ${buyerFidaAtaAmountUi} FIDA` : ''}`}
                        />
                      )}
                      {buyerFidaAtaExists === false && (
                        <Chip size="small" color="warning" variant="outlined" label="Buyer ATA does not exist on-chain" />
                      )}
                      {buyerSignerSystemOk === false && (
                        <Chip
                          size="small"
                          color="error"
                          variant="outlined"
                          label="Buyer signer is not a system wallet account"
                        />
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      Note: SNS registration charges FIDA. Use a funded buyer signer and its FIDA ATA.
                    </Typography>
                  </Grid>
                </>
              ) : tab === 'ownership' ? (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Existing Domain Label (without .sol)"
                      value={ownershipDomain}
                      onChange={(e) => setOwnershipDomain(sanitizeDomainLabel(e.target.value))}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Button
                      fullWidth
                      onClick={() => doLookup(ownershipDomain)}
                      startIcon={<SearchIcon />}
                      sx={{ height: 40, borderRadius: '12px', textTransform: 'none' }}
                    >
                      Lookup Current Ownership
                    </Button>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Current Owner Signer (must match on-chain owner)"
                      value={currentOwnerSigner}
                      onChange={(e) => setCurrentOwnerSigner(e.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="New Owner Address"
                      value={newDomainOwner}
                      onChange={(e) => setNewDomainOwner(e.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                </>
              ) : (
                <>
                  <Grid item xs={12} md={7}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Parent Domain (without .sol)"
                      value={subdomainParent}
                      onChange={(e) => setSubdomainParent(sanitizeDomainLabel(e.target.value))}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Subdomain Label"
                      value={subdomainLabel}
                      onChange={(e) => setSubdomainLabel(sanitizeDomainLabel(e.target.value))}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Assign Subdomain To (wallet)"
                      value={subdomainOwner}
                      onChange={(e) => setSubdomainOwner(e.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Space (bytes)"
                      type="number"
                      value={subdomainSpace}
                      onChange={(e) => setSubdomainSpace(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Parent Owner Signer / Fee payer"
                      value={subdomainOwnerSigner}
                      onChange={(e) => setSubdomainOwnerSigner(e.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SearchIcon />}
                        onClick={loadOwnedDomainsForSigner}
                        disabled={loadingOwnedDomains || !(subdomainOwnerSigner || '').trim()}
                        sx={{ textTransform: 'none' }}
                      >
                        {loadingOwnedDomains ? 'Loading domains...' : 'Load Owned Parent Domains'}
                      </Button>
                      {!!ownedDomains.length && (
                        <TextField
                          select
                          size="small"
                          label="Owned Domains"
                          value=""
                          onChange={(e) => setSubdomainParent(sanitizeDomainLabel(e.target.value))}
                          sx={{ minWidth: 260 }}
                        >
                          {ownedDomains.map((domain) => (
                            <MenuItem key={domain} value={domain}>
                              {domain}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      This creates <b>{subdomainLabel || 'sub'}.{subdomainParent || 'parent'}.sol</b> and assigns ownership to the wallet above.
                      Parent owner signer must match on-chain parent domain owner.
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>
          </FormControl>

          {(lookupDomain || lookupNameAccount || lookupExists !== null) && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.1,
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                Lookup: {lookupDomain ? `${lookupDomain}.sol` : '-'}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                Name Account: {lookupNameAccount || '-'}
              </Typography>
              <Box sx={{ mt: 0.6, display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={lookupExists === null ? 'Unknown' : lookupExists ? 'Exists' : 'Available'}
                  color={lookupExists ? 'warning' : 'success'}
                  variant="outlined"
                />
                {lookupRegistryOwner ? (
                  <Chip size="small" label={`Registry Owner: ${lookupRegistryOwner.slice(0, 4)}...${lookupRegistryOwner.slice(-4)}`} />
                ) : null}
                {lookupNftOwner ? (
                  <Chip size="small" label={`NFT Owner: ${lookupNftOwner.slice(0, 4)}...${lookupNftOwner.slice(-4)}`} />
                ) : null}
              </Box>
            </Box>
          )}

          {openAdvanced ? (
            <Box sx={{ mt: 1.5 }}>
              <AdvancedProposalView
                governanceAddress={governanceAddress}
                proposalTitle={proposalTitle}
                setProposalTitle={setProposalTitle}
                proposalDescription={proposalDescription}
                setProposalDescription={setProposalDescription}
                toggleGoverningMintSelected={toggleGoverningMintSelected}
                isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
                isGoverningMintSelectable={isGoverningMintSelectable}
                isDraft={isDraft}
                setIsDraft={setIsDraft}
                setEditProposalAddress={setEditProposalAddress}
                editProposalAddress={editProposalAddress}
              />
            </Box>
          ) : null}

          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography variant="caption">Made with ❤️ by Grape</Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button
            size="small"
            onClick={() => setOpenAdvanced((v) => !v)}
            startIcon={<SettingsIcon sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px!important' }} />}
          >
            Advanced
          </Button>

          <Button
            autoFocus
            onClick={
              tab === 'register'
                ? handleBuildRegister
                : tab === 'ownership'
                ? handleBuildTransferOwner
                : handleBuildSubdomain
            }
            startIcon={tab === 'register' ? <AddCircleOutlineIcon /> : <ManageAccountsIcon />}
          >
            {tab === 'register'
              ? 'Create Register Proposal'
              : tab === 'ownership'
              ? 'Create Ownership Proposal'
              : 'Create Subdomain Proposal'}
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </>
  );
}
