'use strict';

var redis = require('redis');
var nconf = require('nconf');

nconf.argv().env().file({
  file: 'local.json'
});

function getRedisClient() {
  if (process.env.VCAP_SERVICES) {
    var redisconf = JSON.parse(process.env.VCAP_SERVICES).redis[0].credentials;
    var db = redis.createClient(redisconf.port, redisconf.host);
    db.auth(redisconf.password);
    return db;
  }
  return redis.createClient();
}

module.exports = {
  nconf: nconf,
  redisClient: getRedisClient()
}