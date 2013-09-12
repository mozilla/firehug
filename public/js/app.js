'use strict';

(function() {

  var app = angular.module('summit', ['ngRoute', 'ngCookies']);

  app.config(['$routeProvider', '$locationProvider',
    function($routeProvider, $locationProvider) {
      $routeProvider
        .when('/', {
          controller: 'HomeCtrl',
          controllerAs: 'home',
          templateUrl: '/partials/home.html'
        })
        .when('/schedule', {
          controller: 'ScheduleCtrl',
          controllerAs: 'schedule',
          templateUrl: '/partials/schedule.html'
        })
        .when('/login', {
          controller: 'LoginCtrl',
          controllerAs: 'login',
          templateUrl: '/partials/login.html'
        })
        .when('/logout', {
          controller: 'LogoutCtrl',
          controllerAs: 'logout'
        })
        .otherwise({
          redirectTo: '/'
        });

      // $locationProvider.html5Mode(true);
    }
  ]);


  app.factory('persona', function($q, $rootScope) {

    function load() {
      if (loading) {
        return loading.promise;
      }
      loading = $q.defer();

      // Include Persona if needed
      if (navigator.mozId) {
        navigator.id = navigator.mozId;
        loading.resolve();
      } else {
        $.getScript('https://login.persona.org/include.js', function() {
          loading.resolve();
        });
      }
      return loading.promise;
    }
    var loading = null;

    function verify(assertion) {
      var verifying = $q.defer();
      // TODO: Ajax
      verifying.resolve('harald@digitarald.com');
      return verifying.promise;
    }

    function start(email) {
      var starting = $q.defer();
      load().then(function() {
        navigator.id.watch({
          loggedInUser: email || undefined, // trigger logout
          onlogin: function onLogin(assertion) {
            console.log('onLogin', assertion);
            verify(assertion).then(function(email) {
              $rootScope.$broadcast('persona:login', assertion);
              if (starting) {
                starting.resolve(email);
                starting = null;
              }
            });
          },
          onlogout: function onLogout() {
            console.log('onLogout');
            $rootScope.$broadcast('persona:logout');
            if (starting) {
              starting.reject('logout');
              starting = null;
            }
          }
        });
        if (!email) {
          starting.resolve();
        }
      });
      return starting.promise;
    }

    function request() {
      load().then(function() {
        navigator.id.request({
          siteName: 'Mozilla Summit',
          backgroundColor: '#D7D3C8',
          termsOfService: 'https://www.mozilla.org/en-US/persona/terms-of-service/',
          privacyPolicy: 'https://www.mozilla.org/en-US/privacy/policies/websites/'
        });
      });
    }

    function logout() {
      // TODO: Ajax
      navigator.id.logout();
    };

    return {
      load: load,
      start: start,
      request: request,
      logout: logout
    };

  });

  app.controller('AppCtrl', ['$scope', 'persona', '$rootScope', '$location', '$cookieStore',
    function($scope, persona, $rootScope, $location, $cookieStore) {
      // Load persona
      var email = $cookieStore.get('email');

      var loadPromise = persona.load();
      loadPromise.then(function() {
        return persona.start(email);
      }).then(function(assertion) {
        if (!assertion) {
          $location.path('/login');
          return;
        }
      }, function() {
        $cookieStore.remove('email');
        $location.path('/login');
      });

      $scope.$on('persona:login', function(assertion) {
        // TODO: Validate assertion
        $scope.email = 'harald@digitarald.com';
        $location.path('/');
      });

      // Watch login and redirect as needed
      $scope.$watch(function() {
        return $location.path();
      }, function(newValue) {
        if (!$scope.email && newValue != '/login') {
          $location.path('/login');
        }
      });

      // Remove splash screen
      $rootScope.ready = true;

      $scope.message = 'Welcome';
    }
  ]);

  app.controller('LoginCtrl', ['$scope', 'persona',
    function($scope, persona) {
      $scope.authenticate = function() {
        persona.request();
      };
    }
  ]);

  app.controller('LogoutCtrl', ['$scope', 'persona',
    function($scope, persona) {
      persona.logout().then(function() {
        $location.path('/login');
      });
    }
  ]);

  app.controller('HomeCtrl', ['$scope',
    function($scope) {}
  ]);

  app.controller('ScheduleCtrl', ['$scope',
    function($scope) {}
  ]);

})();