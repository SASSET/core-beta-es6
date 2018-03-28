'use strict'

module.exports = {
    production: {
        // Always use the same connection in prod, regardless of the `mdbhost` value
        connection: 'mongodb://user:pass@localhost:47365/database'
    },
    development: {
        // Use different connections in dev, based on the `mdbhost` value
        connection: {
            $filter: 'mdbhost',
            mlab: 'mongodb://sasset_user:SassetPass1@ds047365.mongolab.com:47365/jhyland_test',
            local: 'mongodb://user:pass@localhost:47365/database'
            // Want a default?
            // $default: ''
        }
    }
    /* Example default configuration object
    $default: {
        connection: {
            $filter: 'mdbhost',
            mlab: 'mongodb://sasset_user:SassetPass1@ds047365.mongolab.com:47365/jhyland_test',
            local: 'mongodb://root:password@localhost:47365/????',
            $default: 'mongodb://DEFAULT'
        }
    }
    */
}