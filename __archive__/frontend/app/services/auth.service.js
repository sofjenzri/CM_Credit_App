angular.module('cmCreditApp').factory('AuthService', ['$window', '$location', '$http', 'TokenService', function($window, $location, $http, TokenService) {
  const SESSION_REQUESTS_KEY = 'cm_credit_session_requests';
  // Configuration OAuth UiPath
  const UIPATH_BASE_URL = 'https://staging.uipath.com';
  const UIPATH_ORG = 'france';
  const UIPATH_TENANT = 'DefaultTenant';
  const CLIENT_ID = '405c1e40-87ef-4599-ab72-462bffd4f776';
  const REDIRECT_URI = $window.location.origin + '/oauth-callback';
  const AUTHORIZE_URL = UIPATH_BASE_URL + '/identity_/connect/authorize';

  // Générer code_verifier et code_challenge pour PKCE
  function generateCodeVerifier() {
    const array = new Uint8Array(32);
    $window.crypto.getRandomValues(array);
    return base64URLEncode(array);
  }

  function base64URLEncode(buffer) {
    const bytes = typeof buffer === 'string' ? new TextEncoder().encode(buffer) : buffer;
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return $window.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return $window.crypto.subtle.digest('SHA-256', data).then(function(hash) {
      return new Uint8Array(hash);
    });
  }

  return {
    login: function() {
      // Générer PKCE parameters
      const codeVerifier = generateCodeVerifier();
      
      // Générer code_challenge de manière asynchrone puis rediriger
      sha256(codeVerifier).then(function(hashArray) {
        const codeChallenge = base64URLEncode(hashArray);
        
        // Stocker le verifier pour l'utiliser lors du callback
        $window.sessionStorage.setItem('code_verifier', codeVerifier);
        
        // Redirection vers UiPath OAuth avec PKCE
        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: 'code',
          scope: 'OR.Execution OR.Folders OR.Jobs OR.Tasks DataFabric.Data.Read DataFabric.Data.Write DataFabric.Schema.Read',
          state: Math.random().toString(36).substring(7),
          code_challenge: codeChallenge,
          code_challenge_method: 'S256'
        });
        
        $window.location.href = AUTHORIZE_URL + '?' + params.toString();
      });
    },
    
    logout: function() {
      TokenService.removeToken();
      $window.sessionStorage.removeItem(SESSION_REQUESTS_KEY);
      $location.path('/login');
    },
    
    isAuthenticated: function() {
      return TokenService.hasToken();
    },
    
    handleCallback: function(code) {
      // Récupérer le code_verifier stocké
      const codeVerifier = $window.sessionStorage.getItem('code_verifier');
      if (!codeVerifier) {
        console.error('Code verifier manquant');
        alert('Erreur d\'authentification: code verifier manquant');
        $location.path('/login');
        return;
      }

      // Échanger le code contre un access_token via le backend
      return $http.post('/api/oauth/token', {
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
      }).then(function(response) {
        const accessToken = response.data.access_token;
        if (accessToken) {
          TokenService.saveToken(accessToken);
          $window.sessionStorage.removeItem('code_verifier');
          $window.sessionStorage.removeItem(SESSION_REQUESTS_KEY);
          $location.path('/');
        } else {
          throw new Error('Pas de access_token dans la réponse');
        }
      }).catch(function(error) {
        console.error('Token exchange error:', error);
        alert('Erreur d\'authentification: ' + (error.data?.message || error.message));
        $window.sessionStorage.removeItem('code_verifier');
        $location.path('/login');
      });
    }
  };
}]);
