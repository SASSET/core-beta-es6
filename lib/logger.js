'use strict'

const bunyan  = require( 'bunyan' )
const _       = require( 'moar-lodash' )
const Path    = require( 'path' )
const AppRoot = require( 'app-root-path' )
const Fs      = require( 'fs' )


// module.parent.filename

const logDir = AppRoot.toString() + '/logs'

var log = bunyan.createLogger({
  name: 'SASSET core',
  streams: [
    {
      level: 'info',
      stream: process.stdout            // log INFO and above to stdout 
    },
    {
      level: 'error',
      path: logDir + '/error.log'  // log ERROR and above to a file 
    },
    {
      level: 'debug',
      path: logDir + '/debug.log' 
    }
  ],
  file: __filename
});

module.exports = log