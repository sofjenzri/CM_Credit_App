angular.module('cmCreditApp').controller('LandingController', ['$scope', '$location', 'AuthService', function($scope, $location, AuthService) {
  if (!AuthService.isAuthenticated()) {
    $location.path('/login');
    return;
  }

  $scope.goToClient = function() {
    $location.path('/client');
  };

  $scope.goToEmployee = function() {
    $location.path('/cases');
  };
}]);
