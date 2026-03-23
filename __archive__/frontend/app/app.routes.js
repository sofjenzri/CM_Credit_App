angular.module('cmCreditApp').config(['$routeProvider', function($routeProvider) {
  $routeProvider
    .when('/login', {
      templateUrl: '/app/templates/login.html',
      controller: 'LoginController'
    })
    .when('/oauth-callback', {
      template: '<div>Authentification en cours...</div>',
      controller: 'OAuthCallbackController'
    })
    .when('/', {
      templateUrl: '/app/templates/landing.html',
      controller: 'LandingController'
    })
    .when('/client', {
      templateUrl: '/app/templates/client-space.html',
      controller: 'ClientSpaceController'
    })
    .when('/loan-request', {
      templateUrl: '/app/templates/loan-request.html',
      controller: 'LoanRequestController'
    })
    .when('/cases', {
      templateUrl: '/app/templates/home.html',
      controller: 'HomeController'
    })
    .when('/cases/:id', {
      templateUrl: '/app/templates/case-detail.html',
      controller: 'DetailController'
    })
    .otherwise({
      redirectTo: '/'
    });
}]);
