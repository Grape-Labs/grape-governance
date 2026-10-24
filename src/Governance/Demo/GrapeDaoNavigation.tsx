import React from "react";
import { Menu, MenuItem, useMediaQuery } from "@mui/material";
import HowToVoteOutlinedIcon from "@mui/icons-material/HowToVoteOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { Link, useParams } from "react-router-dom";
import "./governance-demo.css";
const defaultRealm = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
export type DaoSection =
  | "proposals"
  | "members"
  | "treasury"
  | "reputation"
  | "stats"
  | "advanced";
export default function GrapeDaoNavigation({
  section = "proposals",
  advanced = false,
  governanceAddress,
}: {
  governanceAddress?: string;
  section?: DaoSection;
  advanced?: boolean;
}) {
  const route = useParams();
  const realm = governanceAddress || route.governance || route.handlekey || route.address || defaultRealm;
  const mobile = useMediaQuery("(max-width:950px)");
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const icons = { proposals: HowToVoteOutlinedIcon, members: PeopleOutlineIcon,
    treasury: AccountBalanceWalletOutlinedIcon, stats: BarChartOutlinedIcon, advanced: MoreHorizIcon };
  const current = advanced ? "advanced" : section;
  return (
    <nav className="gd-dao-nav" aria-label="DAO navigation">
      {(
        [
          ["proposals", "Proposals", "dao"],
          ["members", "Members", "members"],
          ["treasury", "Treasury", "treasury"],
          ["stats", "Stats", "stats"],
          ["advanced", "Show old view", "governance"],
        ] as const
      ).filter(([key]) => !mobile || key !== "advanced").map(([key, label, path]) => (
        <Link
          key={key}
          to={`/${path}/${realm}`}
          className={`${current === key ? "is-current" : ""} ${
            key === "advanced" ? "gd-old-view" : ""
          }`}
          aria-current={current === key ? "page" : undefined}
        >
          {mobile && React.createElement(icons[key], { className: "gd-nav-icon", "aria-hidden": true })}
          <span>{label}</span>
        </Link>
      ))}
      <a
        className="gd-vine-link"
        href={`https://vine.governance.so/dao/${realm}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {mobile && <WorkspacePremiumOutlinedIcon className="gd-nav-icon" aria-hidden="true" />}
        <span>{mobile ? "Reputation" : "Vine / OG Reputation"} <span>↗</span></span>
      </a>
      {mobile && <>
        <button className="gd-nav-more" type="button" aria-label="More navigation options"
          aria-haspopup="menu" aria-expanded={!!menuAnchor} aria-controls={menuAnchor ? "gd-nav-overflow" : undefined}
          onClick={event => setMenuAnchor(event.currentTarget)}><MoreHorizIcon aria-hidden="true" /></button>
        <Menu id="gd-nav-overflow" anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
          PaperProps={{ sx: { bgcolor: "#141e2b", color: "#edf2fa", border: "1px solid #ffffff20", borderRadius: 2 } }}>
          <MenuItem component={Link} to={`/governance/${realm}`} onClick={() => setMenuAnchor(null)}
            aria-current={current === "advanced" ? "page" : undefined}>Show old view</MenuItem>
        </Menu>
      </>}
    </nav>
  );
}
