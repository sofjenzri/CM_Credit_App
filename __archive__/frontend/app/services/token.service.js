angular.module('cmCreditApp').factory('TokenService', ['$window', function($window) {
  const STORAGE_KEY = 'uipath_access_token';

  return {
    saveToken: function(token) {
      $window.localStorage.setItem(STORAGE_KEY, token);
    },
    getToken: function() {
      return $window.localStorage.getItem(STORAGE_KEY);
    },
    removeToken: function() {
      $window.localStorage.removeItem(STORAGE_KEY);
    },
    hasToken: function() {
      return !!this.getToken();
    }
  };
}]);
