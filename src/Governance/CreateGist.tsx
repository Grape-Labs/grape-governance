import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Checkbox, FormControlLabel, CircularProgress,
  Snackbar, Alert, Box
} from '@mui/material';
import { APP_GITHUB_CLIENT_ID } from '../utils/grapeTools/constants';

import GitHubIcon from '@mui/icons-material/GitHub';

export default function CreateGistWithOAuth({ onGistCreated, buttonLabel = '+ Gist', defaultText = '' }) {
  const [open, setOpen] = useState(false);
  const [gistDescription, setGistDescription] = useState('');
  const [gistContent, setGistContent] = useState(defaultText);
  const [isPublic, setIsPublic] = useState(true);
  //const [githubToken, setGithubToken] = useState(null);
  const [userGists, setUserGists] = useState([]);
  const [selectedGistId, setSelectedGistId] = useState(null);
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('github_token'));
  const [loading, setLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [copySnackbarOpen, setCopySnackbarOpen] = useState(false);
  const [gistFilename, setGistFilename] = useState('dao_proposal_snippet.txt');
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');

  const startDeviceFlow = async () => {
    if (!APP_GITHUB_CLIENT_ID) {
      alert('GitHub client ID is not configured.');
      return;
    }

    // Disallow usage on localhost or file:// origins
    const isLocalhost = window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    if (isLocalhost) {
      alert(
        'GitHub authentication is not supported on localhost or file://. Please deploy this app to a public HTTPS URL to test Gist integration.'
      );
      return;
    }

    const res = await fetch('/api/github-device-code', { method: 'POST' });
    const data = await res.json();

    setUserCode(data.user_code);
    setVerificationUri(decodeURIComponent(data.verification_uri));
    setVerificationDialogOpen(true);

    setIsPolling(true); // Start loader

    let pollingInterval = data.interval * 1000;
    let intervalId = null;

    const poll = async () => {
      const tokenRes = await fetch('/api/github-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: data.device_code }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.access_token) {
        clearInterval(intervalId);
        setIsPolling(false);
        setVerificationConfirmed(true); // 👈 add this
        setVerificationDialogOpen(false);
        setGithubToken(tokenData.access_token);
        localStorage.setItem('github_token', tokenData.access_token); // <-- Store token
        // Show confirmation for 2 seconds, then close the dialog
        setTimeout(() => {
          setVerificationDialogOpen(false);
        }, 2000);
      } else if (tokenData.error === 'slow_down' && tokenData.interval) {
        clearInterval(intervalId);
        pollingInterval = (tokenData.interval || data.interval) * 1000;
        intervalId = setInterval(poll, pollingInterval);
      } else if (tokenData.error !== 'authorization_pending') {
        clearInterval(intervalId);
        setIsPolling(false);
        setVerificationDialogOpen(false);
        alert(`OAuth failed: ${tokenData.error}`);
      }
    };

    intervalId = setInterval(poll, pollingInterval);
  };

  const handleCreateGist = async () => {
    setLoading(true);
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        description: gistDescription,
        public: isPublic,
        files: {
          [gistFilename || 'dao_proposal_snippet.txt']: {
            content: gistContent
          }
        }
      })
    });
    setLoading(false);

    if (!res.ok) {
      alert('Failed to create Gist');
      return;
    }

    const data = await res.json();
    onGistCreated(data.html_url);
    handleClose();
  };

  const handleOpen = () => {
    setOpen(true);
    setGistContent(defaultText);
  };

  const handleClose = () => {
    setOpen(false);
    //setGithubToken(null);
    setLoading(false);
    setGistDescription('');
  };

  useEffect(() => {
    const fetchUserGists = async () => {
      if (!githubToken) return;

      const res = await fetch('https://api.github.com/gists', {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUserGists(data);
      }
    };

    fetchUserGists();
  }, [githubToken]);

  return (
    <>
      <Button variant="text" size="small" onClick={handleOpen}>
        {buttonLabel}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>Create GitHub Gist</DialogTitle>
        <DialogContent>
          {!githubToken ? (
            !userCode ? (
              <Button onClick={startDeviceFlow} variant="contained">
                Authenticate with&nbsp;<GitHubIcon/> GitHub
              </Button>
            ) : (
              <>
                <p>To proceed, authorize this app with GitHub.</p>
                <p><strong>Code:</strong> {userCode}</p>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => window.open(verificationUri, '_blank')}
                  sx={{ mt: 1 }}
                >
                  Open GitHub Login Page
                </Button>
              </>
            )
          ) : (
            <>
                {userGists && userGists.length > 0 && (
                  <TextField
                    select
                    fullWidth
                    label="Clone Existing Gist"
                    value={String(selectedGistId) || ''}
                    onChange={async (e) => {
                      const gistId = e.target.value;
                      setSelectedGistId(gistId);

                      const fullGistRes = await fetch(`https://api.github.com/gists/${gistId}`, {
                        headers: {
                          Authorization: `token ${githubToken}`,
                          Accept: 'application/vnd.github.v3+json',
                        }
                      });

                      if (!fullGistRes.ok) {
                        alert('Failed to fetch full Gist content.');
                        return;
                      }

                      const fullGist = await fullGistRes.json();
                      const firstFile = Object.values(fullGist.files)[0];

                      setGistFilename(firstFile?.filename || 'dao_proposal_snippet.txt');
                      setGistContent(firstFile?.content || '');
                      setGistDescription(`Cloned from: ${fullGist.description || 'Untitled'}`);
                    }}
                    SelectProps={{ native: true }}
                    sx={{ mb: 2 }}
                  >
                    <option value="">(Select a gist to clone)</option>
                    {userGists.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.description || 'Untitled'}
                      </option>
                    ))}
                  </TextField>
                )}
                
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Filename"
                  placeholder="e.g. dao_proposal_snippet.txt"
                  value={String(gistFilename || '')}
                  onChange={(e) => setGistFilename(e.target.value)}
                  margin="dense"
                  sx={{ mb: 2 }}
                />

                {/* Description */}
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Gist Description"
                  placeholder="Brief description of your gist"
                  value={String(gistDescription || '')}
                  onChange={(e) => setGistDescription(e.target.value)}
                  margin="dense"
                  sx={{ mb: 2 }}
                />

                {/* Code Content */}
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Code Snippet"
                  placeholder="// Write your Gist Markup code here"
                  value={String(gistContent || '')}
                  onChange={(e) => setGistContent(e.target.value)}
                  multiline
                  rows={10}
                  margin="dense"
                  sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    mb: 2,
                  }}
                />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                }
                label="Public"
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          {githubToken &&
            <Button
                variant="outlined"
                size="small"
                color="secondary"
                onClick={() => {
                  localStorage.removeItem('github_token');
                  setGithubToken(null);
                }}
                sx={{ mt: 2 }}
              >
                Switch GitHub Account
              </Button>
            }
            <Box>
            <Button onClick={handleClose}>Cancel</Button>
            {githubToken && (
              <Button onClick={handleCreateGist} variant="contained" disabled={loading}>
                {loading ? <CircularProgress size={20} /> : 'Create Gist'}
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={verificationDialogOpen} onClose={() => setVerificationDialogOpen(false)}>
        <DialogTitle>Authorize GitHub</DialogTitle>
        <DialogContent>
          <p>To proceed, authorize this app with GitHub.</p>
          <p>
            <strong>Code:</strong>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(userCode);
                setCopySnackbarOpen(true);
              }}
              sx={{
                textTransform: 'none',
                ml: 1,
                fontWeight: 600,
                px: 1.5,
                py: 0.5,
                minWidth: 'auto',
                backgroundColor: '#f0f0f0',
                color: '#333',
                borderColor: '#ccc',
                '&:hover': {
                  backgroundColor: '#e0e0e0',
                }
              }}
              title="Click to copy"
            >
              {userCode}
            </Button>
          </p>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => {
              navigator.clipboard.writeText(userCode);
              setCopySnackbarOpen(true);
              window.open(verificationUri, '_blank');
            }}
            sx={{ mt: 1 }}
          >
            Open GitHub Login Page
          </Button>

          {isPolling && !verificationConfirmed && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <span>Waiting for authorization...</span>
            </div>
          )}

          {verificationConfirmed && (
            <div style={{ marginTop: '16px', color: 'green', fontWeight: 'bold' }}>
              GitHub authentication confirmed! You may now return and create your Gist.
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={copySnackbarOpen}
        autoHideDuration={3000}
        onClose={() => setCopySnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopySnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          Code copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );
}