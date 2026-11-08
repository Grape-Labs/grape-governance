import appIcon from 'url:../public/icon.png';
import grapeLogo from 'url:../public/apple-grape-touch-icon.png';
import socialSplash from 'url:../public/governancesocialsplashv2.png';
import shortcutFeed from 'url:../public/shortcut_feed.png';
import shortcutUser from 'url:../public/shortcut_user.png';
import touchIcon from 'url:../public/touch-icon.png';
import proposalScreen from 'url:../public/scrn_proposal.png';
import realtimeScreen from 'url:../public/scrn_realtime.png';
import governanceScreen from 'url:../public/scrn_governance.png';
import walletScreen from 'url:../public/scrn_wallet.png';
import connectScreen from 'url:../public/scrn_connect_tools.png';

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
