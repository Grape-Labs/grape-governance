import { Link } from 'react-router-dom';
import { 
  Button, 
  Box, 
  Typography, 
  Grid, 
  Divider, 
  Chip, 
  LinearProgress,
  LinearProgressProps, } from '@mui/material';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import moment from 'moment';
import React from 'react';
import ExplorerView from '../utils/grapeTools/Explorer'; // Adjust import if needed
import { RenderDescription } from './RenderDescription'; // Adjust import if needed
import { styled, useTheme } from '@mui/material/styles';

import { 
    fetchRealmNameFromRulesWallet
} from './api/queries';

import { linearProgressClasses } from '@mui/material/LinearProgress';

type BorderLinearProgressProps = LinearProgressProps & {
    valueYes?: number;
    valueNo?: number;
};

const BorderLinearProgress = styled(LinearProgress)<BorderLinearProgressProps>(({ theme, valueYes, valueNo }) => ({
    marginTop: 6,
    marginBottom: 8,
    height: 15,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: valueNo ? '#AB4D47' : theme.palette.grey[900],
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: valueYes ? '#5C9F62' : valueNo ? '#AB4D47' : theme.palette.grey[900],
      width: valueYes ? `${valueYes}%` : '0%',
    },
  }));

function GetGovernanceFromRulesView(props: any) {
  const { rulesWallet, proposal, name, description, state, draftAt, item } = props;
  const [governanceInfo, setGovernanceInfo] = React.useState<null | { governanceName: string; governanceAddress: string }>(null);

  React.useEffect(() => {
    const loadGovernanceInfo = async () => {

      if (!item?.owner) {
        item.owner = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";
      }
      if (!rulesWallet) {
        console.warn('No rules wallet found for proposal:', proposal);
        return;
      }

      if (rulesWallet && item?.owner) {
        const result = await fetchRealmNameFromRulesWallet(rulesWallet, item?.owner);
        if (result) {
          const { name, realm } = result;
          setGovernanceInfo({
            governanceName: name,
            governanceAddress: realm,
          });
        }
      }
    };

    loadGovernanceInfo();
  }, [rulesWallet, item?.owner]);

  const shortenWord = (word: string) => {
    return word.length > 40 ? word.substring(0, 6) + '...' + word.slice(-8) : word;
  };

  const shortenString = (str: string) => {
    return str.split(' ').map(shortenWord).join(' ');
  };

  const replaceUrls = (text: string) => {
    const regex = /(https?:\/\/[^\s]+)/g;
    return text.replace(regex, (url) => `[LINK] - ${url.split('/')[2]}`);
  };

  return (
    <Button
      component={governanceInfo ? Link : 'div'}
      to={
        governanceInfo
          ? `/proposal/${governanceInfo.governanceAddress}/${proposal}`
          : undefined
      }
      color="inherit"
      sx={{
        borderRadius: '25px',
        p: 1,
        m: 0,
        textTransform: 'none',
        width: '100%',
        textDecoration: state === 6 ? 'line-through' : 'none',
      }}
    >
      <Box sx={{ borderRadius: '17px', background: '#2E2934', p: 2, width: '100%' }}>
        <Grid container>
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ color: 'gray', textAlign: 'left' }}>
              {governanceInfo ? (
                governanceInfo.governanceName
              ) : (
                <Typography sx={{ fontSize: '9px' }}>
                  DNV Proposal{' '}
                  <ExplorerView
                    address={item.pubkey.toBase58()}
                    type="address"
                    shorten={8}
                    hideTitle={false}
                    style="text"
                    color="inherit"
                    fontSize="9px"
                  />
                </Typography>
              )}
            </Typography>

            <Grid container>
              <Grid item sm={8} xs={12} sx={{ textAlign: 'left' }}>
                <Typography
                  variant="h6"
                  color={state === 2 ? 'white' : '#ddd'}
                  sx={{
                    textDecoration: state === 6 ? 'line-through' : 'none',
                  }}
                >
                  {shortenString(name)}
                </Typography>

                <Grid item xs={12} sx={{ mb: 1 }}>
                  {description ? (
                    <Typography
                      variant="body1"
                      color="gray"
                      sx={{ display: 'flex', alignItems: 'center' }}
                    >
                      {replaceUrls(description)}
                    </Typography>
                  ) : (
                    <RenderDescription title={name} description={description} fallback={proposal} />
                  )}
                </Grid>
              </Grid>

              <Divider
                orientation="vertical"
                flexItem
                sx={{ '@media (max-width: 600px)': { display: 'none' } }}
              />

              <Grid item xs sx={{ textAlign: 'right' }}>
                {state === 2 ? (
                  <Grid container sx={{ ml: 1 }}>
                    <Grid item xs>
                      <Typography variant="body2" sx={{ color: 'white', textAlign: 'left' }}>
                        YES:&nbsp;
                        {item.account?.options[0]?.voteWeight > 0
                          ? `${(
                              (item.account.options[0].voteWeight /
                                (item.account.denyVoteWeight +
                                  item.account.options[0].voteWeight)) *
                              100
                            ).toFixed(2)}%`
                          : '0%'}
                      </Typography>
                    </Grid>
                    <Grid item xs>
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        NO:&nbsp;
                        {item.account?.denyVoteWeight > 0
                          ? `${(
                              (item.account.denyVoteWeight /
                                (item.account.denyVoteWeight +
                                  item.account.options[0].voteWeight)) *
                              100
                            ).toFixed(2)}%`
                          : '0%'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <BorderLinearProgress
                        variant="determinate"
                        value={100}
                        valueYes={
                          +(
                            (item.account.options[0].voteWeight /
                              (item.account.denyVoteWeight +
                                item.account.options[0].voteWeight)) *
                            100
                          ).toFixed(2)
                        }
                        valueNo={
                          +(
                            (item.account.denyVoteWeight /
                              (item.account.denyVoteWeight +
                                item.account.options[0].voteWeight)) *
                            100
                          ).toFixed(2)
                        }
                      />
                    </Grid>
                  </Grid>
                ) : null}

                <Grid sx={{ mb: 1 }}>
                  <Chip
                    clickable={false}
                    size="small"
                    color="primary"
                    icon={
                      state === 0 || state === 2 ? (
                        <HourglassTopIcon color="inherit" fontSize="small" />
                      ) : (
                        <HourglassBottomIcon color="inherit" fontSize="small" />
                      )
                    }
                    label={moment.unix(draftAt).fromNow()}
                    sx={{
                      background: '#45404A',
                      borderRadius: '17px',
                      color: state === 2 ? 'white' : '#888',
                      fontSize: '11px',
                    }}
                  />
                </Grid>

                {governanceInfo && (
                  <Grid
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'flex-end',
                      mt: 2,
                    }}
                  >
                    <Button
                      variant="text"
                      startIcon={<ZoomOutMapIcon fontSize="small" sx={{ color: '#ddd' }} />}
                      sx={{ borderRadius: '17px' }}
                    >
                      <Typography variant="caption" sx={{ color: '#ddd' }}>
                        Expand
                      </Typography>
                    </Button>
                  </Grid>
                )}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </Button>
  );
}

export default GetGovernanceFromRulesView;