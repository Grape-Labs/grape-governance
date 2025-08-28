import { 
    Card, 
    CardContent, 
    CardActions, 
    Grid, 
    Typography, 
    Tooltip, 
    Button, 
    ButtonGroup, 
    IconButton, 
    Badge, 
    Table,
    TableBody, 
    TableRow, 
    TableCell, 
    TableContainer, 
    Box, 
    Avatar, 
    Menu, 
    MenuItem, 
    useTheme, 
    useMediaQuery } from '@mui/material';

import { Link } from "react-router-dom";
import { Helmet } from 'react-helmet';

import MoreVertIcon from '@mui/icons-material/MoreVert';
import VerifiedIcon from "@mui/icons-material/Verified";
import ShareIcon from '@mui/icons-material/Share';
import CodeIcon from '@mui/icons-material/Code';
import XIcon from '@mui/icons-material/X';
import LanguageIcon from '@mui/icons-material/Language';
import DiscordIcon from '../components/static/DiscordIcon';

import { 
    GRAPE_LOGO } from '../utils/grapeTools/constants';
    
import { toRealmsV2Image } from '../utils/grapeTools/utils';

export function GovernanceHeaderView(props: any) {
    const { governanceName, governanceAddress, gsplMetadata } = props;
    
    return (
        <>
            
            <Helmet>
                <meta name="msapplication-TileImage" content="./public/ms-icon-144x144.png"/>
                <meta name="msapplication-TileColor" content="#180A1E"/>
                <meta name="msapplication-TileImage" content="./public/ms-icon-144x144.png"/>
            
                <meta name="description" content={`${governanceName} powered by Governance.so by Grape`} />
                <title>{`${governanceName}`}</title>
                
                <meta property="og:url" content="https://governance.so"/>
                <meta property="og:type" content="website"/>
                <meta property="og:title" content={`${governanceName}`}/>
                <meta property="og:description" content={`${governanceName} powered by Governance.so by Grape`}/>
                <meta property="og:image" content="https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governancesocialsplashv2.png"/>  
                
                <meta name="twitter:card" content="summary_large_image"/>
                <meta name="twitter:title" content={`${governanceName}`}/>
                <meta name="twitter:site" content="@grapeprotocol"/>
                <meta name="twitter:description" content={`${governanceName} powered by Governance.so by Grape`}/>
                <meta name="twitter:image" content="https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governancesocialsplashv2.png"/>
                <meta name="twitter:image:alt" content={`${governanceName}`}/>
            </Helmet>
            
            <Grid item sm={6} container justifyContent="flex-start">
                <Grid container>
                    <Grid item xs={12}>
                        
                        {gsplMetadata ?
                            <Grid container alignItems="center" spacing={1}>
                                {/* Governance Image as a Small Circular Icon */}
                                {gsplMetadata?.metadata?.ogImage && !gsplMetadata.metadata.ogImage.endsWith("/") && (
                                    <Grid item>
                                        <Avatar 
                                            src={
                                                gsplMetadata.metadata?.ogImage === "/realms/Grape/img/grape.png"
                                                ? GRAPE_LOGO
                                                : toRealmsV2Image(
                                                    gsplMetadata.metadata?.ogImage?.startsWith("http")
                                                        ? gsplMetadata.metadata.ogImage
                                                        : `https://realms.today${gsplMetadata.metadata?.ogImage}`
                                                    )
                                            }
                                            alt={gsplMetadata.metadata?.displayName || governanceName}
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                boxShadow: "0px 4px 10px rgba(0,0,0,0.3)"
                                            }}
                                        />
                                    </Grid>
                                )}

                                {/* Governance Name & Verified Badge */}
                                <Grid item sx={{ display: "flex", alignItems: "center" }}>
                                    
                                    <Typography variant="h5">
                                        {gsplMetadata?.metadata?.displayName || governanceName}
                                    </Typography>
                                
                                
                                    {/* Verified Checkmark (if item is verified) */}
                                    
                                        <Tooltip
                                                title={

                                                    <Box sx={{ maxWidth: 400, whiteSpace: 'pre-wrap', overflow: 'hidden', p: 1 }}>
                                                        <Typography variant="h6">
                                                            Verified Governance 
                                                        </Typography>
                                                        <Typography variant="subtitle2">
                                                            {gsplMetadata.metadata?.displayName || governanceName} GSPL Metadata
                                                        </Typography>
                                                        <pre style={{ margin: 0, fontSize: '0.65rem', lineHeight: '1', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                                            {JSON.stringify(gsplMetadata, null, 2)}
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
                                    
                                </Grid>
                            </Grid>
                            
                        :
                            <Typography variant="h4">
                                {governanceName}
                            </Typography>
                        }
                    </Grid>
                    <Grid item xs={12}>    
                        <ButtonGroup>
                            <Tooltip title={`Share ${governanceName ? governanceName : ''} Governance`}>
                                <Button
                                    aria-label="share"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => {
                                        if (navigator.share) {
                                            navigator.share({
                                                title: `${governanceName} Governance`,
                                                text: `Visit the ${governanceName} DAO:`,
                                                url: `https://governance.so/dao/${governanceAddress}`
                                            }).catch((error) => console.error('Error sharing:', error));
                                        } else {
                                            alert("Your browser doesn't support the Share API.");
                                        }
                                    }}
                                    sx={{
                                        borderRadius: '17px',
                                        borderColor: 'rgba(255,255,255,0.05)',
                                        fontSize: '10px'
                                    }}
                                >
                                    <ShareIcon fontSize="inherit" sx={{ mr: 1 }} />
                                </Button>
                            </Tooltip>

                            {gsplMetadata?.metadata?.discord && (
                                <Button
                                    aria-label="discord"
                                    variant="outlined"
                                    color="inherit"
                                    href={gsplMetadata.metadata.discord}
                                    target="_blank"
                                    sx={{
                                        borderRadius: '17px',
                                        borderColor: 'rgba(255,255,255,0.05)',
                                        fontSize: '10px'
                                    }}
                                >
                                    <DiscordIcon sx={{ mt: 0.5, fontSize: 17.5, color: 'white' }} />
                                </Button>
                            )}

                            {gsplMetadata?.metadata?.twitter && (
                                <Button
                                    aria-label="twitter"
                                    variant="outlined"
                                    color="inherit"
                                    href={`https://x.com/${gsplMetadata.metadata.twitter}`}
                                    target="_blank"
                                    sx={{
                                        borderRadius: '17px',
                                        borderColor: 'rgba(255,255,255,0.05)',
                                        fontSize: '10px'
                                    }}
                                >
                                    <XIcon fontSize="inherit" sx={{ mr: 1 }} />
                                </Button>
                            )}

                            {gsplMetadata?.metadata?.website && (
                                <Button
                                    aria-label="website"
                                    variant="outlined"
                                    color="inherit"
                                    href={gsplMetadata.metadata.website}
                                    target="_blank"
                                    sx={{
                                        borderRadius: '17px',
                                        borderColor: 'rgba(255,255,255,0.05)',
                                        fontSize: '10px'
                                    }}
                                >
                                    <LanguageIcon fontSize="inherit" sx={{ mr: 1 }} />
                                </Button>
                            )}
                        </ButtonGroup>
                    </Grid>
                </Grid>
            </Grid>
        </>
    )
}