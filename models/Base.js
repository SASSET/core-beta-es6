'use strict'

//const _             = require( 'lodash' )
const AppRoot       = require( 'app-root-path' )
const _             = AppRoot.require('./lib/mongoose-mixins')
const Async         = require( 'async' )
const Util          = require( 'util' )
const Path          = require( 'path' )
const Mongoose      = require( 'mongoose' )
const Promise       = require( 'bluebird' )


const { Schema, Types, Model } = Mongoose

console.log('Base _.getState(Mongoose):', _.getState(Mongoose))

if ( ! _.isAlive( Mongoose ) )
  throw new Error( `The Mongoose connection is not active` )

class Base extends Model {
  constructor ( data ) {
    super( data )
  }

  getFoo(){
    return 'Base.getFoo()'
  }

  getBar(){
    return 'Base.getBar()'
  }
}

module.exports = Base