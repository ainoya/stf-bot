var Swagger = require('swagger-client');

// swagger endpoint of stf. For example: 'http://localhost:7100/api/v1/swagger.json'
var SWAGGER_URL = process.env.SWAGGER_URL
var AUTH_TOKEN  = process.env.AUTH_TOKEN;
var apk = 'your-app.apk'

var client = new Swagger({
  url: SWAGGER_URL
, usePromise: true
, authorizations: {
    accessTokenAuth: new Swagger.ApiKeyAuthorization('Authorization', 'Bearer ' + AUTH_TOKEN, 'header')
  }
})

var Promise = require('bluebird')
var adb = require('adbkit')
var adbClient = adb.createClient()
var _ = require('underscore')
var sleep = require('sleep-promise')
const util = require('util')

client.then(function(api) {
  return api.devices.getDevices({
    fields: 'serial,present,ready,using,owner,name,model,product'
  }).then(function(res) {
      // check if device can be added or not
      var devices = _.reject(res.obj.devices, (device) => {
        !device.present || !device.ready || device.using || device.owner
      })
      devices.forEach((device) => {
        console.log(device)
        console.log(util.inspect(device))
      })
  }).then(console.log('ok'))
}).then(console.log('finished'))
