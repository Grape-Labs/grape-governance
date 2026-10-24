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
import { Link, useNavigate } from "react-router-dom";
import VerifiedIcon from "@mui/icons-material/Verified";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { GRAPE_LOGO } from "../utils/grapeTools/constants";
import { toRealmsV2Image } from "../utils/grapeTools/utils";

function hashColor(seed: string) {
  // deterministic “random” color so cards don’t change every render
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsla(${hue}, 85%, 55%, 0.22)`;
}

function getOgSrc(metadata: any) {
  const og = metadata?.ogImage;
  if (!og || typeof og !== "string" || og.endsWith("/")) return null;

  if (og === "/realms/Grape/img/grape.png") return GRAPE_LOGO;

  return toRealmsV2Image(og.startsWith("http") ? og : `https://realms.today${og}`);
}

function getBannerSrc(metadata: any) {
  const banner = metadata?.bannerImage;
  if (!banner || typeof banner !== "string" || banner.endsWith("/")) return null;
  return toRealmsV2Image(banner.startsWith("http") ? banner : banner);
}

function DirectoryArtwork({ logo, banner, name, tint }: { logo: string | null; banner: string | null; name: string; tint: string }) {
  const [failedSource, setFailedSource] = React.useState<string | null>(null);
  const source = banner || logo;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
    background: `radial-gradient(ellipse at 100% 0%, ${tint}, transparent 70%)` }}>
    {source && source !== failedSource ? <Box component="img" src={source} alt="" loading="lazy" decoding="async"
      onError={() => setFailedSource(source)}
      sx={{ position: 'absolute', top: banner ? 0 : -24, right: banner ? 0 : -35,
        width: banner ? '100%' : 240, height: banner ? 220 : 240,
        objectFit: banner ? 'cover' : 'contain', opacity: banner ? 0.10 : 0.09,
        transform: banner ? 'none' : 'rotate(-14deg)',
        maskImage: 'linear-gradient(180deg, #000 15%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, #000 15%, transparent 100%)',
      }} /> : <Box sx={{ position: 'absolute', right: -8, top: -40, fontSize: 160, lineHeight: 1.3,
        fontWeight: 800, letterSpacing: '-12px', color: '#c6d8e8', opacity: 0.045,
        transform: 'rotate(-12deg)', userSelect: 'none' }}>{initials}</Box>}
  </Box>;
}

