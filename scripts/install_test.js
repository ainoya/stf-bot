var Promise = require('bluebird')
var adb = require('adbkit')
var client = adb.createClient()
var apk = 'your-apk.apk'

client.listDevices()
  .then(function(devices) {
    return Promise.map(devices, function(device) {
      console.log('installing: ' + device.id)
      return client.install(device.id, apk)
    })
  })
  .then(function() {
    console.log('Installed %s on all connected devices', apk)
  })
  .catch(function(err) {
    console.error('Something went wrong:', err.stack)
  })
