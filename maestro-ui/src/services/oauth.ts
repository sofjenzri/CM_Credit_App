const CODE_VERIFIER_KEY = 'code_verifier';
const OAUTH_STATE_KEY = 'oauth_state';
const AUTH_TOKEN_KEY = 'auth_token';
const UIPATH_ACCESS_TOKEN_KEY = 'uipath_access_token';

const UIPATH_BASE_URL = import.meta.env.VITE_UIPATH_BASE_URL || 'https://staging.uipath.com';
const CLIENT_ID = import.meta.env.VITE_UIPATH_CLIENT_ID || '405c1e40-87ef-4599-ab72-462bffd4f776';
const OAUTH_SCOPE =
  import.meta.env.VITE_UIPATH_SCOPE ||
  'OR.Execution OR.Folders OR.Jobs OR.Tasks PIMS DataFabric.Data.Read DataFabric.Data.Write DataFabric.Schema.Read';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const OAUTH_REDIRECT_URI = import.meta.env.VITE_UIPATH_REDIRECT_URI || `${window.location.origin}/oauth-callback`;

const base64UrlEncode = (input: Uint8Array) => {
  const binary = Array.from(input)
    .map((byte) => String.fromCharCode(byte))
    .join('');

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const generateCodeVerifier = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

const generateState = () => {
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

const buildCodeChallenge = async (codeVerifier: string) => {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
};

const getRedirectUri = () => OAUTH_REDIRECT_URI;

const saveAccessToken = (token: string) => {
  localStorage.setItem(UIPATH_ACCESS_TOKEN_KEY, token);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthStorage = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(UIPATH_ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem(UIPATH_ACCESS_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (payload) {
    const exp = payload.exp as number | undefined;
    if (exp && Date.now() / 1000 > exp) {
      clearAuthStorage();
      return false;
    }
  }
  return true;
};

export const getAuthenticatedUser = (): { name: string; initials: string; email: string } | null => {
  const token = localStorage.getItem(UIPATH_ACCESS_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const name =
    (payload.name as string) ||
    (payload.given_name as string) ||
    (payload.sub as string) ||
    'Utilisateur';
  const email = (payload.email as string) || '';
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return { name, initials, email };
};

export const startOAuthLogin = async () => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await buildCodeChallenge(codeVerifier);
  const state = generateState();

  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const authorizeUrl = `${UIPATH_BASE_URL}/identity_/connect/authorize`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: OAUTH_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${authorizeUrl}?${params.toString()}`;
};

export const handleOAuthCallback = async (code: string, state?: string | null) => {
  const savedCodeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);

  if (!savedCodeVerifier) {
    throw new Error('Code verifier manquant. Relance la connexion OAuth.');
  }

  if (savedState && state && savedState !== state) {
    throw new Error('Etat OAuth invalide. Relance la connexion.');
  }

  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: savedCodeVerifier,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Erreur OAuth');
  }

  if (!payload?.access_token) {
    throw new Error('Aucun access_token reçu depuis le backend OAuth.');
  }

  saveAccessToken(payload.access_token);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
};