const GovernanceDirectoryCardView = React.memo(function GovernanceDirectoryCardView(props: any) {
  const { item, metadata, directoryOnly = false } = props;
  const navigate = useNavigate();

  const name = metadata?.displayName || item?.governanceName || "Governance";
  const desc = metadata?.shortDescription || "";
  const ogSrc = getOgSrc(metadata);
  const bannerSrc = getBannerSrc(metadata);

  const votingCount = Number(item?.totalProposalsVoting || 0);
  const votingList: any[] = Array.isArray(item?.votingProposals) ? item.votingProposals : [];
  const totalProposals = Number(item?.totalProposals || 0);
  const totalCouncilProposals = Number(item?.totalCouncilProposals || 0);
  const totalCommunityProposals =
    item?.totalCommunityProposals != null
      ? Number(item.totalCommunityProposals || 0)
      : Math.max(totalProposals - totalCouncilProposals, 0);
  const lastProposalTimestamp = Number(`0x${item?.lastProposalDate || "0"}`);
  const lastProposalLabel =
    lastProposalTimestamp > 0
      ? new Date(lastProposalTimestamp * 1000).toLocaleDateString()
      : "No recent proposal";

  const tint = React.useMemo(
    () => hashColor(String(item?.governanceAddress || name)),
    [item?.governanceAddress, name]
  );

  if (directoryOnly) {
    const activity = item?.recentActivity;
    return (
      <Card sx={{
        display: 'flex', flexDirection: 'column', height: '100%',
        color: '#edf2fa', borderRadius: '20px', position: 'relative', overflow: 'hidden',
        background: '#111c29', isolation: 'isolate', boxShadow: '0 8px 24px #00000018',
        border: '1px solid #ffffff12',
        transition: 'border-color 180ms, box-shadow 180ms',
        '&:hover': { borderColor: '#b6ecd550', boxShadow: '0 12px 32px #00000030' },
        '& a:focus-visible': { outline: '2px solid #84beff', outlineOffset: -3 },
      }}>
        <Box sx={{ position: 'relative', p: 2.5, pb: 2.25, overflow: 'hidden',
          background: '#111c29',
          borderBottom: '1px solid #ffffff0a',
        }}>
          <DirectoryArtwork logo={ogSrc} banner={bannerSrc} name={name} tint={tint} />
          <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(90deg, #111c29f5 0%, #111c29d9 50%, #111c294d 100%)' }} />
          <Stack component={Link} to={"/dao/" + item.governanceAddress} direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative', zIndex: 1, color: 'inherit', textDecoration: 'none' }}>
            <Avatar src={ogSrc || undefined} variant="rounded" sx={{ width: 52, height: 52, borderRadius: '16px', bgcolor: tint, color: '#fff', fontSize: 24, fontWeight: 600, border: '1px solid #ffffff20', boxShadow: '0 4px 12px #00000020' }}>{name[0]}</Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography noWrap sx={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.4px' }}>{name}</Typography>
                {item?.gspl && <Tooltip title="Verified DAO"><VerifiedIcon aria-label="Verified DAO" sx={{ fontSize: 16, color: '#94c8de', flexShrink: 0 }} /></Tooltip>}
              </Stack>
              <Typography variant="caption" sx={{ color: '#9aaec0', fontFamily: 'monospace', fontSize: 11 }}>{String(item.governanceAddress).slice(0, 4)}…{String(item.governanceAddress).slice(-4)}</Typography>
            </Box>
          </Stack>
        </Box>
        <Box sx={{ position: 'relative', px: 2.5, pt: 2, pb: 1, flex: 1 }}>
          {activity?.count ? (
            <>
              <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: '#8ee5c6', fontWeight: 600, fontSize: 11, bgcolor: '#64dfb110', borderRadius: '6px', px: 1, py: 0.5 }}>
                  <HowToVoteIcon sx={{ fontSize: 13 }} />{activity.count} recent proposal{activity.count === 1 ? '' : 's'}
                </Typography>
                {activity.latestAt > 0 && <Typography variant="caption" sx={{ color: '#8c9daf', fontSize: 10 }}>{new Date(activity.latestAt * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Typography>}
              </Stack>
              {(activity.proposals || []).map((proposal: any, index: number) => {
                const address = proposal.pubkey?.toBase58?.() || String(proposal.pubkey);
                return <Box key={address} component={Link} to={`/proposal/${item.governanceAddress}/${address}`} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, py: 1.5,
                  borderTop: index ? '1px solid #ffffff0b' : 'none', textDecoration: 'none', color: '#dce6f0',
                  '&:hover': { color: '#a2efd3', '& .proposal-arrow': { background: '#64dfb120', color: '#a2efd3' } },
                }}>
                  <Typography aria-hidden="true" sx={{ color: '#688095', fontSize: 10, fontFamily: 'monospace', alignSelf: 'flex-start', pt: 0.5 }}>{String(index + 1).padStart(2, '0')}</Typography>
                  <Typography variant="body2" sx={{ flex: 1, fontSize: 13, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{proposal.account?.name || proposal.name || 'View proposal'}</Typography>
                  <Box className="proposal-arrow" aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: 26, height: 26, flexShrink: 0, borderRadius: '50%', color: '#8b9eae', background: '#ffffff05' }}>↗</Box>
                </Box>;
              })}
              {!activity.proposals?.length && <Typography variant="body2" sx={{ py: 1.5 }}>{activity.latestName || 'View latest proposal'}</Typography>}
            </>
          ) : desc ? (
            <Typography variant="body2" sx={{ mb: 1, color: '#a5b5c5', fontSize: 13, lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</Typography>
          ) : null}
        </Box>
        <Box sx={{ position: 'relative', px: 2.5, pb: 2.25, pt: 1 }}>
          <Box component={Link} to={"/dao/" + item.governanceAddress} sx={{ px: 1.5, py: 1, minHeight: 42, borderRadius: '10px', border: '1px solid #ffffff0e', background: '#ffffff04', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#b6ecd5', fontSize: 12, fontWeight: 600, '&:hover': { color: '#e8fff5', background: '#64dfb114', borderColor: '#64dfb130' } }}>
            <span>Explore DAO</span><span aria-hidden="true">→</span>
          </Box>
        </Box>
      </Card>
    );
  }

  return (
    <Card
      onClick={() => navigate("/dao/" + item.governanceAddress)}
      sx={{
        cursor: "pointer",
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
      {bannerSrc && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.12,
            backgroundImage: `url(${bannerSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(1px) brightness(0.82) saturate(0.82)',
            zIndex: 0,
          }}
        />
      )}
      {/* top accent line */}
      <Box sx={{ position: 'relative', zIndex: 1, height: 3, width: "100%", background: `linear-gradient(90deg, ${tint}, rgba(255,255,255,0.05))` }} />

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
                    <Box sx={{ maxWidth: 320, p: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Verified Governance
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.82, display: "block", mt: 0.25 }}>
                        GSPL metadata is available for this DAO.
                      </Typography>
                      {!!metadata?.displayName && (
                        <Typography variant="caption" sx={{ opacity: 0.88, display: "block", mt: 0.75 }}>
                          Name: {metadata.displayName}
                        </Typography>
                      )}
                      {!!metadata?.website && (
                        <Typography variant="caption" sx={{ opacity: 0.88, display: "block", mt: 0.25 }}>
                          Website: {metadata.website}
                        </Typography>
                      )}
                    </Box>
                  }
                >
                  <VerifiedIcon sx={{ fontSize: 18, opacity: 0.9 }} />
                </Tooltip>
              )}

              {!directoryOnly && votingCount > 0 && (
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
        {!directoryOnly && <Grid container spacing={1}>
          {Number(item?.totalMembers || 0) > 0 && (
            <Grid item>
              <Chip size="small" label={`${Number(item.totalMembers).toLocaleString()} members`} />
            </Grid>
          )}

          {totalProposals > 0 && (
            <Grid item>
              <Chip size="small" label={`${totalProposals.toLocaleString()} proposals`} />
            </Grid>
          )}

          {(totalCommunityProposals > 0 || totalCouncilProposals > 0) && totalProposals > 0 && (
            <Grid item>
              <Chip
                size="small"
                variant="outlined"
                label={`${totalCommunityProposals.toLocaleString()} community / ${totalCouncilProposals.toLocaleString()} council`}
              />
            </Grid>
          )}
        </Grid>}

        {!directoryOnly && <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.2, opacity: 0.75 }}>
          <AccessTimeIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption">{lastProposalLabel}</Typography>
        </Stack>}

        {/* Voting proposals preview */}
        {!directoryOnly && votingList.length > 0 && (
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
            color: "rgba(255,255,255,0.98)",
            fontWeight: 700,
            "&:hover": {
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
            },
          }}
        >
          Open
        </Button>

        {directoryOnly ? (
          <Typography variant="caption" sx={{ opacity: 0.65 }}>View proposals & membership</Typography>
        ) : votingCount > 0 ? (
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
}, (prevProps, nextProps) => prevProps.item === nextProps.item && prevProps.metadata === nextProps.metadata && prevProps.directoryOnly === nextProps.directoryOnly);

export default GovernanceDirectoryCardView;
