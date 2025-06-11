import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Checkbox, FormControlLabel, CircularProgress
} from '@mui/material';
import { APP_GITHUB_CLIENT_ID } from '../utils/grapeTools/constants';

export default function CreateGistWithOAuth({ onGistCreated, buttonLabel = '+ Gist', defaultText = '' }) {
  const [open, setOpen] = useState(false);
  const [gistDescription, setGistDescription] = useState('');
  const [gistContent, setGistContent] = useState(defaultText);
  const [isPublic, setIsPublic] = useState(true);
  const [githubToken, setGithubToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');

  const startDeviceFlow = async () => {
    if (!APP_GITHUB_CLIENT_ID) {
      alert('GitHub client ID is not configured.');
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
        setVerificationDialogOpen(false);
        setGithubToken(tokenData.access_token);
        alert('GitHub authentication successful. You may now create a Gist.');
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
          'snippet.txt': {
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
    setGithubToken(null);
    setLoading(false);
    setGistDescription('');
  };

  return (
    <>
      <Button variant="text" size="small" onClick={handleOpen}>
        {buttonLabel}
      </Button>

      <Dialog open={open} onClose={handleClose} fullWidth>
        <DialogTitle>Create GitHub Gist</DialogTitle>
        <DialogContent>
          {!githubToken ? (
            !userCode ? (
              <Button onClick={startDeviceFlow} variant="contained">
                Authenticate with GitHub
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
              <TextField
                fullWidth
                label="Gist Description"
                value={gistDescription}
                onChange={(e) => setGistDescription(e.target.value)}
                margin="dense"
              />
              <TextField
                fullWidth
                label="Content"
                value={gistContent}
                onChange={(e) => setGistContent(e.target.value)}
                multiline
                rows={6}
                margin="dense"
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
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          {githubToken && (
            <Button onClick={handleCreateGist} variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={20} /> : 'Create Gist'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <DialogContent>
        <p>To proceed, authorize this app with GitHub.</p>
        <p>
          <strong>Code:</strong> {userCode}
        </p>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => window.open(verificationUri, '_blank')}
          sx={{ mt: 1 }}
        >
          Open GitHub Login Page
        </Button>

        {isPolling && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <span>Waiting for authorization...</span>
          </div>
        )}
      </DialogContent>
    </>
  );
}