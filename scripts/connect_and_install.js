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

client.then(function(api) {
  return api.devices.getDevices({
    fields: 'serial,present,ready,using,owner'
  }).then(function(res) {
      // check if device can be added or not
      var devices = _.reject(res.obj.devices, (device) => {
        !device.present || !device.ready || device.using || device.owner
      })

      return Promise.map(devices, (device) => {
        console.log('add device: ' + device.serial)
        return api.user.addUserDevice({
          device: {
            serial: device.serial
          , timeout: 900000
          }
        }).then((res) => {
          if (!res.obj.success) {
            throw new Error('Could not connect to device')
          }
          return api.user.remoteConnectUserDeviceBySerial({
            serial: device.serial
          })
        }).then((res) => {
          console.log('connecting: ' + res.obj.remoteConnectUrl)
          return adbClient.connect(res.obj.remoteConnectUrl)
        }).then((id) => {
          // It can take a moment for the connection to happen.
          console.log('waiting.. ' + id)
          return sleep(7 * 1000).then(() => id)
        }).then((id) => {
          console.log('installing: ' + id)
          return adbClient.install(id, apk)
        }).then(() => {
          console.log('installed!')
          return api.user.deleteUserDeviceBySerial({
            serial: device.serial
          })
        }).then(function(res) {
            if (!res.obj.success) {
              throw new Error('Could not disconnect to device')
            }
            console.log('Device disconnected successfully!')
        })
      })
  })
}).then(function() {
  console.log('Done.')
  return true
}).catch(function(err) {
  console.error('Error', err)
  console.error('Something went wrong:', err.stack)
  return false
})
