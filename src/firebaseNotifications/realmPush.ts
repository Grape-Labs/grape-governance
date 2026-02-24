import { fetchToken } from './firebase';

const DEFAULT_REALM = 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
const REGISTRATION_FLAG_PREFIX = 'realm_push_registered';

function supportsNotifications() {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined';
}

function registrationFlagKey(realm: string) {
  return `${REGISTRATION_FLAG_PREFIX}:${realm}`;
}

export async function registerRealmPushToken(realm: string = DEFAULT_REALM) {
  const token = await fetchToken();
  if (!token) return { ok: false, reason: 'token_unavailable' };

  const response = await fetch('/api/notifications-register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      realm,
      token,
      enabled: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to register token (${response.status}): ${text}`);
  }

  return { ok: true, token };
}

export async function enableRealmPushNotifications(realm: string = DEFAULT_REALM) {
  if (!supportsNotifications()) {
    return { ok: false, reason: 'notifications_not_supported' };
  }

  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return { ok: false, reason: 'permission_denied' };
  }

  const result = await registerRealmPushToken(realm);
  if (result.ok) {
    localStorage.setItem(registrationFlagKey(realm), '1');
  }
  return result;
}

export function shouldAttemptRealmRegistration(realm: string = DEFAULT_REALM) {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(registrationFlagKey(realm)) !== '1';
}
