import React from "react";
import { Link } from "react-router-dom";
import "./governance-demo.css";
const realm = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
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
}: {
  section?: DaoSection;
  advanced?: boolean;
}) {
  const current = advanced ? "advanced" : section;
  return (
    <nav className="gd-dao-nav" aria-label="Grape DAO navigation">
      {(
        [
          ["proposals", "Proposals", "dao"],
          ["members", "Members", "members"],
          ["treasury", "Treasury", "treasury"],
          ["stats", "Stats", "stats"],
          ["advanced", "Show old view", "governance"],
        ] as const
      ).map(([key, label, path]) => (
        <Link
          key={key}
          to={`/${path}/${realm}`}
          className={`${current === key ? "is-current" : ""} ${
            key === "advanced" ? "gd-old-view" : ""
          }`}
          aria-current={current === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
      <a
        className="gd-vine-link"
        href={`https://vine.governance.so/dao/${realm}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Vine / OG Reputation ↗
      </a>
    </nav>
  );
}
