import { uiPathConfig, hasClientCredentials } from '../config/uipath.js';

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

export const getBearerTokenFromRequest = (req) => {
  const header = String(req.headers.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
};

export const getAccessTokenByClientCredentials = async () => {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }

  if (!hasClientCredentials()) {
    throw new Error('Client credentials manquants. Fournis un Bearer token OAuth dans Authorization, ou configure UIPATH_CLIENT_ID/UIPATH_CLIENT_SECRET.');
  }

  const tokenUrl = `${uiPathConfig.baseUrl}/${uiPathConfig.orgName}/identity_/connect/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: uiPathConfig.clientId,
    client_secret: uiPathConfig.clientSecret,
    scope: uiPathConfig.scope,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token UiPath refusé (${response.status}): ${text}`);
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (Number(data.expires_in || 3600) * 1000),
  };

  return tokenCache.accessToken;
};

export const resolveAuthToken = async (req) => {
  const bearerToken = getBearerTokenFromRequest(req);
  if (bearerToken) return bearerToken;
  return getAccessTokenByClientCredentials();
};

export const buildUiPathUrl = (path, query = {}) => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(`${uiPathConfig.baseUrl}/${uiPathConfig.orgName}/${uiPathConfig.tenantName}/${normalizedPath}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

export const withDataFabricFolderContext = (path, query = {}) => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  if (!normalizedPath.startsWith('datafabric_/api/')) return query;
  if (!uiPathConfig.folderKey) return query;
  if (query.folderKey !== undefined && query.folderKey !== null && query.folderKey !== '') return query;
  return { ...query, folderKey: uiPathConfig.folderKey };
};

export const parseUiPathJsonResponse = async (response, path, contextLabel = '') => {
  const statusLabel = contextLabel ? ` (${contextLabel})` : '';
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`UiPath API erreur (${response.status}) sur ${path}${statusLabel}: ${bodyText}`);
  }

  if (!bodyText) return {};

  const seemsHtml = bodyText.trim().startsWith('<!DOCTYPE') || bodyText.trim().startsWith('<html');
  try {
    return JSON.parse(bodyText);
  } catch {
    const preview = bodyText.slice(0, 300);
    const hint = seemsHtml
      ? 'Réponse HTML reçue (token/scope invalide ou endpoint non-JSON).'
      : 'Réponse non JSON reçue.';
    throw new Error(
      `UiPath API réponse invalide sur ${path}${statusLabel}: ${hint} content-type=${contentType || 'unknown'} body=${preview}`,
    );
  }
};

export const uiPathJsonRequest = async (token, path, query = {}) => {
  const response = await fetch(buildUiPathUrl(path, withDataFabricFolderContext(path, query)), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return parseUiPathJsonResponse(response, path);
};

export const uiPathJsonRequestWithoutFolderContext = async (token, path, query = {}) => {
  const response = await fetch(buildUiPathUrl(path, query), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return parseUiPathJsonResponse(response, path, 'no-folder');
};

export const buildUiPathHeaders = (token, extraHeaders = {}) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...extraHeaders,
});

export const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const uiPathJsonRequestWithHeaders = async (token, path, query = {}, extraHeaders = {}) => {
  const response = await fetch(buildUiPathUrl(path, query), {
    headers: buildUiPathHeaders(token, extraHeaders),
  });
  return parseUiPathJsonResponse(response, path);
};

export const uiPathRequest = async (token, path, options = {}) => {
  const { method = 'GET', query = {}, headers = {}, body } = options;

  const response = await fetch(buildUiPathUrl(path, withDataFabricFolderContext(path, query)), {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let json = null;
  if (contentType.includes('application/json') && text) {
    try { json = JSON.parse(text); } catch { json = null; }
  }

  return { ok: response.ok, status: response.status, text, json };
};
