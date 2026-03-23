angular.module('cmCreditApp', ['ngRoute'])
  .config(['$locationProvider', function($locationProvider) {
    $locationProvider.html5Mode(true);
  }])
  .run(['$rootScope', '$location', 'TokenService', 'AuthService', function($rootScope, $location, TokenService, AuthService) {
    function updatePageHeader(path) {
      var normalizedPath = path || '';

      if (normalizedPath === '/loan-request') {
        $rootScope.pageHeader = {
          title: 'Demande de prêt personnel',
          subtitle: 'UiBank - Formulaire de Demande de Prêt (DEMO)',
          meta: 'Généré le 24/02/2026 - Données préremplies pour démonstration.'
        };
        return;
      }

      $rootScope.pageHeader = null;
    }

    function updateRouteContext(path) {
      var normalizedPath = path || '';
      var isEmployeeDetailRoute = /^\/cases\/[^/]+$/.test(normalizedPath);
      $rootScope.isEmployeeSpace = normalizedPath.indexOf('/cases') === 0;
      $rootScope.isAuthRoute = normalizedPath === '/login' || normalizedPath === '/oauth-callback';
      $rootScope.isAuthenticated = TokenService.hasToken();
      $rootScope.showTopbarLogout = $rootScope.isAuthenticated && !$rootScope.isAuthRoute && !isEmployeeDetailRoute;
    }

    $rootScope.logoutFromTopbar = function() {
      AuthService.logout();
    };

    $rootScope.$on('$routeChangeSuccess', function() {
      var path = $location.path();
      updatePageHeader(path);
      updateRouteContext(path);
    });

    updatePageHeader($location.path());
    updateRouteContext($location.path());
  }]);
