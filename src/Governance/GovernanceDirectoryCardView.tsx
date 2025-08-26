import { Card, CardContent, CardActions, Grid, Typography, Tooltip, Button, IconButton, Badge, Table, TableBody, TableRow, TableCell, TableContainer, Box, Avatar } from "@mui/material";
import { Link } from "react-router-dom";
import VerifiedIcon from "@mui/icons-material/Verified";
import moment from "moment";
import { GRAPE_LOGO } from '../utils/grapeTools/constants';

function GovernanceDirectoryCardView(props: any) {
    const { item, metadata } = props;
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    
    return (
        <Card sx={{ 
            borderRadius: '17px',
            background: `linear-gradient(75deg, rgba(0,0,0,0.50) 40%, #${randomColor} 200%)`,
            minHeight: "360px", // Uniform height for all cards
            display: "flex",
            flexDirection: "column",
            padding: "16px"
        }}>
            <CardContent sx={{ flexGrow: 1 }}>
                <Grid container alignItems="center" spacing={1}>
                    {/* Governance Image as a Small Circular Icon */}
                    {metadata?.ogImage && !metadata.ogImage.endsWith("/") && (
                        <Grid item>
                            <Avatar 
                                src={
                                    metadata?.ogImage === "/realms/Grape/img/grape.png"
                                        ? GRAPE_LOGO
                                        : (metadata?.ogImage?.startsWith("http")
                                            ? metadata.ogImage
                                            : `https://realms.today${metadata?.ogImage}`)
                                }
                                alt={metadata?.displayName || item.governanceName}
                                sx={{
                                    width: 40, // Small and consistent
                                    height: 40, // Small and consistent
                                    boxShadow: "0px 4px 10px rgba(0,0,0,0.3)" // Subtle shadow effect
                                }}
                            />
                        </Grid>
                    )}

                    {/* Governance Name & Verified Badge */}
                    <Grid item sx={{ display: "flex", alignItems: "center" }}>
                        <Tooltip title={`View ${metadata?.displayName || item.governanceName} Governance`}>
                            <Button 
                                component={Link}
                                to={'/dao/' + item.governanceAddress}
                                size="large"
                                color='inherit'
                                sx={{ 
                                    borderRadius: '17px', 
                                    textTransform: 'none', 
                                    display: 'flex', 
                                    alignItems: 'center'
                                }}
                            >
                                <Typography variant="h5">
                                    {metadata?.displayName || item.governanceName}
                                </Typography>
                            </Button>
                        </Tooltip>

                        {/* Verified Checkmark (if item is verified) */}
                        {item?.gspl && (
                            <Tooltip
                                title={
                                    <Box sx={{ maxWidth: 400, whiteSpace: 'pre-wrap', overflow: 'hidden', p: 1 }}>
                                        <Typography variant="h6">
                                            Verified Governance 
                                        </Typography>
                                        <Typography variant="subtitle2">
                                            {metadata?.displayName || item.governanceName} GSPL Metadata
                                        </Typography>
                                        <pre style={{ margin: 0, fontSize: '0.65rem', lineHeight: '1', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                            {JSON.stringify(metadata, null, 2)}
                                        </pre>
                                    </Box>
                                }
                        >
                                <VerifiedIcon 
                                    sx={{ 
                                        fontSize: 20, 
                                        color: "#4CAF50", 
                                        marginLeft: 1, 
                                        opacity: 0.8, 
                                        boxShadow: "0px 2px 5px rgba(0,0,0,0.2)" 
                                    }} 
                                />
                            </Tooltip>
                        )}
                    </Grid>
                </Grid>

                {/* Short Description */}
                {metadata?.shortDescription && (
                    <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.8)' }}>
                        {metadata.shortDescription}
                    </Typography>
                )}

                <Box sx={{ borderRadius: '24px', m: 1, p: 1, background: 'rgba(0, 0, 0, 0.2)' }}>
                    <TableContainer>
                        <Table size="small" aria-label="dense table">
                            <TableBody>
                                {item?.totalVaultValue > 1 && (
                                    <TableRow>
                                        <TableCell><strong>Treasury</strong></TableCell>
                                        <TableCell align="right"><strong>{Number(item.totalVaultValue).toLocaleString()} USD</strong></TableCell>
                                    </TableRow>
                                )}

                                {item?.totalVaultStableCoinValue > 1 && (
                                    <TableRow>
                                        <TableCell>Treasury in Stable Coin</TableCell>
                                        <TableCell align="right">{Number(item.totalVaultStableCoinValue).toLocaleString()} USD</TableCell>
                                    </TableRow>
                                )}

                                {item?.totalVaultSolValue > 100 && (
                                    <TableRow>
                                        <TableCell>Treasury in Solana</TableCell>
                                        <TableCell align="right">{Number(item.totalVaultSolValue).toLocaleString()} USD</TableCell>
                                    </TableRow>
                                )}

                                {item?.totalVaultNftValue > 1 && (
                                    <TableRow>
                                        <TableCell>Treasury NFT Floor Price</TableCell>
                                        <TableCell align="right">{Number(item.totalVaultNftValue).toLocaleString()} USD</TableCell>
                                    </TableRow>
                                )}

                                {item?.totalMembers > 0 && (
                                    <TableRow>
                                        <TableCell>Members</TableCell>
                                        <TableCell align="right">{Number(item.totalMembers).toLocaleString()}</TableCell>
                                    </TableRow>
                                )}

                                {item?.totalProposals > 0 && (
                                    <>
                                        <TableRow>
                                            <TableCell>Proposals</TableCell>
                                            <TableCell align="right">{Number(item.totalProposals).toLocaleString()}</TableCell>
                                        </TableRow>

                                        {item?.totalCouncilProposals > 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} sx={{ textAlign: 'right', fontSize: '10px' }}>
                                                    {item.totalProposals - item.totalCouncilProposals} community / {item.totalCouncilProposals} council
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </CardContent>

            <CardActions>
                {item.timestamp && (
                    <Typography marginLeft='auto' variant='caption'>
                        Cached: {moment.unix(Number(item.timestamp)).format("MMMM D, YYYY, h:mm a")}
                    </Typography>
                )}
            </CardActions>
        </Card>
    );
}

export default GovernanceDirectoryCardView;