
const Config = require('config')
const passport = require('passport')
const { BasicStrategy } = require('passport-http')
const { Strategy: AnonymousStrategy } = require('passport-anonymous')

const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt

const log = require('./log').createLogger(__filename)

const initSecurity = (config = {}) => {
  const pp = config.passport || {}
  initPassport(pp)
}

const initPassport = ( config = {} ) => {
  const { validateBasic } = config

  if( validateBasic ){
    log.info('Configuring basic strategy')
    passport.use(new BasicStrategy(
      async (username, password, done) => {
        try {
          let user = await validateBasic(username, password)
          done(null, user)
        }catch(err){
          done(err)
        }
      }
    ));
  }

  const legacySecret = Config.get('security.jwt.legacy')
  if( legacySecret ){
    var opts = {}
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.secretOrKey = legacySecret;
    // opts.issuer = 'accounts.examplesoft.com';
    // opts.audience = 'yoursite.net';
    passport.use(new JwtStrategy(opts, async (claims, done) => {
      // legacy token
      const p = {
        authenticated: true
      }
      if (claims.aud === 'postgraphile') {
        Object.assign(p, {
          type: 'member',
          anonymous: false,
          identity: claims.identityId,
          member: claims.memberId,
          tenant: claims.tenantId,
          audit: claims.auditId
        })
      }

      done(null, p)
    }));
  }else{
    log.warn('No legacy secret provided')
  }

  passport.use(new AnonymousStrategy())
}

const createApolloContextFromExpress = (apolloServerArgs) => {
  const { req, res } = apolloServerArgs

  const context = {}
  const { user } = req
  Object.assign(context, {
    user,
    express: {
      request: req,
      response: res,
      arguments: args
    }
  })
  return context
}

module.exports = {
  initSecurity,
  initPassport,
  createApolloContextFromExpress
}