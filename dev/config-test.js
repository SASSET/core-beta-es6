'use strict'

const _             = require( 'lodash' )
const Mongoose      = require( 'mongoose' )
const Promise       = require( 'bluebird' )
const Async         = require( 'async' )
const Util          = require( 'util' )
const AppRoot       = require( 'app-root-path' )
const Path          = require( 'path' )

const AccountLib = AppRoot.require('./lib/account')


AccountLib.setAccount({
    username:  'jhyland',
    _id: '56a3e7c72b26696213a8f399'
})

console.log('account:',AccountLib.getAccount())


const cfg = AppRoot.require( './lib/config' )