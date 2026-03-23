angular.module('cmCreditApp').controller('LoanRequestController', ['$scope', '$location', 'AuthService', 'ApiService', function($scope, $location, AuthService, ApiService) {
  const SESSION_REQUESTS_KEY = 'cm_credit_session_requests';

  if (!AuthService.isAuthenticated()) {
    $location.path('/login');
    return;
  }

  $scope.loanFormData = {
    clientCode: 'CLI-20419',
    fullName: 'Claire Martin',
    birthDate: '12/04/1990',
    birthPlace: 'Paris (75)',
    nationality: 'Française (DEMO)',
    address: '15 rue des Lilas',
    city: '69003 Lyon',
    phone: '+33 6 12 34 56 78',
    email: 'claire.martin.demo@uibox.example',
    familyStatus: 'Divorcée, un enfant',
    housingStatus: 'Locataire (appartement)',
    jobTitle: 'Cheffe de Projet IT',
    employer: 'TechNova Solutions SAS',
    contractType: 'CDI',
    seniority: '5 ans',
    netIncome: 3200,
    otherIncome: 0,
    monthlyCharges: 400,
    debtRatio: 12,
    existingCredits: 'Aucun',
    creditType: 'Prêt personnel',
    requestedAmount: null,
    durationMonths: 48,
    loanPurpose: '',
    bankName: 'Banque Populaire',
    iban: 'FR76 3000 4000 5000 6000 7000 890',
    accountHolder: 'Claire Martin',
    documentsProvided: 'CNI, Facture EDF, Bulletin de salaire, RIB',
    acceptSolvabilityStudy: false,
  };

  $scope.uploadedFiles = [];
  $scope.isDragOver = false;
  $scope.submitting = false;
  $scope.submitError = '';
  $scope.submitSuccess = '';
  $scope.creditTypeOptions = [
    'Prêt personnel',
    'Crédit auto',
    'Crédit immobilier',
    'Crédit travaux',
    'Crédit renouvelable',
    'Regroupement de crédits',
    'Prêt professionnel',
  ];

  function formatFileSize(sizeInBytes) {
    if (!sizeInBytes || sizeInBytes <= 0) return '0 Ko';
    if (sizeInBytes < 1024) return sizeInBytes + ' o';
    if (sizeInBytes < 1024 * 1024) return (sizeInBytes / 1024).toFixed(1) + ' Ko';
    return (sizeInBytes / (1024 * 1024)).toFixed(2) + ' Mo';
  }

  function addFiles(fileList) {
    if (!fileList || !fileList.length) return;

    Array.from(fileList).forEach(function(file) {
      var isDuplicate = $scope.uploadedFiles.some(function(existingFile) {
        return existingFile.name === file.name && existingFile.size === file.size && existingFile.lastModified === file.lastModified;
      });

      if (isDuplicate) return;

      $scope.uploadedFiles.push({
        uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        sizeLabel: formatFileSize(file.size),
        rawFile: file,
      });
    });
  }

  $scope.openFilePicker = function() {
    var fileInput = document.getElementById('loan-file-input');
    if (!fileInput) return;
    fileInput.click();
  };

  $scope.onFilesSelected = function(fileList) {
    addFiles(fileList);
    if (!$scope.$$phase) {
      $scope.$apply();
    }
  };

  $scope.onDragOver = function() {
    $scope.isDragOver = true;
    if (!$scope.$$phase) {
      $scope.$apply();
    }
  };

  $scope.onDragLeave = function() {
    $scope.isDragOver = false;
    if (!$scope.$$phase) {
      $scope.$apply();
    }
  };

  $scope.onFilesDropped = function(event) {
    $scope.isDragOver = false;
    var files = event && event.dataTransfer ? event.dataTransfer.files : null;
    addFiles(files);
    if (!$scope.$$phase) {
      $scope.$apply();
    }
  };

  $scope.removeUploadedFile = function(uid) {
    $scope.uploadedFiles = $scope.uploadedFiles.filter(function(file) {
      return file.uid !== uid;
    });
  };

  $scope.clearUploadedFiles = function() {
    $scope.uploadedFiles = [];
  };

  function parseAmount(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    var normalized = String(value)
      .replace(/\s/g, '')
      .replace(',', '.');
    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function loadSessionRequests() {
    try {
      const raw = window.sessionStorage.getItem(SESSION_REQUESTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function saveSessionRequests(requests) {
    window.sessionStorage.setItem(SESSION_REQUESTS_KEY, JSON.stringify(requests));
  }

  function addSessionRequest(item) {
    const current = loadSessionRequests();
    const next = [item, ...current].slice(0, 50);
    saveSessionRequests(next);
  }

  function getValidationErrors() {
    var errors = [];
    var purpose = String($scope.loanFormData.loanPurpose || '').trim();
    var amount = parseAmount($scope.loanFormData.requestedAmount);
    var consent = $scope.loanFormData.acceptSolvabilityStudy === true;

    if (!purpose) errors.push('objet du prêt');
    if (!(amount > 0)) errors.push('montant demandé');
    if (!consent) errors.push('consentement de solvabilité');

    return errors;
  }

  $scope.canSubmit = function() {
    return getValidationErrors().length === 0;
  };

  $scope.submit = function() {
    var missingFields = getValidationErrors();
    if (missingFields.length > 0) {
      $scope.submitError = 'Champs à compléter : ' + missingFields.join(', ') + '.';
      return;
    }

    $scope.submitting = true;
    $scope.submitError = '';
    $scope.submitSuccess = '';

    const formData = new FormData();
    formData.append('payload', JSON.stringify($scope.loanFormData));

    $scope.uploadedFiles.forEach(function(fileItem) {
      if (fileItem && fileItem.rawFile) {
        formData.append('documents', fileItem.rawFile, fileItem.name || fileItem.rawFile.name || 'document.bin');
      }
    });

    ApiService.submitLoanRequest(formData)
      .then(function(response) {
        const data = response.data || {};
        const createdCaseId = data.caseId || 'N/A';
        const successDocuments = Array.isArray(data.uploadedDocuments) ? data.uploadedDocuments.length : 0;
        const failedDocuments = Array.isArray(data.failedDocuments) ? data.failedDocuments.length : 0;

        addSessionRequest({
          caseId: createdCaseId,
          requestDate: new Date().toISOString(),
          dossierStatus: 'Initiation',
          documentsCount: successDocuments,
        });

        $scope.submitSuccess = `Dossier ${createdCaseId} créé. Documents: ${successDocuments} importé(s), ${failedDocuments} en échec.`;
        $scope.uploadedFiles = [];
      })
      .catch(function(error) {
        $scope.submitError = error?.data?.message || 'Erreur lors de la création de la demande de crédit.';
      })
      .finally(function() {
        $scope.submitting = false;
      });
  };

  $scope.goBack = function() {
    $location.path('/client');
  };

  $scope.cancel = function() {
    $location.path('/client');
  };
}]);
