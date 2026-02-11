import * as React from "react";
import {
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  Typography,
  Tooltip,
  Button,
  Badge,
  Box,
  Avatar,
  Stack,
  Divider,
} from "@mui/material";
import { Link } from "react-router-dom";
import VerifiedIcon from "@mui/icons-material/Verified";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { GRAPE_LOGO } from "../utils/grapeTools/constants";
import { toRealmsV2Image } from "../utils/grapeTools/utils";

function hashColor(seed: string) {
  // deterministic “random” color so cards don’t change every render
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsla(${hue}, 85%, 55%, 0.22)`;
}

function getOgSrc(metadata: any, fallbackName: string) {
  const og = metadata?.ogImage;
  if (!og || typeof og !== "string" || og.endsWith("/")) return null;

  if (og === "/realms/Grape/img/grape.png") return GRAPE_LOGO;

  return toRealmsV2Image(og.startsWith("http") ? og : `https://realms.today${og}`);
}

export default function GovernanceDirectoryCardView(props: any) {
  const { item, metadata } = props;

  const name = metadata?.displayName || item?.governanceName || "Governance";
  const desc = metadata?.shortDescription || "";
  const ogSrc = getOgSrc(metadata, name);

  const votingCount = Number(item?.totalProposalsVoting || 0);
  const votingList: any[] = Array.isArray(item?.votingProposals) ? item.votingProposals : [];

  const tint = React.useMemo(
    () => hashColor(String(item?.governanceAddress || name)),
    [item?.governanceAddress, name]
  );

  return (
    <Card
      sx={{
        borderRadius: "20px",
        minHeight: 240,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          `radial-gradient(900px 300px at 0% 0%, ${tint}, transparent 55%), ` +
          `linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35))`,
        backdropFilter: "blur(10px)",
        transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
          borderColor: "rgba(255,255,255,0.14)",
        },
      }}
    >
      {/* top accent line */}
      <Box sx={{ height: 3, width: "100%", background: `linear-gradient(90deg, ${tint}, rgba(255,255,255,0.05))` }} />

      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        {/* Header */}
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            src={ogSrc || undefined}
            alt={name}
            sx={{
              width: 44,
              height: 44,
              bgcolor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0px 6px 16px rgba(0,0,0,0.35)",
            }}
          >
            {/* if no image, initial */}
            {(!ogSrc && name?.[0]) ? name[0].toUpperCase() : null}
          </Avatar>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Tooltip title={`View ${name} Governance`}>
                <Button
                  component={Link}
                  to={"/dao/" + item.governanceAddress}
                  color="inherit"
                  sx={{
                    p: 0,
                    minWidth: 0,
                    textTransform: "none",
                    justifyContent: "flex-start",
                    borderRadius: "12px",
                    maxWidth: "100%",
                    "&:hover": { background: "transparent" },
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 750,
                      letterSpacing: -0.3,
                      lineHeight: 1.15,
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </Typography>
                </Button>
              </Tooltip>

              {item?.gspl && (
                <Tooltip
                  placement="top"
                  title={
                    <Box sx={{ maxWidth: 420, p: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Verified Governance
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>
                        GSPL metadata (preview)
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          mt: 1,
                          mb: 0,
                          p: 1,
                          borderRadius: 1.5,
                          maxHeight: 220,
                          overflow: "auto",
                          fontSize: "0.68rem",
                          lineHeight: 1.2,
                          background: "rgba(0,0,0,0.35)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {JSON.stringify(metadata, null, 2)}
                      </Box>
                    </Box>
                  }
                >
                  <VerifiedIcon sx={{ fontSize: 18, opacity: 0.9 }} />
                </Tooltip>
              )}

              {votingCount > 0 && (
                <Chip
                  size="small"
                  icon={<HowToVoteIcon />}
                  label={`${votingCount} voting`}
                  color="error"
                  variant="outlined"
                  sx={{ borderRadius: "999px", height: 26 }}
                />
              )}
            </Stack>

            {/* Subtitle line */}
            <Typography variant="caption" sx={{ opacity: 0.75, display: "block" }}>
              {String(item?.governanceAddress || "").slice(0, 4)}…{String(item?.governanceAddress || "").slice(-4)}
            </Typography>
          </Box>
        </Stack>

        {/* Description */}
        {desc ? (
          <Typography
            variant="body2"
            sx={{
              mt: 1.25,
              opacity: 0.85,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {desc}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ mt: 1.25, opacity: 0.55 }}>
            No description provided.
          </Typography>
        )}

        <Divider sx={{ my: 1.5, opacity: 0.12 }} />

        {/* Stats row (cleaner than a table) */}
        <Grid container spacing={1}>
          {Number(item?.totalMembers || 0) > 0 && (
            <Grid item>
              <Chip size="small" label={`${Number(item.totalMembers).toLocaleString()} members`} />
            </Grid>
          )}

          {Number(item?.totalProposals || 0) > 0 && (
            <Grid item>
              <Chip size="small" label={`${Number(item.totalProposals).toLocaleString()} proposals`} />
            </Grid>
          )}

          {Number(item?.totalCouncilProposals || 0) > 0 && Number(item?.totalProposals || 0) > 0 && (
            <Grid item>
              <Chip
                size="small"
                variant="outlined"
                label={`${Number(item.totalProposals) - Number(item.totalCouncilProposals)} community / ${Number(item.totalCouncilProposals)} council`}
              />
            </Grid>
          )}
        </Grid>

        {/* Voting proposals preview */}
        {votingList.length > 0 && (
          <Box sx={{ mt: 1.25 }}>
            <Tooltip
              placement="top"
              title={
                <Box sx={{ p: 1 }}>
                  {votingList.slice(0, 8).map((p: any, i: number) => (
                    <Typography key={(p?.pubkey || i).toString()} variant="caption" display="block">
                      • {p?.name || p?.pubkey}
                    </Typography>
                  ))}
                  {votingList.length > 8 && (
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      +{votingList.length - 8} more…
                    </Typography>
                  )}
                </Box>
              }
            >
              <Chip
                size="small"
                color="error"
                variant="outlined"
                label="View voting proposals"
                sx={{ borderRadius: "999px" }}
              />
            </Tooltip>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: "space-between" }}>
        <Button
          component={Link}
          to={"/dao/" + item.governanceAddress}
          size="small"
          variant="contained"
          color="inherit"
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{
            borderRadius: "14px",
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.10)",
            "&:hover": { background: "rgba(255,255,255,0.14)" },
          }}
        >
          Open
        </Button>

        {votingCount > 0 ? (
          <Badge color="error" badgeContent={votingCount} sx={{ "& .MuiBadge-badge": { right: 6 } }}>
            <HowToVoteIcon fontSize="small" />
          </Badge>
        ) : (
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            No live votes
          </Typography>
        )}
      </CardActions>
    </Card>
  );
}