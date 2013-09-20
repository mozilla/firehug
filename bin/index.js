'use strict';

var schedule = require('node-schedule');
var fork = require('child_process').fork;

var rule15min = new schedule.RecurrenceRule();
rule15min.minute = 15;

var rule30min = new schedule.RecurrenceRule();
rule30min.minute = 30;

var getUsers;
function getUsersFork() {
  if (getUsers) {
    getUsers.kill();
    return;
  }
  console.log('getUsers forked.');
  getUsers = fork(__dirname + '/getUsers');
  getUsers.on('exit', function (code, signal) {
    console.log('getUsers exited. code: %d - signal: %d', code, signal);
    getUsers = null;
  });
}

var getSchedule;
function getScheduleFork() {
  if (getSchedule) {
    getSchedule.kill();
    return;
  }
  console.log('getSchedule forked.');
  getSchedule = fork(__dirname + '/getSchedule');
  getSchedule.on('exit', function (code, signal) {
    console.log('getSchedule exited. code: %d - signal: %d', code, signal);
    getSchedule = null;
  });
}

schedule.scheduleJob(rule15min, function() {
  getUsersFork();
});
getUsersFork();

schedule.scheduleJob(rule30min, function() {
  getScheduleFork();
});
getScheduleFork();
