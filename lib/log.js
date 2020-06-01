// TODO research async stacktraces
// https://medium.com/@nodejs/introducing-node-js-12-76c41a1b3f3f

const util = require('util')
const SimpleLogger = require('simple-node-logger')
const { AbstractAppender } = SimpleLogger

const localOrTest = !!(['localhost', 'test'].find(e => e === process.env.NODE_ENV))
const CWD = process.cwd()

let level
if (process.env.LOGGER_LEVEL) {
  level = process.env.LOGGER_LEVEL
} else {
  level = localOrTest ? 'debug' : 'info'
}

const printer = output => localOrTest
  ? process.stdout.write(util.inspect(output, false, null, true) + '\n')
  : process.stdout.write(util.inspect(output, { breakLength: Infinity }) + '\n')

const JSONAppender = function () {
  var appender = this;

  var opts = {
    typeName: 'JSONAppender',
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
  };

  AbstractAppender.extend(this, opts);

  // format and write all entry/statements
  this.write = function (entry) {
    const msg = Array.isArray(entry.msg) ? [...entry.msg] : entry.msg

    // if we monkey patched our line numbers, let's use that as the source
    // so that VSCode will give us nice clickable links
    let source
    if (localOrTest && msg.length && msg[0].__hexLine) {
      source = './' + msg.shift().__hexLine
    } else {
      source = entry.category
    }

    if (Array.isArray(msg)) {
      const last = msg.length - 1
      if (msg[last] instanceof Error) {
        const err = msg[last]
        msg[last] = `Error: ${err.message}\n${err.stack}`
      }
    }

    const output = {
      ts: appender.formatTimestamp(entry.ts),
      source,
      level: entry.level,
      message: msg
    }
    printer(output)
  };
};

const timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS'
const appender = new JSONAppender({ timestampFormat })

const manager = SimpleLogger.createLogManager({
  level,
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
  errorEventName: 'error',
  appenders: [appender]
})

// If we're local or test, let's
// monkey patch our loggers to include line numbers
if (localOrTest) {
  // const REGEX = /.*(?<source>[^)]*):\d+\)/
  const pattern = `.*${CWD}/(?<source>[^\\)]*):\\d+\\)?`

  const REGEX = new RegExp(pattern)
  const orig = manager.createLogger.bind(manager)
  manager.createLogger = (...args) => {
    const logger = orig(...args)
    const origLog = logger.log.bind(logger)
    logger.log = (...logArgs) => {
      const stack = new Error().stack
      const find = stack.split('\n')[3].match(REGEX)
      if (find && find.groups) {
        logArgs[1].splice(0, 0, { __hexLine: find.groups.source })
      } else {

      }

      origLog(...logArgs)
    }
    return logger
  }
}

const createLogger = (...args) => manager.createLogger(...args)

module.exports = {
  JSONAppender,
  manager,
  createLogger,
  defaultLevel: level
}
