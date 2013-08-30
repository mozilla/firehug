var App = {

	prepare: function() {
		App.$ = document.querySelector.bind(document);

		// Include Persona if needed
		if (!navigator.mozId) {
			var script = document.createElement('script');
			script.addEventListener('load', App.ready);
			script.src = 'https://login.persona.org/include.js';
			document.body.appendChild(script);
		} else {
			navigator.id = navigator.mozId;
			App.ready();
		}
	},

	ready: function() {
		App.$('#action-login').addEventListener('click', App.doLogin);
		App.$('#action-announce').addEventListener('click', App.onAnnounce);
		App.$('#action-announce-save').addEventListener('click', App.onAnnounceSubmit);
		App.$('#panel-announce .list-group').addEventListener('click', App.onToggle);

		var socket = App.socket = io.connect();

		socket.on('hello', function(data) {
			App.email = data.email;
			navigator.id.watch({
				loggedInUser: App.email,
				onlogin: App.onVerifyAssertion,
				onlogout: App.onLogout
			});
			if (App.email) {
				// Todo: Login if email is not verified (from cookie)
				document.body.classList.add('state-user');
			}
			App.postReady();
		});

		socket.socket.on('error', function(reason) {
			console.log('error ' + reason);
			location.href = location.href;
		});
		socket.on('disconnect', function() {
			console.log('disconnect');
			// location.href = location.href;
		});

		socket.on('findings', function(data) {
			var container = App.$('#panel-announce .list-group');
			App.found += data.emails.length;
			data.emails.forEach(function(email) {
				var el = document.createElement('strong');
				el.textContent = email;
				el.href = '#';
				el.className = 'list-group-item';
				container.appendChild(el);
			})
		});

		socket.on('login', function(data) {
			App.postReady();
			document.body.classList.remove('state-login-pending');
			if (data.email) {
				document.body.classList.add('state-user');
			}
		});

		socket.on('status', function(data) {
			// App.$('#online').textContent = data.online;
		});
	},

	postReady: function() {
		document.body.classList.add('state-ready');
	},

	onAnnounce: function() {
		App.socket.emit('announce', function(result) {
			document.body.classList.remove('state-announce-pending');
			if (App.found != result.count) {
				console.error('Unexpected announce count!');
			}
			if (!App.found) {
				document.body.classList.remove('state-announce');
				document.body.classList.add('state-announce-empty');
			}
		});
		App.found = 0;
		App.$('#panel-announce .list-group').textContent = '';
		document.body.classList.add('state-announce-pending');
		document.body.classList.add('state-announce');
		document.body.classList.remove('state-announce-empty');
	},

	onVerifyAssertion: function(assertion) {
		console.log('onVerifyAssertion');
		document.body.classList.add('state-login-pending');
		App.socket.emit('assertLogin', {
			assertion: assertion
		});
	},

	onLogout: function() {
		document.body.classList.remove('state-user');
	},

	doLogin: function(evt) {
		evt.preventDefault();
		navigator.id.request();
	},

	onToggle: function(evt) {
		evt.preventDefault();
		var link = evt.target;
		var active = link.classList.contains('active');
		if (active) {
			link.classList.remove('active');
		} else {
			link.classList.add('active');
		}
	},

	onAnnounceSubmit: function() {
		document.body.classList.remove('state-announce');
	}

};

App.prepare();