import appIcon from '../public/icon.png?url';
import grapeLogo from '../public/apple-grape-touch-icon.png?url';
import socialSplash from '../public/governancesocialsplashv2.png?url';
import shortcutFeed from '../public/shortcut_feed.png?url';
import shortcutUser from '../public/shortcut_user.png?url';
import touchIcon from '../public/touch-icon.png?url';
import proposalScreen from '../public/scrn_proposal.png?url';
import realtimeScreen from '../public/scrn_realtime.png?url';
import governanceScreen from '../public/scrn_governance.png?url';
import walletScreen from '../public/scrn_wallet.png?url';
import connectScreen from '../public/scrn_connect_tools.png?url';

const appStorage = '/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/';
const replacements: Record<string, string> = {
  '/4HMWqo1YLwnxuVbh4c8KXMcZvQj4aw7oxnNmWVm4RmVV/Screenshot_2023-05-28_at_10.43.34.png': 'https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs',
  [appStorage + 'governanceicon.png']: appIcon,
  [appStorage + 'logo_grape.png']: grapeLogo,
  [appStorage + 'governancesocialsplashv2.png']: socialSplash,
  [appStorage + 'shortcut_feed.png']: shortcutFeed,
  [appStorage + 'shortcut_user.png']: shortcutUser,
  [appStorage + 'touch-icon.png']: touchIcon,
  [appStorage + 'scrn_proposal.png']: proposalScreen,
  [appStorage + 'scrn_realtime.png']: realtimeScreen,
  [appStorage + 'scrn_governance.png']: governanceScreen,
  [appStorage + 'scrn_wallet.png']: walletScreen,
  [appStorage + 'scrn_connect_tools.png']: connectScreen,
};

// Only replace exact, known assets with their bundled copy or verified replacement.
export function replaceLegacyAssetUrl(value: string): string {
  try {
    const url = new URL(value, 'https://governance.so');
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'shdw-drive.genesysgo.net') return value;
    const replacement = replacements[url.pathname];
    return replacement ? replacement + url.search + url.hash : value;
  } catch { return value; }
}

export function replaceLegacyAssetsInText(value: string): string {
  return value.replace(/(?:https?:)?\/\/shdw-drive\.genesysgo\.net\/[^\s<>"')\]]+/gi, replaceLegacyAssetUrl);
}
