angular.module('cmCreditApp').controller('DetailController', ['$scope', '$routeParams', '$location', '$window', '$http', '$sce', 'ApiService', 'AuthService', 'TokenService', function($scope, $routeParams, $location, $window, $http, $sce, ApiService, AuthService, TokenService) {
  // Vérifier l'authentification
  if (!AuthService.isAuthenticated()) {
    $location.path('/login');
    return;
  }

  $scope.loading = true;
  $scope.error = null;
  $scope.caseDetail = null;
  $scope.allCases = [];
  $scope.currentIndex = -1;
  $scope.prevCaseId = null;
  $scope.nextCaseId = null;
  $scope.viewerOpen = false;
  $scope.viewerUrl = null;
  $scope.viewerTitle = '';
  $scope.viewerMimeType = 'application/pdf';
  $scope.viewerSourceUrl = null;

  // D'abord charger la liste pour la navigation
  ApiService.getCases()
    .then(function(response) {
      $scope.allCases = response.data;
      $scope.currentIndex = $scope.allCases.findIndex(c => c.id === $routeParams.id);
      updateNavigationButtons();
    })
    .catch(function(error) {
      if (error.status === 401 || error.status === 502) {
        alert('Votre session a expiré. Veuillez vous reconnecter.');
        AuthService.logout();
      }
    });

  // Puis charger le détail du cas
  ApiService.getCaseById($routeParams.id)
    .then(function(response) {
      $scope.caseDetail = response.data;
    })
    .catch(function(error) {
      if (error.status === 401) {
        AuthService.logout();
      } else {
        $scope.error = error?.data?.message || 'Erreur de chargement du dossier';
      }
    })
    .finally(function() {
      $scope.loading = false;
    });

  function updateNavigationButtons() {
    if ($scope.currentIndex > 0) {
      $scope.prevCaseId = $scope.allCases[$scope.currentIndex - 1].id;
    } else {
      $scope.prevCaseId = null;
    }

    if ($scope.currentIndex < $scope.allCases.length - 1) {
      $scope.nextCaseId = $scope.allCases[$scope.currentIndex + 1].id;
    } else {
      $scope.nextCaseId = null;
    }
  }

  $scope.goBack = function() {
    $location.path('/cases');
  };

  $scope.goPrevious = function() {
    if ($scope.prevCaseId) {
      $location.path('/cases/' + $scope.prevCaseId);
    }
  };

  $scope.goNext = function() {
    if ($scope.nextCaseId) {
      $location.path('/cases/' + $scope.nextCaseId);
    }
  };

  $scope.formatDate = function(dateString) {
    if (!dateString) return '-';
    try {
      var d = new Date(dateString);
      if (isNaN(d.getTime())) return '-';
      var pad = function(n) { return ('0' + n).slice(-2); };
      return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear()
        + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch(e) { return '-'; }
  };

  $scope.getSlaStyle = function(slaStatus) {
    var s = String(slaStatus || '').toLowerCase();
    if (s.includes('ok') || s.includes('green') || s.includes('respect')) return { color: '#166534', fontWeight: '600' };
    if (s.includes('warning') || s.includes('orange') || s.includes('attention')) return { color: '#ca8a04', fontWeight: '600' };
    if (s.includes('breach') || s.includes('red') || s.includes('dépassé')) return { color: '#b91c1c', fontWeight: '600' };
    return { color: '#475569' };
  };

  $scope.getStageStyle = function(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'active' || s === 'inprogress' || s === 'running')
      return { background: '#e0f7fa', color: '#0b7280' };
    if (s === 'completed')
      return { background: '#dcfce7', color: '#166534' };
    if (s === 'faulted' || s === 'failed' || s === 'error')
      return { background: '#fee2e2', color: '#b91c1c' };
    return { background: '#f1f5f9', color: '#475569' };
  };

  $scope.getTaskStyle = function(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'completed' || s === 'done')
      return { background: '#dcfce7', color: '#166534' };
    if (s === 'pending' || s === 'waiting')
      return { background: '#fef9c3', color: '#92400e' };
    if (s === 'active' || s === 'inprogress' || s === 'running')
      return { background: '#e0f7fa', color: '#0b7280' };
    if (s === 'failed' || s === 'faulted' || s === 'error')
      return { background: '#fee2e2', color: '#b91c1c' };
    return { background: '#f1f5f9', color: '#475569' };
  };

  $scope.openMaestroDetail = function() {
    if (!$scope.caseDetail) return;
    const caseId = encodeURIComponent($scope.caseDetail.id || '');
    const folderKey = encodeURIComponent($scope.caseDetail.folderKey || '');
    const url = `https://staging.uipath.com/france/DefaultTenant/maestro_/case-management/${caseId}/overview?folderKey=${folderKey}`;
    $window.open(url, '_blank', 'noopener,noreferrer');
  };

  function guessMimeType(fileName, headerType) {
    const normalizedHeader = String(headerType || '').toLowerCase();
    if (normalizedHeader && normalizedHeader !== 'application/octet-stream') {
      return normalizedHeader;
    }

    const name = String(fileName || '').toLowerCase();
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.txt')) return 'text/plain';
    return 'application/octet-stream';
  }

  function fetchDocumentBlob(url, fileName) {
    const token = TokenService.getToken();
    if (!token) {
      AuthService.logout();
      return Promise.reject(new Error('missing-token'));
    }

    return $http.get(url, {
      responseType: 'blob',
      headers: {
        Authorization: 'Bearer ' + token,
      },
    }).then(function(response) {
      const headerType = response.headers('content-type');
      const mimeType = guessMimeType(fileName, headerType);
      const typedBlob = new Blob([response.data], { type: mimeType });
      return {
        blob: typedBlob,
        mimeType: mimeType,
      };
    }).catch(function(error) {
      if (error.status === 401 || error.status === 502) {
        alert('Session expirée. Veuillez vous reconnecter.');
        AuthService.logout();
        throw error;
      }
      alert('Impossible d\'ouvrir le document.');
      throw error;
    });
  }

  $scope.openDocument = function(url, fileName) {
    fetchDocumentBlob(url, fileName).then(function(result) {
      if ($scope.viewerUrl) {
        $window.URL.revokeObjectURL($scope.viewerUrl);
      }
      const blobUrl = $window.URL.createObjectURL(result.blob);
      $scope.viewerUrl = blobUrl;
      $scope.viewerTitle = fileName || 'Document';
      $scope.viewerMimeType = result.mimeType;
      $scope.viewerSourceUrl = url;
      $scope.viewerSafeUrl = $sce.trustAsResourceUrl(blobUrl);
      $scope.viewerOpen = true;

      if (result.mimeType === 'application/octet-stream') {
        alert('Ce type de fichier ne peut pas toujours être prévisualisé. Utilise "Nouvel onglet" si besoin.');
      }
    });
  };

  $scope.openDocumentInNewTab = function(url, fileName) {
    const newTab = $window.open('', '_blank');
    if (!newTab) {
      alert('Pop-up bloquée. Autorise les pop-ups puis réessaie.');
      return;
    }

    fetchDocumentBlob(url, fileName).then(function(result) {
      const blobUrl = $window.URL.createObjectURL(result.blob);
      newTab.location.href = blobUrl;
      setTimeout(function() {
        $window.URL.revokeObjectURL(blobUrl);
      }, 120000);
    }).catch(function() {
      newTab.close();
    });
  };

  $scope.closeViewer = function() {
    $scope.viewerOpen = false;
    $scope.viewerTitle = '';
    $scope.viewerSourceUrl = null;
    $scope.viewerSafeUrl = null;
    if ($scope.viewerUrl) {
      $window.URL.revokeObjectURL($scope.viewerUrl);
      $scope.viewerUrl = null;
    }
  };

  $scope.$on('$destroy', function() {
    if ($scope.viewerUrl) {
      $window.URL.revokeObjectURL($scope.viewerUrl);
      $scope.viewerUrl = null;
    }
  });
}]);
