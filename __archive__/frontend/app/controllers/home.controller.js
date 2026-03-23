angular.module('cmCreditApp').controller('HomeController', ['$scope', '$location', 'ApiService', 'AuthService', function($scope, $location, ApiService, AuthService) {
  // Vérifier l'authentification
  if (!AuthService.isAuthenticated()) {
    $location.path('/login');
    return;
  }

  $scope.loading = true;
  $scope.refreshing = false;
  $scope.error = null;
  $scope.allCases = [];
  $scope.filteredCases = [];
  $scope.searchQuery = '';
  $scope.activeGroup = 'running';

  const RUNNING_STATUSES   = new Set(['Running', 'Paused', 'Transitioning', 'Pending']);
  const COMPLETED_STATUSES = new Set(['Completed', 'Cancelled']);
  const FAULTED_STATUSES   = new Set(['Faulted', 'Failed', 'Error']);

  function groupForStatus(status) {
    const s = String(status || '');
    if (FAULTED_STATUSES.has(s))   return 'faulted';
    if (COMPLETED_STATUSES.has(s)) return 'completed';
    return 'running';
  }

  $scope.logout = function() {
    AuthService.logout();
  };

  $scope.goBack = function() {
    $location.path('/');
  };

  $scope.formatDate = function(dateString) {
    if (!dateString) return '-';
    try {
      var date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      var day = ('0' + date.getDate()).slice(-2);
      var month = ('0' + (date.getMonth() + 1)).slice(-2);
      var year = date.getFullYear();
      var hours = ('0' + date.getHours()).slice(-2);
      var minutes = ('0' + date.getMinutes()).slice(-2);
      return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
    } catch (e) {
      return '-';
    }
  };

  $scope.calculateElapsedTime = function(createdTime) {
    if (!createdTime) return '-';
    try {
      var start = new Date(createdTime);
      var now = new Date();
      if (isNaN(start.getTime())) return '-';
      var diffMs = now - start;
      var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      var diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffDays > 0) {
        return diffDays + 'j ' + diffHours + 'h';
      } else if (diffHours > 0) {
        return diffHours + 'h ' + diffMinutes + 'min';
      } else {
        return diffMinutes + 'min';
      }
    } catch (e) {
      return '-';
    }
  };

  $scope.getSlaStyle = function(slaStatus) {
    var status = String(slaStatus || '').toLowerCase();
    if (status.includes('ok') || status.includes('green') || status.includes('respect')) {
      return { color: '#166534' };
    } else if (status.includes('warning') || status.includes('orange') || status.includes('attention')) {
      return { color: '#ca8a04' };
    } else if (status.includes('breach') || status.includes('red') || status.includes('dépassé')) {
      return { color: '#b91c1c' };
    }
    return { color: '#475569' };
  };

  function loadCases(isRefresh) {
    if (isRefresh) { $scope.refreshing = true; }
    else           { $scope.loading = true; $scope.error = null; }

    ApiService.getCases()
      .then(function(response) {
        $scope.allCases = response.data;
        filterCases();
      })
      .catch(function(error) {
        if (error.status === 401 || error.status === 502) {
          alert('Votre session a expiré. Veuillez vous reconnecter.');
          AuthService.logout();
        } else {
          $scope.error = error?.data?.message || 'Erreur de chargement des dossiers';
        }
      })
      .finally(function() {
        $scope.loading = false;
        $scope.refreshing = false;
      });
  }

  loadCases(false);

  $scope.refresh = function() {
    if ($scope.refreshing) return;
    loadCases(true);
  };

  function filterCases() {
    const query = String($scope.searchQuery || '').toLowerCase();
    $scope.filteredCases = $scope.allCases.filter(function(item) {
      const inGroup = groupForStatus(item.status) === $scope.activeGroup;
      const matchSearch = !query ||
        String(item.caseId     || '').toLowerCase().includes(query) ||
        String(item.clientName || '').toLowerCase().includes(query) ||
        String(item.id         || '').toLowerCase().includes(query);
      return inGroup && matchSearch;
    });
  }

  $scope.groupCount = function(groupName) {
    return $scope.allCases.filter(function(item) {
      return groupForStatus(item.status) === groupName;
    }).length;
  };

  $scope.selectGroup = function(groupName) {
    $scope.activeGroup = groupName;
    filterCases();
  };

  $scope.$watch('searchQuery', function() { filterCases(); });

  $scope.getStatusBadgeStyle = function(status) {
    var g = groupForStatus(status);
    if (g === 'faulted')   return { background: '#fee2e2', color: '#b91c1c' };
    if (g === 'completed') return { background: '#dcfce7', color: '#166534' };
    return { background: '#e0f7fa', color: '#0b7280' };
  };

  $scope.getStatusDotColor = function(status) {
    var g = groupForStatus(status);
    if (g === 'faulted')   return '#b91c1c';
    if (g === 'completed') return '#166534';
    return '#0b7280';
  };

  $scope.openDetail = function(id) {
    $location.path('/cases/' + id);
  };
}]);
