import React from 'react';
import { Buffer } from 'buffer';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { styled } from '@mui/material/styles';
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
  InputLabel,
  ListItemIcon,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import DataObjectIcon from '@mui/icons-material/DataObject';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';
import AdvancedProposalView from './AdvancedProposalView';

const MYTHIC_METADATA_PROGRAM_ID = new PublicKey('metaThtkusoWYDvHBFXfvc93Z3d8iBeDZ4DVyq8SYVR');
const MYTHIC_NAMESPACE_SEED = Buffer.from('mythic_metadata');
const METADATA_SEED = Buffer.from('metadata');
const METADATA_KEY_SEED = Buffer.from('metadata_key');

const DISCRIMINATORS = {
  create_metadata_key: Buffer.from([97, 100, 204, 80, 145, 247, 25, 137]),
  create_metadata: Buffer.from([30, 35, 117, 134, 196, 139, 44, 25]),
  append_metadata_collection: Buffer.from([163, 163, 157, 88, 255, 177, 52, 176]),
  append_metadata_item: Buffer.from([75, 203, 140, 50, 250, 170, 232, 4]),
  append_metadata_items: Buffer.from([168, 131, 179, 9, 232, 98, 61, 250]),
  remove_metadata_collection: Buffer.from([150, 158, 202, 131, 20, 109, 210, 199]),
  remove_metadata_item: Buffer.from([210, 12, 49, 1, 201, 243, 253, 101]),
  set_collection_update_authority: Buffer.from([8, 139, 31, 243, 59, 214, 80, 110]),
  revoke_collection_update_authority: Buffer.from([202, 54, 83, 211, 193, 251, 218, 206]),
  update_metadata_item: Buffer.from([247, 110, 128, 152, 153, 217, 139, 170]),
};

type MythicAction =
  | 'create_metadata_key'
  | 'create_metadata'
  | 'append_metadata_collection'
  | 'append_metadata_item'
  | 'append_metadata_items'
  | 'remove_metadata_collection'
  | 'remove_metadata_item'
  | 'set_collection_update_authority'
  | 'revoke_collection_update_authority'
  | 'update_metadata_item';

type ByteEncoding = 'utf8' | 'base64' | 'hex';

const ACTION_LABELS: Record<MythicAction, string> = {
  create_metadata_key: 'Create Metadata Key',
  create_metadata: 'Create Metadata',
  append_metadata_collection: 'Append Metadata Collection',
  append_metadata_item: 'Append Metadata Item',
  append_metadata_items: 'Append Metadata Items',
  remove_metadata_collection: 'Remove Metadata Collection',
  remove_metadata_item: 'Remove Metadata Item',
  set_collection_update_authority: 'Set Collection Update Authority',
  revoke_collection_update_authority: 'Revoke Collection Update Authority',
  update_metadata_item: 'Update Metadata Item',
};

const ACTION_REQUIRES_PAYER = new Set<MythicAction>([
  'create_metadata_key',
  'create_metadata',
  'append_metadata_collection',
  'append_metadata_item',
  'append_metadata_items',
]);

const ACTION_REQUIRES_ISSUING_AUTHORITY = new Set<MythicAction>([
  'create_metadata',
  'append_metadata_collection',
  'append_metadata_item',
  'append_metadata_items',
  'remove_metadata_collection',
  'remove_metadata_item',
  'set_collection_update_authority',
  'revoke_collection_update_authority',
]);

const ACTION_REQUIRES_SUBJECT = new Set<MythicAction>([
  'create_metadata',
  'append_metadata_collection',
  'append_metadata_item',
  'append_metadata_items',
  'remove_metadata_collection',
  'remove_metadata_item',
  'set_collection_update_authority',
  'revoke_collection_update_authority',
  'update_metadata_item',
]);

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
  const { children, onClose, ...other } = props;
  return (
    <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuDialogContent-root': { padding: theme.spacing(2) },
  '& .MuDialogActions-root': { padding: theme.spacing(1) },
}));

function cleanValue(value: string): string {
  return `${value ?? ''}`.trim();
}

