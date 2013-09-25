'use strict';

var express = require('express');
var http = require('http');
var https = require('https');
var hbs = require('hbs');
var gravatar = require('gravatar');
var stylus = require('stylus');
var querystring = require('querystring');
var nib = require('nib');
var connectRedis = require('connect-redis');
var request = require('request');

var shared = require('./shared');
var nconf = shared.nconf;
var client = shared.redisClient;

// Job scheduler
require('./bin');

var app = express();

var isLoggedIn = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    return res.status(401).send({
      status: 0
    });
  }
};

// Setup express
if (!process.NODE_ENV) {
  app.use(express.logger());
}
app.use(express.bodyParser());
var cookieParser = express.cookieParser(nconf.get('sessionSecret'));
app.use(cookieParser);

app.use(stylus.middleware({
  src: __dirname + '/public',
  compile: function compile(str, path) {
    return stylus(str)
      .set('filename', path)
      .use(nib());
  }
}));
app.use(express.static(__dirname + '/public'));

// Template engine
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
// hbs.registerPartials(__dirname + '/views/partials');
app.engine('html', hbs.__express);

// Define storage object and cookie name for later use
var RedisStore = connectRedis(express);
var sessionStore = new RedisStore({
  client: client
});
app.use(express.session({
  store: sessionStore,
  key: nconf.get('sessionName')
}));

app.get('/', function(request, response) {
  var payload = {};
  if (request.session.user) {
    console.log('/', request.session.user.username);
    payload.user = {
      email: request.session.user.email,
      location: request.session.user.location,
      dialog: request.session.user.dialog
    };
  }

  response.render('index', {
    jsonPayload: JSON.stringify(payload)
  });
});

app.post('/verify', function(request, response) {
  var assertion = request.body.assertion;
  if (!assertion) {
    response.status(400).send({
      error: 'No assertion'
    });
  }
  console.log('Verifying with %s', nconf.get('audience'));
  Users.emailFromAssertion(assertion, nconf.get('audience'), function(err, result) {
    if (err) {
      console.log('Users.emailFromAssertion failed', err);
      return response.status(400).send({
        error: 'Invalid assertion'
      });
    }
    console.log('Users.login', result.email);

    Users.login(result.email, function(err, user) {
      if (err || !user) {
        console.log('Users.login failed', err);
        return response.status(400).send({
          error: 'User not found'
        });
      }

      request.session.user = user;

      console.log('Users.login success', user.username);
      response.send({
        status: 1,
        user: {
          email: request.session.user.email,
          location: request.session.user.location,
          dialog: request.session.user.dialog
        }
      });
    });
  });
});

app.post('/questions', isLoggedIn, function(request, response) {
  console.log(request.body);

  response.send({
    status: 1
  });
});

app.get('/schedule', isLoggedIn, function(req, res, next) {
  client.smembers('schedules', function(err, schedules) {
    if (err) {
      return res.status(400).send();
    }

    var scheduleList = {};
    var sortedSchedule = {};
    var count = 0;
    var title;

    schedules.forEach(function(title, idx) {
      client.get('schedule:' + title, function(err, s) {
        count++;

        if (err) {
          return res.status(400).send({
            error: err
          });
        }

        try {
          scheduleList[title] = JSON.parse(s);
        } catch (e) {
          console.log('Could not parse schedule ', s);
        }

        if (count === schedules.length) {
          var keys = [];

          for (var key in scheduleList) {
            if (scheduleList.hasOwnProperty(key)) {
              keys.push(key);
            }
          }

          keys.sort();

          for (var i = 0; i < keys.length; i++) {
            sortedSchedule[keys[i]] = scheduleList[keys[i]];
          }

          res.send({
            schedule: sortedSchedule
          });
        }
      });
    });
  });
});

app.post('/logout', function(request, response) {
  request.session.destroy();
  response.status(200).send();
});

app.get('/typeahead', isLoggedIn, function(req, res) {
  var location = req.session.user.location;
  var defaultGravatar = nconf.get('domain') + nconf.get('gravatarPath');

  client.smembers('location:' + location, function(err, usernames) {
    if (err) {
      return res.status(400).send();
    }

    var multi = client.multi();
    for (var username in usernames) {
      multi.hgetall('user:' + usernames[username]);
    }
    multi.exec(function(err, users) {
      if (err || !users) {
        return res.status(400).send();
      }

      var cleanUsers = users.map(function(user) {
        var entry = {
          fullName: user.fullName,
          username: user.username
        };
        if (user.country) {
          entry.country = user.country;
        }
        entry.avatar = user.avatar || gravatar.url(user.email, {
          s: 50,
          d: defaultGravatar
        });
        return entry;
      });

      res.send(cleanUsers);
    });
  });
});

// Start express server
var server = http.createServer(app);
server.listen(process.env.PORT || 5000, function() {
  var address = server.address();
  console.log('Listening on http://%s:%d', address.address, address.port);
});


var Users = {

  emailFromAssertion: function(assertion, audience, next) {
    var vreq = https.request({
      host: 'login.persona.org',
      path: '/verify',
      method: 'POST'
    }, function(vres) {
      var body = '';
      vres.on('data', function(chunk) {
        body += chunk;
      }).on('end', function() {
        try {
          var verifierResp = JSON.parse(body);
          var valid = verifierResp && verifierResp.status === 'okay';
          if (!valid) {
            next(new Error('failed to verify assertion: ' + verifierResp.reason));
            return;
          }
          next(null, {
            email: verifierResp.email
          });
        } catch (e) {
          next(new Error('non-JSON response from verifier: ' + e));
        }
      });
    });
    vreq.setHeader('Content-Type', 'application/x-www-form-urlencoded');

    var data = querystring.stringify({
      assertion: assertion,
      audience: audience
    });
    vreq.setHeader('Content-Length', data.length);
    vreq.write(data);
    vreq.end();
  },

  login: function(email, next) {
    client.get('email:' + email, function(err, username) {
      if (err || !username) {
        return next(new Error('Email not found ', err));
      }
      console.log('login with username: %s', username);
      client.hgetall('user:' + username, function(err, user) {
        if (err || !user) {
          return next(new Error('Username not found ', err));
        }
        next(null, user);
      });
    });
  }

};
