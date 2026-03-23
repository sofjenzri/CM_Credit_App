angular.module('cmCreditApp').controller('ClientSpaceController', ['$scope', '$location', 'AuthService', function($scope, $location, AuthService) {
  const SESSION_REQUESTS_KEY = 'cm_credit_session_requests';

  if (!AuthService.isAuthenticated()) {
    $location.path('/login');
    return;
  }

  // Données client — Claire Martin (UiBank DEMO)
  $scope.client = {
    firstName: 'Claire',
    lastName: 'Martin',
    ref: 'CLI-20419',
    since: 'janvier 2020',
    creditScore: 718,
    monthlyIncome: 3200,
    debtRatio: 12,

    // Infos personnelles supplémentaires
    birthDate: '12/04/1990',
    birthPlace: 'Paris (75)',
    nationality: 'Française',
    address: '15 rue des Lilas',
    city: '69003 Lyon',
    phone: '+33 6 12 34 56 78',
    email: 'claire.martin.demo@uibox.example',
    familySituation: 'Divorcée, un enfant',
    housingSituation: 'Locataire (appartement)',
    profession: 'Cheffe de Projet IT',
    employer: 'TechNova Solutions SAS',
    contractType: 'CDI',
    seniority: '5 ans',
    otherIncomes: 0,
    monthlyExpenses: 400,

    accounts: [
      {
        type: 'Compte courant',
        label: 'Compte principal',
        iban: 'FR76 3000 4000 5000 6000 7000 890',
        balance: 3540.20,
        balanceLabel: 'Solde disponible',
        icon: '💳'
      },
      {
        type: 'Livret A',
        label: 'Épargne réglementée',
        iban: 'FR76 3000 4000 5000 6000 8000 112',
        balance: 6200.00,
        balanceLabel: 'Solde total',
        icon: '🏦'
      },
      {
        type: 'Compte épargne',
        label: 'Épargne enfant',
        iban: 'FR76 3000 4000 5000 6000 9000 334',
        balance: 4800.00,
        balanceLabel: 'Solde total',
        icon: '🎓'
      }
    ],

    credits: [],

    products: [
      { icon: '🛡️', name: 'Assurance habitation', desc: 'Locataire — appartement Lyon 3e' },
      { icon: '📱', name: 'Banque mobile', desc: 'Application et carte Visa Classic' },
      { icon: '🏦', name: 'Banque Populaire', desc: 'Établissement domiciliataire' }
    ]
  };

  function loadSessionRequests() {
    try {
      const raw = window.sessionStorage.getItem(SESSION_REQUESTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      return list.sort(function(a, b) {
        const dateA = new Date(a?.requestDate || 0).getTime() || 0;
        const dateB = new Date(b?.requestDate || 0).getTime() || 0;
        return dateB - dateA;
      });
    } catch (_error) {
      return [];
    }
  }

  $scope.sessionRequests = loadSessionRequests();

  $scope.formatRequestDate = function(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('fr-FR');
  };

  $scope.viewRequest = function(_request) {
    return;
  };

  $scope.getRequestStatusStyle = function(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('reject') || normalized.includes('refus')) {
      return {
        background: '#fee2e2',
        color: '#b91c1c',
      };
    }
    if (normalized.includes('accept') || normalized.includes('accord')) {
      return {
        background: '#dcfce7',
        color: '#166534',
      };
    }
    return {
      background: '#ffedd5',
      color: '#c2410c',
    };
  };

  $scope.goBack = function() {
    $location.path('/');
  };

  $scope.logout = function() {
    AuthService.logout();
  };

  $scope.goToLoanRequest = function() {
    $location.path('/loan-request');
  };
}]);
