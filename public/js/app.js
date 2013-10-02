(function() {
  'use strict';

  var origin = location.protocol + '//' + location.host;

  // FastClick.attach(document.body);

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
          templateUrl: '/partials/getting-around.html'
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


  app.factory('persona', ['$q', '$rootScope', '$http',
    function($q, $rootScope, $http) {

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
          verifying.resolve(data.data.user);
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
          var options = {
            siteName: 'Mozilla Summit',
            backgroundColor: '#D7D3C8'
          };
          if (location.protocol == 'https:') {
            options.termsOfService = 'https://www.mozilla.org/about/legal.html';
            options.privacyPolicy = origin + '/privacy';
            options.siteLogo = origin + '/img/logo-home.png';
          }
          navigator.id.request(options);
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

    }
  ]);

  app.controller('AppCtrl', ['$scope', 'persona', '$rootScope', '$location',
    function AppCtrl($scope, persona, $rootScope, $location) {
      var payload = $(document.body).data('payload') || {};

      if (payload.user) {
        $rootScope.user = payload.user;
        $rootScope.ready = true;
      } else {
        $scope.beforeLogin = $location.path();
        $location.path('/login');
      }

      $rootScope.$on('persona:login', function(event, user) {
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
      }, function(newValue, oldValue) {
        var newClass = newValue.replace(/[^a-z-]/, '') || 'index';
        var oldClass = oldValue.replace(/[^a-z-]/, '') || 'index';
        $(document.body).removeClass('view-' + oldClass).addClass('view-' + newClass);

        if (!$rootScope.user && (newValue !== '/login' && newValue !== '/schedule')) {
          $location.path('/login');
        }

        $rootScope.canGoBack = $rootScope.user ? (newValue != '/') : (newValue != '/login');

        $rootScope.path = newValue;
      });

      if (navigator.mozApps) {
        var selfReq = navigator.mozApps.getSelf();
        selfReq.onsuccess = function() {
          if (!selfReq.result) {
            $scope.canInstall = true;
            $scope.install = function() {
              var manifest = origin + '/manifest.webapp';
              var req = navigator.mozApps.install(manifest);
              req.onsuccess = function() {
                req.result.launch();
              };
              req.onerror = function() {
                alert('Error: ' + this.error.name);
              };
            }
          }
        };
      }
    }
  ]);

  app.controller('LoginCtrl', ['$scope', '$rootScope', 'persona', '$location',
    function LoginCtrl($scope, $rootScope, persona, $location) {
      if ($rootScope.user) {
        return $location.path('/');
      }

      $scope.redirectToSchedule = function() {
        $location.path('/schedule');
      };

      $scope.emailWarning = false;
      $rootScope.$on('persona:loginFailed', function() {
        $scope.emailWarning = true;
      });

      // Load persona
      var email = localStorage.getItem('email');

      persona.load().then(function() {
        $rootScope.ready = true;
        return persona.start(email);
      }).then(function() {
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
      console.log('Logout');
      persona.logout();
    }
  ]);

  app.controller('HomeCtrl', ['$scope',
    function($scope) {
      console.log('Home');
    }
  ]);

  app.controller('ScheduleCtrl', ['$scope', '$rootScope', '$http', '$sce',
    function($scope, $rootScope, $http, $sce) {
      $scope.listing = false;

      $scope.locations = {
        'br': 'Brussels',
        'sc': 'Santa Clara',
        'to': 'Toronto'
      };

      var defaultLocation = 'sc';

      if ($rootScope.user) {
        defaultLocation = $rootScope.user.location;
      }

      $scope.location = defaultLocation;

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
          .find('.current span').text($scope.locations[location]);
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

      $scope.hasDescriptionOrSpeaker = function(ev) {
        return (ev.description || ev.speaker);
      };

      $scope.expandDescription = function(ev) {
        if ($('.expander').hasClass('active')) {
          if (!ev.enabled) {
            ev.enabled = true;
          } else {
            ev.enabled = false;
          }
        }
      };

      $scope.getDescriptionState = function(ev) {
        return (ev.enabled && $scope.hasDescriptionOrSpeaker(ev)) ? 'more' : 'less';
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

      if ($rootScope.user && ($rootScope.user.day > 3 && $rootScope.user.day < 8)) {
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

          for (var entry in evt) {
            if (evt[entry].description) {
              evt[entry].description = $sce.trustAsHtml(evt[entry].description);
            }
            if (evt[entry].speaker) {
              evt[entry].speaker = $sce.trustAsHtml(evt[entry].speaker);
            }
          }
        }

      }, function(data, status) {
        $scope.status = status;
      });
    }
  ]);

  app.controller('AroundCtrl', ['$scope',
    function($scope) {
      $scope.tip = {};

      for (var i = 0; i < 7; i++) {
        $scope.tip[i] = false;
      }

      $scope.showingTip = function(id) {
        return (id === $scope.tip[id]);
      };

      $scope.showTip = function(id) {
        if ($scope.tip[id] === id) {
          $scope.tip[id] = false;
        } else {
          $scope.tip[id] = id;
        }
      };
    }
  ]);

  var dialogKeys = {};
  var glyphKey = 0;
  var paletteKey = 0;
  var glyphs = ['heart', 'cloud', 'rss', 'rocket', 'link', 'star'];

  for (var i = 0; i < 48; i++) {
    glyphKey++;
    if (glyphKey == 6) {
      glyphKey = 0;
      paletteKey++;
    }
    dialogKeys[i] = {
      palette: paletteKey,
      glyph: glyphs[glyphKey]
    };
  }

  app.controller('DialogCtrl', ['$scope', '$rootScope', '$location',
    function($scope, $rootScope, $location) {
      if (!$rootScope.user.dialog || !$rootScope.user.activeDay) {
        alert('Only enabled Friday to Sunday');
        return $location.path('/');
      }
      if ($rootScope.user.dialog) {
        var group = $rootScope.user.dialog[$rootScope.user.day - 4];
      }
      group = group || (Math.random() * 40 | 0); // For testing

      var glyph = dialogKeys[group].glyph;
      var palette = dialogKeys[group].palette;

      $(document.body).addClass('palette-' + palette);
      $scope.glyph = glyph;
    }
  ]);

  app.controller('QuestionsCtrl', ['$scope', '$location', '$http', '$rootScope',
    function($scope, $location, $http, $rootScope) {
      if (!$rootScope.user.activeDay) {
        alert('Only enabled Friday to Sunday');
        return $location.path('/');
      }

      // TODO: Crude check, needs refresh to see questions
      if ($scope.user.questionsDone || $scope.user.nextQuestions) {
        return $location.path('/questions/thanks');
      }

      $scope.mood = '';
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
        if (!$scope.mood) {
          alert('Please select your mood.');
          $('#mood-wrapper')[0].scrollIntoView();
          return;
        }

        $http.post('/questions', {
          mood: $scope.mood,
          quote: $scope.quote,
          influencers: $scope.influencers.map(function(influencer) {
            return influencer.name;
          })
        }).
        success(function() {
          // TODO: Store this serverside as well!
          $location.path('/questions/thanks');
          $scope.user.questionsDone = true;
        }).
        error(function(data) {
          if (!data || !(data = JSON.parse(data))) {
            alert('Submission failed. Please try again later!');
            return;
          }
          if (data.error == 'idle') {
            alert('You can answer the 3 Questions again after two hours have elapsed.');
            return $location.path('/questions/thanks');
          }
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

})();
