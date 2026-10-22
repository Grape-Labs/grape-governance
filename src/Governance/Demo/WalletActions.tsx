import React from "react";
import ExplorerView from "../../utils/grapeTools/Explorer";

// Reuse the application's complete wallet menu and its profile/identity tools.
export default function WalletActions({ address }: { address: string }) {
  return <ExplorerView address={address} type="address" shorten={4}
    grapeArtProfile={true} hideTitle={false} style="text" color="#b6ecd5" fontSize="12px" />;
}
