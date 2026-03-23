import { Router } from 'express';
import { uiPathConfig, hasUiPathBaseConfig } from '../config/uipath.js';

const router = Router();

router.post('/oauth/token', async (req, res) => {
  const { code, redirect_uri: redirectUri, code_verifier: codeVerifier } = req.body || {};

  if (!code) {
    return res.status(400).json({ message: 'Code OAuth requis' });
  }

  if (!hasUiPathBaseConfig()) {
    return res.status(500).json({ message: 'Configuration UiPath incomplète' });
  }

  try {
    const tokenUrl = `${uiPathConfig.baseUrl}/identity_/connect/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || `${req.protocol}://${req.get('host')}/oauth-callback`,
      client_id: uiPathConfig.clientId,
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-UIPATH-TenantName': uiPathConfig.tenantName,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('UiPath token exchange error:', errorText);
      return res.status(response.status).json({
        message: "Erreur lors de l'échange du code OAuth",
        details: errorText,
      });
    }

    const tokenData = await response.json();
    res.json(tokenData);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(502).json({ message: `Erreur serveur: ${error.message}` });
  }
});

export default router;
