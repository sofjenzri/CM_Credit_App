angular.module('cmCreditApp').factory('ApiService', ['$http', 'TokenService', function($http, TokenService) {
  const baseUrl = '/api';
  const SESSION_REQUESTS_KEY = 'cm_credit_session_requests';

  function withAuthReset(promise) {
    return promise.catch(function(error) {
      if (error && error.status === 401) {
        TokenService.removeToken();
        window.sessionStorage.removeItem(SESSION_REQUESTS_KEY);
      }
      throw error;
    });
  }

  function getHeaders() {
    const token = localStorage.getItem('uipath_access_token');
    if (token) {
      return { 'Authorization': 'Bearer ' + token };
    }
    return {};
  }

  return {
    getCases: function() {
      return withAuthReset($http.get(baseUrl + '/cases', { headers: getHeaders() }));
    },
    getCaseById: function(id) {
      return withAuthReset($http.get(baseUrl + '/cases/' + encodeURIComponent(id), { headers: getHeaders() }));
    },
    submitLoanRequest: function(formData) {
      const headers = getHeaders();
      headers['Content-Type'] = undefined;
      return withAuthReset($http.post(baseUrl + '/loan-requests', formData, {
        headers: headers,
        transformRequest: angular.identity,
      }));
    }
  };
}]);
