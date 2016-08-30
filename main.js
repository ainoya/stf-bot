// ref: https://github.com/henteko/slack_message_button_test/blob/master/main.js
const Botkit = require('botkit')
const request = require('request')
const fs = require('fs')
const URL =  require('url')
const path = require('path')
const util = require('util')

/***********************************
 * Setup
 ***********************************/

var Swagger = require('swagger-client')

// swagger endpoint of stf. For example: 'http://localhost:7100/api/v1/swagger.json'
var SWAGGER_URL = process.env.SWAGGER_URL
var AUTH_TOKEN  = process.env.AUTH_TOKEN

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

var download = function (bot, uri, path, callback) {
  request({
       followAllRedirects: true,
       headers: {'Authorization': 'Bearer ' + bot.config.token},
       uri: uri
     })
    .pipe(fs.createWriteStream(path))
    .on('close', function() {
      callback()
    }
  )
}

if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment')
  process.exit(1)
}

var controller = Botkit.slackbot({
  json_file_store: './bot_db/',
  debug: false
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot']
  }
)

controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot)
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err)
        } else {
          convo.say('I am a bot that has just joined your team')
          convo.say('You must now /invite me to a channel so that I can be of use!')
        }
      })

    })
  }

})


// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!')
})

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed')
  // you may want to attempt to re-open
  console.log('reconnecting...')
  bot.startRTM(function(err) {
    if (!err) {
      trackBot(bot)
    }
  })
})

controller.setupWebserver(process.env.port,function(err,webserver) {
  controller.createWebhookEndpoints(controller.webserver)

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err)
    } else {
      res.send('Success!')
    }
  })
})

var _bots = {}
function trackBot(bot) {
  _bots[bot.config.token] = bot
}

controller.storage.teams.all(function(err,teams) {

  if (err) {
    throw new Error(err)
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err)
        } else {
          trackBot(bot)
        }
      })
    }
  }

})

/**************************
 * Reply
 **************************/

controller.on('interactive_message_callback', function(bot, message) {
  console.log('interactive_message_callback')
  console.log(message)

  if(message.callback_id === '1-1') {
    var reply = {
      text: 'Do you install this apk to stf devices?',
      attachments: []
    }
    if(message.actions[0].value != 'false') {
      var fileURL = message.actions[0].value
      reply.attachments.push({text: ':iine: Installing... :waiting:'})
      download(bot, fileURL, '/tmp/' + path.basename(fileURL), (msg) => {
        console.log('download complete')
        installAPK(bot, message, fileURL)
      })
    } else {
      reply.attachments.push({text: ':cry: Installation has been cancelled'})
    }
    bot.replyInteractive(message, reply)
  }
})

controller.on('file_share', function(bot, message) {
    // carefully examine and
    // handle the message here!
    // Note: Platforms such as Slack send many kinds of messages, not all of which contain a text field!
    var t = {
      bot: bot,
      message: message
    }

    if(message.file.filetype === 'apk') {
      console.log(message)
      console.log('downloading...' + message.file.url_private)
      confirm_install(t.bot, t.message)
    }
})


var installAPK = (bot, message, url) => {
  var apk = '/tmp/' + path.basename(url)
  console.log('installng apk to all stf devices!!')
  console.log('install apk' + apk)


  client.then((api) => {
    return api.devices.getDevices({
      fields: 'serial,present,ready,using,owner,name,model'
    }).then((res) => {
        // check if device can be added or not
        var devices = _.reject(res.obj.devices, (device) => {
          console.log('Device: ', device)
          return !device.present || !device.ready || device.using || device.owner
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
            console.log('installed! ' + device.name)
            return api.user.deleteUserDeviceBySerial({
              serial: device.serial
            })
          }).then((res) => {
              if (!res.obj.success) {
                throw new Error('Could not disconnect to device')
              }
              console.log('Device disconnected successfully!')

              var reply = {
                text: ':ok:' + device.name + '(' + device.model + ')'
              }

              bot.reply(message, reply)
          })
        })
    })
  }).then(function() {
    var reply = {
      text: ':ok: APK installation has been completed successfully :tada:'
    }
    bot.replyInteractive(message, reply)
    console.log('Done.')
    return true
  }).catch(function(err) {
    console.error('Error', err)
    console.error('Something went wrong:', err.stack)
    return false
  })
}

var confirm_install = function(bot, message) {
  var reply = {
    name: 'STF',
    attachments: []
  }

  reply.attachments.push({
    title: 'Detected apk has been uploaded..',
    text: message.file.url_private
  })

  reply.attachments.push({
    title: 'Do you install this apk to stf devices?',
    callback_id: '1-1',
    attachment_type: 'default',
    actions: [
      {
        "name":"flag",
        "text": "OK",
        "value": message.file.url_private,
        "style": "primary",
        "type": "button"
      },
      {
        "name":"flag",
        "text": "No, Thanks",
        "value": "false",
        "type": "button"
      }
    ]
  })
  bot.reply(message, reply)
}
