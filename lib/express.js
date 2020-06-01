const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const passport = require('passport')

const log = require('./log').manager.createLogger(__filename)

const initExpress = async (settings) => {
  const s = settings || {}
  const app = express()
  app.use(cors())
  app.use(bodyParser.json())
  app.use(passport.initialize());
  s.passport && s.passport.session && app.use(passport.session())
  app.use(passport.authenticate(['basic', 'jwt', 'anonymous'], { session: false }))
  return app
}

function wrapper (callback) {
  return function (req, res, next) {
    callback(req, res, next)
      .catch(error => {
        log.warn(`Unhandled Express Route Error at path=[${req.path}]: `, error)
        next({
          message: 'Internal Server Error',
          error
        })
      })
  }
}

module.exports = {
  wrapper,
  initExpress
}
