angular.module('cmCreditApp').controller('OAuthCallbackController', ['$location', 'AuthService', function($location, AuthService) {
  // Récupérer le code depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    AuthService.handleCallback(code);
  } else {
    // Erreur OAuth
    console.error('OAuth callback sans code');
    $location.path('/login');
  }
}]);
