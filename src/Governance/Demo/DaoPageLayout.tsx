import React from "react";
import { Link } from "react-router-dom";
import GrapeDaoNavigation, { DaoSection } from "./GrapeDaoNavigation";
import "./governance-demo.css";

export default function DaoPageLayout({
  section = "proposals",
  title,
  description,
  experimental = false,
  children,
}: {
  section?: DaoSection;
  title?: string;
  description?: string;
  experimental?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="governance-demo gd-live">
      <div className="gd-shell">
        <GrapeDaoNavigation section={section} />
        <header className="gd-header">
          <Link
            to="/dao/By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip"
            className="gd-brand"
          >
            <span className="gd-brand-icon">G</span> Governance{" "}
          </Link>
          <span className="gd-demo-badge">
            <span />
            {experimental
              ? "Real proposals · Experimental layout"
              : "Live DAO governance"}
          </span>
        </header>
        {title && (
          <div className="gd-intro">
            <span className="gd-eyebrow">GRAPE GOVERNANCE</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
