'use strict';

var schedule = require('node-schedule');
var fork = require('child_process').fork;

var rule15min = new schedule.RecurrenceRule();
rule15min.minute = 15;

var rule30min = new schedule.RecurrenceRule();
rule30min.minute = 30;

schedule.scheduleJob(rule15min, function() {
	console.log('getUsers');
	fork(__dirname + '/getUsers');
});
fork(__dirname + '/getUsers');

schedule.scheduleJob(rule30min, function() {
	console.log('getSchedule');
	fork(__dirname + '/getSchedule');
});