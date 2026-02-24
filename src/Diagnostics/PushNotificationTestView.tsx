import React from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { enableRealmPushNotifications } from '../firebaseNotifications/realmPush';
import { fetchToken } from '../firebaseNotifications/firebase';

const DEFAULT_REALM = 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';

export default function PushNotificationTestView(): JSX.Element {
  const [realm, setRealm] = React.useState(DEFAULT_REALM);
  const [title, setTitle] = React.useState('Push Test');
  const [body, setBody] = React.useState('If you can read this, push notifications are working.');
  const [secret, setSecret] = React.useState('');
  const [token, setToken] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const [responseJson, setResponseJson] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);

  const safeSetStatus = (value: string) => setStatus(value);

  const handleRegister = async () => {
    setLoading(true);
    setResponseJson('');
    try {
      const result = await enableRealmPushNotifications(realm);
      const currentToken = await fetchToken();
      setToken(currentToken || '');

      if (!result?.ok) {
        safeSetStatus(`Registration result: ${result?.reason || 'unknown'}`);
        return;
      }

      safeSetStatus('Push permissions granted and token registered.');
    } catch (error: any) {
      safeSetStatus(`Registration failed: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGetToken = async () => {
    setLoading(true);
    setResponseJson('');
    try {
      const currentToken = await fetchToken();
      if (!currentToken) {
        safeSetStatus('No token available yet. Check notification permissions.');
        return;
      }
      setToken(currentToken);
      safeSetStatus('Token loaded.');
    } catch (error: any) {
      safeSetStatus(`Token fetch failed: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setLoading(true);
    setResponseJson('');
    try {
      const currentToken = token || (await fetchToken());
      if (!currentToken) {
        safeSetStatus('No FCM token available. Register first.');
        return;
      }
      setToken(currentToken);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (secret.trim()) {
        headers['x-push-test-secret'] = secret.trim();
      }

      const response = await fetch('/api/notifications-test', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          realm,
          token: currentToken,
          title,
          body,
        }),
      });

      const text = await response.text();
      setResponseJson(text);
      if (!response.ok) {
        safeSetStatus(`Test push failed (${response.status}).`);
        return;
      }

      safeSetStatus('Test push sent. Check foreground/background notifications.');
    } catch (error: any) {
      safeSetStatus(`Test push request failed: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h4">Push Notification Test</Typography>
          <Typography variant="body2" color="text.secondary">
            Use this page to verify realm push setup end-to-end.
          </Typography>

          <TextField
            label="Realm"
            value={realm}
            onChange={(e) => setRealm(e.target.value)}
            fullWidth
          />
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
          />
          <TextField
            label="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Test Secret (optional)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            fullWidth
            helperText="Needed if REALM_PUSH_TEST_SECRET (or cron secret) is set on server."
          />
          <TextField
            label="Current FCM Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={loading} onClick={handleRegister}>
              1) Register Token
            </Button>
            <Button variant="outlined" disabled={loading} onClick={handleGetToken}>
              2) Refresh Token
            </Button>
            <Button variant="contained" color="secondary" disabled={loading} onClick={handleSendTest}>
              3) Send Test Push
            </Button>
          </Stack>

          {status ? <Alert severity="info">{status}</Alert> : null}

          {responseJson ? (
            <Box
              component="pre"
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.default',
                overflow: 'auto',
                maxHeight: 280,
                fontSize: 12,
              }}
            >
              {responseJson}
            </Box>
          ) : null}
        </Stack>
      </Paper>
    </Container>
  );
}