function toPublicKeySafe(value?: string | null): PublicKey | null {
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function requirePubkey(value: string, label: string): PublicKey {
  const pk = toPublicKeySafe(value);
  if (!pk) {
    throw new Error(`Invalid ${label}`);
  }
  return pk;
}

function parseU64Strict(value: string, label: string): bigint {
  const normalized = cleanValue(value);
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be an unsigned integer`);
  }
  const parsed = BigInt(normalized);
  const maxU64 = (1n << 64n) - 1n;
  if (parsed < 0n || parsed > maxU64) {
    throw new Error(`${label} must fit into u64`);
  }
  return parsed;
}

function u64ToLeBuffer(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  let v = value;
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function encodeBytes(value: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(value.length, 0);
  return Buffer.concat([len, value]);
}

function encodeVecBytes(values: Buffer[]): Buffer {
  const count = Buffer.alloc(4);
  count.writeUInt32LE(values.length, 0);
  const parts: Buffer[] = [count];
  values.forEach((item) => {
    parts.push(encodeBytes(item));
  });
  return Buffer.concat(parts);
}

function encodeString(value: string): Buffer {
  return encodeBytes(Buffer.from(value, 'utf8'));
}

function encodeOptionPubkey(value: PublicKey | null): Buffer {
  if (!value) return Buffer.from([0]);
  return Buffer.concat([Buffer.from([1]), value.toBuffer()]);
}

function decodeUserBytes(rawValue: string, encoding: ByteEncoding): Buffer {
  const value = rawValue ?? '';
  if (encoding === 'utf8') return Buffer.from(value, 'utf8');
  if (encoding === 'base64') {
    const normalized = cleanValue(value).replace(/\s+/g, '');
    if (!normalized) return Buffer.alloc(0);
    if (!/^[A-Za-z0-9+/=_-]+$/.test(normalized)) {
      throw new Error('Invalid base64 value');
    }
    return Buffer.from(normalized.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }
  const normalizedHex = cleanValue(value).replace(/^0x/i, '');
  if (!normalizedHex) return Buffer.alloc(0);
  if (!/^[0-9a-fA-F]+$/.test(normalizedHex) || normalizedHex.length % 2 !== 0) {
    throw new Error('Invalid hex value');
  }
  return Buffer.from(normalizedHex, 'hex');
}

function deriveMetadataKeyPda(metadataKeyId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MYTHIC_NAMESPACE_SEED, METADATA_KEY_SEED, u64ToLeBuffer(metadataKeyId)],
    MYTHIC_METADATA_PROGRAM_ID
  )[0];
}

function deriveMetadataPda(metadataMetadataKey: PublicKey, issuingAuthority: PublicKey, subject: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MYTHIC_NAMESPACE_SEED, METADATA_SEED, metadataMetadataKey.toBuffer(), issuingAuthority.toBuffer(), subject.toBuffer()],
    MYTHIC_METADATA_PROGRAM_ID
  )[0];
}

function serializeCreateMetadataKeyArgs(args: {
  id: bigint;
  name: string;
  label: string;
  description: string;
  contentType: string;
}): Buffer {
  return Buffer.concat([
    u64ToLeBuffer(args.id),
    encodeString(args.name),
    encodeString(args.label),
    encodeString(args.description),
    encodeString(args.contentType),
  ]);
}

function serializeCreateMetadataArgs(args: { subject: PublicKey; updateAuthority: PublicKey | null }): Buffer {
  return Buffer.concat([args.subject.toBuffer(), encodeOptionPubkey(args.updateAuthority)]);
}

function serializeAppendMetadataCollectionArgs(args: { updateAuthority: PublicKey | null }): Buffer {
  return encodeOptionPubkey(args.updateAuthority);
}

function serializeAppendMetadataItemArgs(args: { value: Buffer }): Buffer {
  return encodeBytes(args.value);
}

function serializeAppendMetadataItemsArgs(args: { values: Buffer[] }): Buffer {
  return encodeVecBytes(args.values);
}

function serializeSetCollectionUpdateAuthorityArgs(args: { newUpdateAuthority: PublicKey | null }): Buffer {
  return encodeOptionPubkey(args.newUpdateAuthority);
}

function serializeUpdateMetadataItemArgs(args: { newValue: Buffer }): Buffer {
  return encodeBytes(args.newValue);
}

export default function MythicMetadataView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [isBuilding, setIsBuilding] = React.useState(false);

  const [action, setAction] = React.useState<MythicAction>('create_metadata');
  const [payerAddress, setPayerAddress] = React.useState('');
  const [namespaceAuthority, setNamespaceAuthority] = React.useState('');
  const [issuingAuthority, setIssuingAuthority] = React.useState('');
  const [metadataIssuingAuthority, setMetadataIssuingAuthority] = React.useState('');
  const [updateAuthority, setUpdateAuthority] = React.useState('');
  const [subjectAddress, setSubjectAddress] = React.useState('');

  const [metadataKeyId, setMetadataKeyId] = React.useState('');
  const [collectionKeyId, setCollectionKeyId] = React.useState('');
  const [itemKeyId, setItemKeyId] = React.useState('');

  const [metadataKeyName, setMetadataKeyName] = React.useState('');
  const [metadataKeyLabel, setMetadataKeyLabel] = React.useState('');
  const [metadataKeyDescription, setMetadataKeyDescription] = React.useState('');
  const [metadataKeyContentType, setMetadataKeyContentType] = React.useState('application/json');

  const [metadataUpdateAuthority, setMetadataUpdateAuthority] = React.useState('');
  const [collectionUpdateAuthority, setCollectionUpdateAuthority] = React.useState('');
  const [newCollectionUpdateAuthority, setNewCollectionUpdateAuthority] = React.useState('');

  const [valueInput, setValueInput] = React.useState('');
  const [newValueInput, setNewValueInput] = React.useState('');
  const [valuesInput, setValuesInput] = React.useState('');
  const [bytesEncoding, setBytesEncoding] = React.useState<ByteEncoding>('utf8');

  const [proposalTitle, setProposalTitle] = React.useState<string | null>('Mythic Metadata');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(
    'Create proposal with Mythic Metadata instruction'
  );
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);
  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const stopInputKeyPropagation = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  React.useEffect(() => {
    const fallback = cleanValue(governanceNativeWallet || '');
    setPayerAddress(fallback);
    setNamespaceAuthority(fallback);
    setIssuingAuthority(fallback);
    setMetadataIssuingAuthority(fallback);
    setUpdateAuthority(fallback);
  }, [governanceNativeWallet]);

  React.useEffect(() => {
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
      return;
    }
    if (hasCouncil) {
      setGoverningMint(realm?.account?.config?.councilMint);
      setIsGoverningMintSelectable(false);
      setIsGoverningMintCouncilSelected(true);
      return;
    }
    if (hasCommunity) {
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
      setIsGoverningMintSelectable(false);
      setIsGoverningMintCouncilSelected(false);
    }
  }, [realm, rulesWallet]);

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account?.config?.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
    }
  };

  const handleAdvancedToggle = () => setOpenAdvanced((prev) => !prev);

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const handleOpen = () => setOpen(true);

  const derivedPreview = React.useMemo(() => {
    try {
      const metadataKeyIdValue = cleanValue(metadataKeyId);
      const subject = toPublicKeySafe(subjectAddress);
      const issuing =
        action === 'update_metadata_item'
          ? toPublicKeySafe(metadataIssuingAuthority)
          : toPublicKeySafe(issuingAuthority);

      if (!metadataKeyIdValue) return null;
      const metadataKeyIdBn = parseU64Strict(metadataKeyIdValue, 'Metadata Key ID');
      const metadataMetadataKey = deriveMetadataKeyPda(metadataKeyIdBn);

      let metadataAddress: PublicKey | null = null;
      if (subject && issuing) {
        metadataAddress = deriveMetadataPda(metadataMetadataKey, issuing, subject);
      }

      const collectionAddress =
        cleanValue(collectionKeyId) !== ''
          ? deriveMetadataKeyPda(parseU64Strict(collectionKeyId, 'Collection Key ID'))
          : null;
      const itemAddress =
        cleanValue(itemKeyId) !== ''
          ? deriveMetadataKeyPda(parseU64Strict(itemKeyId, 'Item Key ID'))
          : null;

      return {
        metadataMetadataKey: metadataMetadataKey.toBase58(),
        metadataAddress: metadataAddress?.toBase58() || null,
        collectionMetadataKey: collectionAddress?.toBase58() || null,
        itemMetadataKey: itemAddress?.toBase58() || null,
      };
    } catch {
      return null;
    }
  }, [action, metadataKeyId, subjectAddress, issuingAuthority, metadataIssuingAuthority, collectionKeyId, itemKeyId]);

  const buildInstruction = (): { ix: TransactionInstruction; defaultTitle: string; defaultDescription: string } => {
    const requiresPayer = ACTION_REQUIRES_PAYER.has(action);
    const requiresIssuingAuthority = ACTION_REQUIRES_ISSUING_AUTHORITY.has(action);
    const requiresSubject = ACTION_REQUIRES_SUBJECT.has(action);

    const payer = requiresPayer ? requirePubkey(payerAddress, 'Payer') : null;
    const issuing = requiresIssuingAuthority ? requirePubkey(issuingAuthority, 'Issuing Authority') : null;
    const metadataIssuing =
      action === 'update_metadata_item'
        ? requirePubkey(metadataIssuingAuthority, 'Metadata Issuing Authority')
        : issuing;
    const subject = requiresSubject ? requirePubkey(subjectAddress, 'Subject') : null;

    const metadataKeyIdBn =
      action === 'create_metadata_key'
        ? parseU64Strict(metadataKeyId, 'Metadata Key ID')
        : cleanValue(metadataKeyId) !== ''
        ? parseU64Strict(metadataKeyId, 'Metadata Key ID')
        : null;
    const collectionKeyIdBn = cleanValue(collectionKeyId) !== '' ? parseU64Strict(collectionKeyId, 'Collection Key ID') : null;
    const itemKeyIdBn = cleanValue(itemKeyId) !== '' ? parseU64Strict(itemKeyId, 'Item Key ID') : null;

    const metadataMetadataKey = metadataKeyIdBn !== null ? deriveMetadataKeyPda(metadataKeyIdBn) : null;
    const collectionMetadataKey = collectionKeyIdBn !== null ? deriveMetadataKeyPda(collectionKeyIdBn) : null;
    const itemMetadataKey = itemKeyIdBn !== null ? deriveMetadataKeyPda(itemKeyIdBn) : null;

    const metadata =
      metadataMetadataKey && metadataIssuing && subject
        ? deriveMetadataPda(metadataMetadataKey, metadataIssuing, subject)
        : null;

    const actionLabel = ACTION_LABELS[action];
    const defaultTitle = `Mythic Metadata: ${actionLabel}`;
    const defaultDescription = `Create proposal instruction for Mythic Metadata program (${actionLabel}).`;

    if (action === 'create_metadata_key') {
      const namespaceAuthorityPk = requirePubkey(namespaceAuthority, 'Namespace Authority');
      if (!payer) throw new Error('Missing payer');
      if (!metadataMetadataKey) throw new Error('Metadata Key ID is required');

      const name = cleanValue(metadataKeyName);
      const label = cleanValue(metadataKeyLabel);
      const description = cleanValue(metadataKeyDescription);
      const contentType = cleanValue(metadataKeyContentType);
      if (!name || !label || !description || !contentType) {
        throw new Error('Name, Label, Description and Content Type are required');
      }

      const args = serializeCreateMetadataKeyArgs({
        id: metadataKeyIdBn as bigint,
        name,
        label,
        description,
        contentType,
      });
      const data = Buffer.concat([DISCRIMINATORS.create_metadata_key, args]);

      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: namespaceAuthorityPk, isSigner: true, isWritable: false },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (!metadataMetadataKey) throw new Error('Metadata Key ID is required');

    if (action === 'create_metadata') {
      if (!payer || !issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      const updateAuth = cleanValue(metadataUpdateAuthority) ? requirePubkey(metadataUpdateAuthority, 'Update Authority') : null;
      const args = serializeCreateMetadataArgs({ subject, updateAuthority: updateAuth });
      const data = Buffer.concat([DISCRIMINATORS.create_metadata, args]);
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (action === 'append_metadata_collection') {
      if (!payer || !issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
      const updateAuth = cleanValue(collectionUpdateAuthority)
        ? requirePubkey(collectionUpdateAuthority, 'Collection Update Authority')
        : null;
      const args = serializeAppendMetadataCollectionArgs({ updateAuthority: updateAuth });
      const data = Buffer.concat([DISCRIMINATORS.append_metadata_collection, args]);
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (action === 'append_metadata_item') {
      if (!payer || !issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
      if (!itemMetadataKey) throw new Error('Item Key ID is required');
      const value = decodeUserBytes(valueInput, bytesEncoding);
      const args = serializeAppendMetadataItemArgs({ value });
      const data = Buffer.concat([DISCRIMINATORS.append_metadata_item, args]);
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
            { pubkey: itemMetadataKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (action === 'append_metadata_items') {
      if (!payer || !issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
      const rawLines = (valuesInput || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!rawLines.length) {
        throw new Error('Add at least one value line');
      }
      const values = rawLines.map((line) => decodeUserBytes(line, bytesEncoding));
      const args = serializeAppendMetadataItemsArgs({ values });
      const data = Buffer.concat([DISCRIMINATORS.append_metadata_items, args]);
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (action === 'remove_metadata_collection') {
      if (!issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
          ],
          data: DISCRIMINATORS.remove_metadata_collection,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (action === 'remove_metadata_item') {
      if (!issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
      if (!itemMetadataKey) throw new Error('Item Key ID is required');
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
            { pubkey: itemMetadataKey, isSigner: false, isWritable: false },
          ],
          data: DISCRIMINATORS.remove_metadata_item,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (action === 'set_collection_update_authority') {
      if (!issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
      const newUpdateAuthority = cleanValue(newCollectionUpdateAuthority)
        ? requirePubkey(newCollectionUpdateAuthority, 'New Collection Update Authority')
        : null;
      const args = serializeSetCollectionUpdateAuthorityArgs({ newUpdateAuthority });
      const data = Buffer.concat([DISCRIMINATORS.set_collection_update_authority, args]);
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
          ],
          data,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (action === 'revoke_collection_update_authority') {
      if (!issuing || !subject || !metadata) throw new Error('Missing required account(s)');
      if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
      return {
        ix: new TransactionInstruction({
          programId: MYTHIC_METADATA_PROGRAM_ID,
          keys: [
            { pubkey: issuing, isSigner: true, isWritable: false },
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
            { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
          ],
          data: DISCRIMINATORS.revoke_collection_update_authority,
        }),
        defaultTitle,
        defaultDescription,
      };
    }

    if (!metadata || !metadataIssuing || !subject) throw new Error('Missing required account(s)');
    if (!collectionMetadataKey) throw new Error('Collection Key ID is required');
    if (!itemMetadataKey) throw new Error('Item Key ID is required');
    const updateAuthorityPk = requirePubkey(updateAuthority, 'Update Authority');
    const newValue = decodeUserBytes(newValueInput, bytesEncoding);
    const args = serializeUpdateMetadataItemArgs({ newValue });
    const data = Buffer.concat([DISCRIMINATORS.update_metadata_item, args]);
    return {
      ix: new TransactionInstruction({
        programId: MYTHIC_METADATA_PROGRAM_ID,
        keys: [
          { pubkey: updateAuthorityPk, isSigner: true, isWritable: true },
          { pubkey: metadata, isSigner: false, isWritable: true },
          { pubkey: metadataMetadataKey, isSigner: false, isWritable: false },
          { pubkey: collectionMetadataKey, isSigner: false, isWritable: false },
          { pubkey: itemMetadataKey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      }),
      defaultTitle,
      defaultDescription,
    };
  };

  const createMythicMetadataProposal = async () => {
    if (isBuilding) return;
    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    setIsBuilding(true);
    try {
      const { ix, defaultTitle, defaultDescription } = buildInstruction();
      const title = cleanValue(proposalTitle || defaultTitle) || defaultTitle;
      const description = cleanValue(proposalDescription || defaultDescription) || defaultDescription;

      setInstructions({
        title,
        description,
        ix: [ix],
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
        queueOnly: false,
        skipQueueEntry: true,
      });
      setExpandedLoader(true);
      setOpen(false);
      if (handleCloseExtMenu) handleCloseExtMenu();
    } catch (error: any) {
      const message = error?.message || `${error}`;
      enqueueSnackbar(`Mythic metadata instruction build failed: ${message}`, { variant: 'error' });
      // eslint-disable-next-line no-console
      console.error('Mythic metadata instruction build failed', error);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <>
      <Tooltip title="Mythic Metadata (create/update/remove metadata)">
        <MenuItem onClick={publicKey ? handleOpen : undefined}>
          <ListItemIcon>
            <DataObjectIcon fontSize="small" />
          </ListItemIcon>
          Mythic Metadata
        </MenuItem>
      </Tooltip>

      <BootstrapDialog
        fullWidth
        maxWidth="sm"
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
        <BootstrapDialogTitle id="mythic-metadata-dialog" onClose={handleClose}>
          Mythic Metadata
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Build Mythic Metadata program instructions and create proposal.
          </DialogContentText>

          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel id="mythic-metadata-action-label">Action</InputLabel>
                <Select
                  labelId="mythic-metadata-action-label"
                  label="Action"
                  value={action}
                  onChange={(event) => setAction(event.target.value as MythicAction)}
                >
                  <MenuItem value="create_metadata_key">Create Metadata Key</MenuItem>
                  <MenuItem value="create_metadata">Create Metadata</MenuItem>
                  <MenuItem value="append_metadata_collection">Append Metadata Collection</MenuItem>
                  <MenuItem value="append_metadata_item">Append Metadata Item</MenuItem>
                  <MenuItem value="append_metadata_items">Append Metadata Items</MenuItem>
                  <MenuItem value="update_metadata_item">Update Metadata Item</MenuItem>
                  <MenuItem value="remove_metadata_item">Remove Metadata Item</MenuItem>
                  <MenuItem value="remove_metadata_collection">Remove Metadata Collection</MenuItem>
                  <MenuItem value="set_collection_update_authority">Set Collection Update Authority</MenuItem>
                  <MenuItem value="revoke_collection_update_authority">Revoke Collection Update Authority</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {ACTION_REQUIRES_PAYER.has(action) ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Payer"
                  variant="filled"
                  value={payerAddress}
                  onChange={(event) => setPayerAddress(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {action === 'create_metadata_key' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Namespace Authority"
                  variant="filled"
                  value={namespaceAuthority}
                  onChange={(event) => setNamespaceAuthority(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {ACTION_REQUIRES_ISSUING_AUTHORITY.has(action) ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Issuing Authority"
                  variant="filled"
                  value={issuingAuthority}
                  onChange={(event) => setIssuingAuthority(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {action === 'update_metadata_item' ? (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Metadata Issuing Authority (PDA seed)"
                    variant="filled"
                    value={metadataIssuingAuthority}
                    onChange={(event) => setMetadataIssuingAuthority(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Update Authority (signer)"
                    variant="filled"
                    value={updateAuthority}
                    onChange={(event) => setUpdateAuthority(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
              </>
            ) : null}

            {ACTION_REQUIRES_SUBJECT.has(action) ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Subject"
                  variant="filled"
                  value={subjectAddress}
                  onChange={(event) => setSubjectAddress(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Metadata Key ID (u64)"
                variant="filled"
                value={metadataKeyId}
                onChange={(event) => setMetadataKeyId(event.target.value)}
                onKeyDown={stopInputKeyPropagation}
              />
            </Grid>

            {action === 'create_metadata_key' ? (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Name"
                    variant="filled"
                    value={metadataKeyName}
                    onChange={(event) => setMetadataKeyName(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Label"
                    variant="filled"
                    value={metadataKeyLabel}
                    onChange={(event) => setMetadataKeyLabel(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Description"
                    variant="filled"
                    value={metadataKeyDescription}
                    onChange={(event) => setMetadataKeyDescription(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Content Type"
                    variant="filled"
                    value={metadataKeyContentType}
                    onChange={(event) => setMetadataKeyContentType(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
              </>
            ) : null}

            {[
              'append_metadata_collection',
              'append_metadata_item',
              'append_metadata_items',
              'remove_metadata_collection',
              'remove_metadata_item',
              'set_collection_update_authority',
              'revoke_collection_update_authority',
              'update_metadata_item',
            ].includes(action) ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Collection Key ID (u64)"
                  variant="filled"
                  value={collectionKeyId}
                  onChange={(event) => setCollectionKeyId(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {['append_metadata_item', 'remove_metadata_item', 'update_metadata_item'].includes(action) ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Item Key ID (u64)"
                  variant="filled"
                  value={itemKeyId}
                  onChange={(event) => setItemKeyId(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {action === 'create_metadata' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Update Authority (optional)"
                  variant="filled"
                  value={metadataUpdateAuthority}
                  onChange={(event) => setMetadataUpdateAuthority(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {action === 'append_metadata_collection' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Collection Update Authority (optional)"
                  variant="filled"
                  value={collectionUpdateAuthority}
                  onChange={(event) => setCollectionUpdateAuthority(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {action === 'set_collection_update_authority' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="New Collection Update Authority (optional)"
                  variant="filled"
                  value={newCollectionUpdateAuthority}
                  onChange={(event) => setNewCollectionUpdateAuthority(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {['append_metadata_item', 'append_metadata_items', 'update_metadata_item'].includes(action) ? (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel id="mythic-metadata-byte-encoding-label">Value Encoding</InputLabel>
                  <Select
                    labelId="mythic-metadata-byte-encoding-label"
                    label="Value Encoding"
                    value={bytesEncoding}
                    onChange={(event) => setBytesEncoding(event.target.value as ByteEncoding)}
                  >
                    <MenuItem value="utf8">utf8</MenuItem>
                    <MenuItem value="base64">base64</MenuItem>
                    <MenuItem value="hex">hex</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            ) : null}

            {action === 'append_metadata_item' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  label="Value"
                  variant="filled"
                  value={valueInput}
                  onChange={(event) => setValueInput(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {action === 'append_metadata_items' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  size="small"
                  label="Values (one per line)"
                  variant="filled"
                  value={valuesInput}
                  onChange={(event) => setValuesInput(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {action === 'update_metadata_item' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  label="New Value"
                  variant="filled"
                  value={newValueInput}
                  onChange={(event) => setNewValueInput(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
            ) : null}

            {derivedPreview ? (
              <Grid item xs={12}>
                <Box sx={{ p: 1, border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px' }}>
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                    Program: {MYTHIC_METADATA_PROGRAM_ID.toBase58()}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                    metadata_metadata_key: {derivedPreview.metadataMetadataKey}
                  </Typography>
                  {derivedPreview.metadataAddress ? (
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                      metadata: {derivedPreview.metadataAddress}
                    </Typography>
                  ) : null}
                  {derivedPreview.collectionMetadataKey ? (
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                      collection_metadata_key: {derivedPreview.collectionMetadataKey}
                    </Typography>
                  ) : null}
                  {derivedPreview.itemMetadataKey ? (
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                      item_metadata_key: {derivedPreview.itemMetadataKey}
                    </Typography>
                  ) : null}
                </Box>
              </Grid>
            ) : null}
          </Grid>

          {openAdvanced ? (
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
          ) : null}

          <Box alignItems="center" alignContent="center" justifyContent="center" sx={{ m: 2, textAlign: 'center' }}>
            <Typography variant="caption">Made with ❤️ by Grape</Typography>
          </Box>

          <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p: 0, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0 }}>
              {publicKey ? (
                <Button
                  size="small"
                  onClick={handleAdvancedToggle}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    justifyContent: 'flex-start',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<SettingsIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Advanced
                </Button>
              ) : null}
            </Box>

            <Box sx={{ display: 'flex', p: 0 }}>
              {publicKey ? (
                <Button
                  autoFocus
                  onClick={createMythicMetadataProposal}
                  disabled={isBuilding}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<DataObjectIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  {isBuilding ? 'Building...' : 'Create Metadata Proposal'}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
