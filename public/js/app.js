window.bootstrapApp = function(payload) {
  'use strict';

  // Call only once
  window.bootstrapApp = function() {};

  var app = angular.module('summit', ['ngRoute']);

  app.config(['$routeProvider', '$locationProvider',
    function($routeProvider, $locationProvider) {
      $routeProvider
        .when('/', {
          controller: 'HomeCtrl',
          controllerAs: 'home',
          templateUrl: '/partials/home.html'
        })
        .when('/login', {
          controller: 'LoginCtrl',
          controllerAs: 'login',
          templateUrl: '/partials/login.html'
        })
        .when('/logout', {
          controller: 'LogoutCtrl',
          controllerAs: 'logout',
          templateUrl: '/partials/logout.html'
        })
        .when('/schedule', {
          controller: 'ScheduleCtrl',
          controllerAs: 'schedule',
          templateUrl: '/partials/schedule.html'
        })
        .when('/around', {
          controller: 'AroundCtrl',
          controllerAs: 'around',
          templateUrl: '/partials/todo.html'
        })
        .when('/questions', {
          controller: 'QuestionsCtrl',
          controllerAs: 'questions',
          templateUrl: '/partials/questions.html'
        })
        .when('/questions/thanks', {
          controller: 'QuestionsThanksCtrl',
          controllerAs: 'questionsThanks',
          templateUrl: '/partials/questions-thanks.html'
        })
        .when('/dialog', {
          controller: 'DialogCtrl',
          controllerAs: 'dialog',
          templateUrl: '/partials/dialog.html'
        })
        .otherwise({
          redirectTo: '/'
        });

      $locationProvider.html5Mode(false).hashPrefix('!');
    }
  ]);


  app.factory('persona', function($q, $rootScope, $http) {

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
      $http({
        url: '/verify',
        method: 'POST',
        data: {
          assertion: assertion
        }
      }).then(function(data) {
        verifying.resolve(data.profile);
      }, function(data, status) {
        verifying.reject(data.error);
      });
      return verifying.promise;
    }

    function start(email) {
      if (starting) {
        return starting.promise;
      }
      starting = $q.defer();

      load().then(function() {
        // Persona watch
        navigator.id.watch({
          loggedInUser: email || undefined, // trigger logout
          onlogin: function onLogin(assertion) {
            console.log('persona.onLogin', !! $rootScope.user, assertion);
            if ($rootScope.user) {
              return starting.resolve();
            }
            verify(assertion).then(function(user) {
              $rootScope.user = user;
              $rootScope.$broadcast('persona:login', user);
              starting.resolve();
            }, function() {
              $rootScope.$broadcast('persona:loginFailed');
              navigator.id.logout();
              starting.resolve();
            });
          },
          onlogout: function onLogout() {
            console.log('persona.onLogout', !! $rootScope.user);
            if (!$rootScope.user) {
              return starting.resolve();
            }
            $http({
              url: '/logout',
              method: 'POST'
            }).
            finally(function() {
              $rootScope.user = null;
              $rootScope.$broadcast('persona:logout');
              starting.resolve();
            });
          }
        });
        if (!email) {
          starting.resolve();
        }
      });
      return starting.promise;
    }
    var starting = null;

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
      console.log('persona.logout');
      start().then(function() {
        console.log('navigator.id.logout');
        navigator.id.logout();
      });
    }

    return {
      load: load,
      start: start,
      request: request,
      logout: logout
    };

  });

  app.controller('AppCtrl', ['$scope', 'persona', '$rootScope', '$location',
    function AppCtrl($scope, persona, $rootScope, $location) {
      if (payload.user) {
        $rootScope.user = payload.user;
        $rootScope.ready = true;
        $rootScope.location = $rootScope.user.location;
        $rootScope.locations = {
          'br': 'Brussels',
          'sc': 'Santa Clara',
          'to': 'Toronto'
        };
      } else {
        $scope.beforeLogin = $location.path();
        $location.path('/login');
      }

      $rootScope.$on('persona:login', function(user) {
        // TODO: Validate assertion
        $rootScope.user = user;
        localStorage.setItem('email', user.email);
        $location.path('/');
      });
      $rootScope.$on('persona:logout', function() {
        localStorage.removeItem('email');
        // Refresh page to reset all data
        location.href = '/#!/login';
      });

      // Watch login and redirect as needed
      $rootScope.$watch(function() {
        return $location.path();
      }, function(newValue) {
        if (!$rootScope.user && newValue != '/login') {
          $location.path('/login');
        }
        $rootScope.path = newValue;
      });

      // Remove splash screen
      $scope.message = 'Welcome';
    }
  ]);

  app.controller('LoginCtrl', ['$scope', '$rootScope', 'persona', '$location',
    function LoginCtrl($scope, $rootScope, persona, $location) {
      console.log('LoginCtrl');

      if ($rootScope.user) {
        return $location.path('/');
      }

      $scope.emailWarning = false;
      $rootScope.$on('persona:loginFailed', function() {
        $scope.emailWarning = true;
      });

      // Load persona
      var email = localStorage.getItem('email');

      persona.load().then(function() {
        return persona.start(email);
      }).then(function() {
        $rootScope.ready = true;
        // Persona loaded, check if it fired login before
        if ($rootScope.user) {
          // Persona provided a user
          console.log('LoginCtrl: Auto-login via persona');
          $location.path($scope.beforeLogin || '/');
        }
      });

      $scope.authenticate = function() {
        persona.request();
      };
    }
  ]);

  app.controller('LogoutCtrl', ['$scope', '$rootScope', 'persona',
    function LogoutCtrl($scope, $rootScope, persona) {
      if (!$rootScope.user) {
        return $location.path('/');
      }
      console.log('Logout', $rootScope.user.email);
      persona.logout();
    }
  ]);

  app.controller('HomeCtrl', ['$scope',
    function($scope) {
      console.log('Home');
    }
  ]);

  app.controller('ScheduleCtrl', ['$scope', '$rootScope', '$http',
    function($scope, $rootScope, $http) {
      $scope.listing = false;

      $scope.showLocations = function() {
        if ($scope.listing) {
          $scope.listing = false;
        } else {
          $scope.listing = true;
        }
      };

      $scope.isShowingLocations = function() {
        return $scope.listing;
      };

      $scope.setLocation = function(location) {
        $('#schedule-listing').removeClass('br')
          .removeClass('to')
          .removeClass('sc')
          .addClass(location)
          .find('.current span').text($rootScope.locations[location]);
        $scope.showLocations();
      };

      $scope.isActiveLocation = function(location) {
        return $('#schedule-listing').hasClass(location);
      };

      $scope.setActive = function(idx) {
        if (idx < 0) {
          idx = 0;
        } else if (idx > $scope.days.length - 1) {
          idx = $scope.days.length - 1;
        }

        $scope.selected = $scope.days[idx];
      };

      $scope.expandDescription = function(ev) {
        if (!ev.enabled) {
          ev.enabled = true;
        } else {
          ev.enabled = false;
        }
      };

      $scope.getDescriptionState = function(ev) {
        return ev.enabled ? 'more' : 'less';
      }

      $scope.isActive = function(day) {
        return $scope.selected === day;
      };

      $scope.days = [{
        name: 'thursday',
        title: 'Thurs',
        value: []
      }, {
        name: 'friday',
        title: 'Fri',
        value: []
      }, {
        name: 'saturday',
        title: 'Sat',
        value: []
      }, {
        name: 'sunday',
        title: 'Sun',
        value: []
      }, {
        name: 'monday',
        title: 'Mon',
        value: []
      }];

      if ($rootScope.user.day > 3 && $rootScope.user.day < 8) {
        $scope.selected = $scope.days[$rootScope.user.day - 3];
      } else {
        // Otherwise default to Thursday
        $scope.selected = $scope.days[0];
      }

      $http({
        url: '/schedule',
        method: 'GET'
      }).then(function(data) {
        for (var s in data.data.schedule) {
          var evt = data.data.schedule[s];

          if (s.indexOf('3') > -1) {
            $scope.days[0].value.push(evt);

          } else if (s.indexOf('4') > -1) {
            $scope.days[1].value.push(evt);

          } else if (s.indexOf('5') > -1) {
            $scope.days[2].value.push(evt);

          } else if (s.indexOf('6') > -1) {
            $scope.days[3].value.push(evt);

          } else if (s.indexOf('7') > -1) {
            $scope.days[4].value.push(evt);
          }
        }
      }, function(data, status) {
        $scope.status = status;
      });
    }
  ]);

  app.controller('AroundCtrl', ['$scope',
    function($scope) {
      console.log('Around');
    }
  ]);

  app.controller('DialogCtrl', ['$scope',
    function($scope) {
      console.log('Dialog');
    }
  ]);

  app.controller('QuestionsCtrl', ['$scope', '$location', '$http',
    function($scope, $location, $http) {
      console.log('QuestionsCtrl');
      if ($scope.user.questionsDone) {
        // TODO: Implement .questionsDone!
        return $location.path('/questions/thanks');
      }

      $scope.mood = 'excited';
      $scope.quote = '';
      $scope.influencers = [];

      var type = $('.typeahead');

      $scope.removeUser = function(idx) {
        $scope.influencers.splice(idx, 1);
      };

      $scope.setMood = function(mood) {
        $scope.mood = mood;
        $('.mood').removeClass('on');
        $('.mood.' + mood).addClass('on');
      };

      $scope.moods = {
        'excited': 'Excited',
        'worried': 'Worried',
        'proud': 'Proud',
        'confused': 'Confused',
        'curious': 'Curious'
      };

      $http({
        url: '/typeahead',
        method: 'GET'
      }).then(function(data) {
        var users = [];

        for (var u in data.data) {
          var nameArr = data.data[u].fullName.split(/\s/);
          users.push({
            value: data.data[u].fullName,
            tokens: [nameArr[0], nameArr[1], data.data[u].username],
            name: data.data[u].username,
            avatar: data.data[u].avatar
          });
        }

        users.push({
          value: atob('U2Xxb3IgTWVhdHNwYWNl'),
          tokens: [atob('c3RlYWs='), atob('cG9yaw=='), atob('Y2hpY2tlbg=='),
            atob('dmVnYW4NCg=='), atob('YmFjb24=')
          ],
          name: '000000',
          avatar: '/default_avatar.png'
        });

        users = users.sort(function(a, b) {
          a = a.name.toLowerCase();
          b = b.name.toLowerCase();
          return a > b ? 1 : a < b ? -1 : 0;
        });

        type.typeahead({
          local: users,
          limit: 5
        }).bind('typeahead:selected', function(obj, datum) {
          type.typeahead('setQuery', '');
          if (datum.name !== '000000') {
            $scope.$apply(function() {
              $scope.influencers.push(datum);
            });
          } else {
            window.open(atob('aHR0cDovL2NoYXQubWVhdHNwYWMuZXM='), '_blank',
              'height=480,width=320,scrollbars=yes');
          }
        });

      }, function(data, status) {
        $scope.status = status;
      });

      $scope.submit = function() {
        console.log($scope.mood);
        console.log($scope.quote);
        console.log($scope.influencers);
        // console.log($scope.questionsForm);
        if (!$scope.questionsForm.$valid) {
          alert('Boom!');
          return;
        }

        $http.post('/questions', {
          mood: $scope.mood,
          quote: $scope.quote,
          influencers: $scope.influencers.map(function(influencer) {
            return influencer.name;
          })
        })
          .success(function() {
            // TODO: Store this serverside as well!
            $location.path('/questions/thanks');
            $scope.user.questionsDone = true;
          })
          .error(function() {
            // FIXME: Better error resport
            alert('Submission failed. Please try again!');
          });


      }
    }
  ]);

  app.controller('QuestionsThanksCtrl', ['$scope',
    function($scope) {
      if (!$scope.user.questionsDone) {
        return $location.path('/questions');
      }
    }
  ]);

  app.directive('markdown', function() {
    var converter = new Showdown.converter();
    return {
      restrict: 'AE',
      link: function(scope, element, attrs) {
        scope.$watch(attrs['ngMarkdown'], function(newVal) {
          if (newVal) {
            var html = converter.makeHtml(newVal);
            element.html(html);
          }
        });
      }
    };
  });
};
