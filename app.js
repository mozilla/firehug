'use strict';

var express = require('express');
var http = require('http');
var io = require('socket.io');
var https = require('https');
var querystring = require('querystring');
var hbs = require('hbs');
var connect = require('connect');
var cookie = require('connect').utils;

var config =  {
	sessionSecret: 'REALLY SECRET!',
	sessionName: 'sid',
	treshold: 5000
};

var app = express();

// Setup express
app.use(express.logger());
app.use(express.bodyParser());
var cookieParser = express.cookieParser(config.sessionSecret);
app.use(cookieParser);
app.use(express.static(__dirname + '/public'));

// Template engine
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
// hbs.registerPartials(__dirname + '/views/partials');
app.engine('html', hbs.__express);

// Define storage object and cookie name for later use
var sessionStore = new connect.session.MemoryStore();
app.use(express.session({
	key: config.sessionName,
	store: sessionStore
}));

// Start express server
var server = http.createServer(app);
server.listen(process.env.PORT || 5000, function() {
	console.log('Listening on %j', server.address());
});


// Start socket.io server
var sio = io.listen(server);

sio.configure(function() {
  sio.set('transports', ['xhr-polling']);
  sio.set('polling duration', 20);
});

var sockets = {};

var persistent = {
	users: {},
	announces: [],
	ignitions: [],
	audience: null
};

function broadcastStatus() {
	sio.sockets.emit('status', {
		online: Object.keys(sockets).length
	});
}

// Via https://gist.github.com/bobbydavid/2640463
sio.set('authorization', function(data, accept) {
	cookieParser(data, {}, function(err) {
		if (err) {
			return accept(err, false);
		}
		var sid = data.sessionId = data.signedCookies[config.sessionName];

		sessionStore.get(sid, function(err, session) {
			if (err || !session) {
				return accept('unauthorized', false);
			}
			session.sessionId = sid;
			data.session = session;

			sessionStore.set(sid, session, function() {
				accept(null, true);
			});
		});
	});
});

sio.on('connection', function(socket) {
	var sid = socket.handshake.sessionId;
	var session = socket.handshake.session;
	var user;

	console.log('Socket %s connected', sid);

	sockets[sid] = socket;

	if (session.email) {
		Users.login(session, session.email, function(err, userRecord) {
			user = userRecord;
			socket.emit('hello', {
				email: session.email
			});
		});
	} else {
		socket.emit('hello', {});
	}

	broadcastStatus();

	socket.on('assertLogin', function(data) {
		Users.emailFromAssertion(data.assertion, persistent.audience, function(err, result) {
			console.log(err, result);
			if (err) {
				socket.emit('login', {
					email: null
				});
				return;
			}
			var email = result.email;
			Users.login(session, email, function(err, userRecord) {
				user = userRecord;
				socket.emit('login', {
					email: email
				});
			});
		});
	});

	socket.on('announce', function(announceEnd) {
		var email = session.email;
		var time = Date.now();

		persistent.announces.push({
			email: email,
			time: time
		});

		var treshold = config.treshold;
		// Initial set
		var seeds = persistent.announces.filter(function(other) {
			return other.email != email && (time - other.time) < treshold;
		}).map(function(other) {
			Users.findByEmail(other.email, function(err, result) {
				if (err || !result || !result.socket) {
					return;
				}
				if (result.user.announceResults) {
					result.user.announceResults.push(email);
				} else {
					result.user.announceResults = [email];
				}
				console.log('*** Past', other.email, email);
				var otherSocket = result.socket;
				otherSocket.emit('findings', {
					emails: [email]
				});
			});
			return other.email;
		});

		user.announceResults = seeds;

		console.log('*** Seeds', seeds);
		socket.emit('findings', {
			emails: seeds
		});
		if (announceEnd) {
			setTimeout(function() {
				announceEnd({
					count: user.announceResults.length
				});
			}, treshold);
		}
	});

	socket.on('disconnect', function() {
		delete sockets[sid];
		var user = persistent.users[session.email];
		if (user) {
			user.sessionId = null;
		}
		broadcastStatus();
	});
});

app.get('/', function(request, response) {
	if (!persistent.audience) {
		persistent.audience = request.headers.host;
	}
	response.render('index');
});

var Users = {

	emailFromAssertion: function(assertion, audience, next) {
		var vreq = https.request({
			host: 'browserid.org',
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

	findByEmail: function(email, next) {
		var user = persistent.users[email];
		if (!user || !user.sessionId || !sockets[user.sessionId]) {
			next(new Error('Not found'));
		}
		next(null, {
			user: user,
			socket: sockets[user.sessionId]
		});
	},

	login: function(session, email, next) {
		session.email = email;
		console.log('**** LOGIN', session.sessionId);
		var user = persistent.users[email] = persistent.users[email] || {
			email: email,
			announceResults: []
		};
		user.sessionId = session.sessionId;

		sessionStore.set(session.sessionId, session, function() {
			next(null, {
				user: user
			});
		});
	}

};