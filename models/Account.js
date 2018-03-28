'use strict'

//const _             = require( 'lodash' )
const _             = require('../mongoose-mixins')
const Async         = require( 'async' )
const Util          = require( 'util' )
const Path          = require( 'path' )
const Mongoose      = require( 'mongoose' )
const Promise       = require( 'bluebird' )

const { Schema, Types, Model } = Mongoose

const Base = require('./Base')

if ( ! _.isAlive( Mongoose ) )
  throw new Error( `The Mongoose connection is not active` )

class Account extends Base {
  constructor ( data ) {
    super(data)
  }

  get fullName(){
    var r = []
    if ( _.isString( this.name.first ) )
      r.push( this.name.first )

    if ( _.isString( this.name.last ) )
      r.push( this.name.last )


    return r.length > 0 ? r.join(' ') : null
  }

  static get Schema() { 
    //console.log( 'asdfadfaf',_.get( Account, '_schema.constructor.name', false ) )
    if ( ! Account._schema ) {
      //console.log('Account.Schema DEFINING FOR FIRST TIME')
      Account._schema = new Schema({
        name: {
          first: String,
          value: String
        },
        username: { 
          type: String, 
          required: true, 
          unique: true 
        },
        password: { 
          type: String, 
          required: 
          true 
        },
        admin: Boolean,
        location: String,
        meta: {
          age: Number,
          website: String
        },
        created_at: Date,
        updated_at: Date
      })
    }

    return Account._schema
  }

  /*
  async save(callback) {
    console.log('Account async save callback:',callback)
    try {
      await this.settings.save();
      return super.save(callback);
    }
    catch (error) {
      throw error;
    }
  }

  static async create(obj, callback) {
    console.log('Account static async create obj:',obj)
    let user = new Account(obj);
    return user.save(callback);
  }
  */

  static createUser( data ) {
    console.log('Account.createUser Executed')
    const _method = "(static) UserClass.createUser"

    const newDoc = {}
    // `[${_method}] `
    // console.log( `[${_method}] ` )

    const _args = arguments

    const _this = this
    return new Promise( ( res, rej ) => {
      if ( ! _.isObject( data ) ) {
        console.log( `[${_method}] Data is invalid or absent:`, _args )
        return rej( `[${_method}] Data is invalid or absent` )
      }

      if ( _.has( data, 'name' ) )
        newDoc.name = {}
      
      // Name given in OBJECT
      if ( _.isObject( data.name ) ){
        console.log( `[${_method}] Debug - data.name is an OBJECT` )

        if ( _.isString( data.name.first ) )
          newDoc.name.first = data.name.first

        if ( _.isString( data.name.last ) )
          newDoc.name.last = data.name.last
      }

      // Name given in ARRAY
      else if ( _.isArray( data.name ) ){
        console.log( `[${_method}] Debug - data.name is an ARRAY` )

        if ( data.name.length >= 2 ){
          newDoc.name.first = data.name[0]
          newDoc.name.last  = data.name[1]
        }
        else if ( data.name.length === 1 ) {
          newDoc.name.last  = data.name[0]
        }
      }

      // Name given in STRING
      else if ( _.isString( data.name ) ){
        console.log( `[${_method}] Debug - data.name is a STRING` )

        let nameSegs = data.name.split(' ')

        if ( nameSegs.name.length >= 2 ){
          newDoc.name.first = nameSegs.name[0]
          newDoc.name.last  = nameSegs.name[1]
        }
        else if ( nameSegs.name.length === 1 ) {
          newDoc.name.last  = nameSegs.name[0]
        }
      }

      // Name NOT given
      else {
        console.log( `[${_method}] Debug - data.name is UNDEFINED or INVALID data type` )
      }

      if ( _.isString( data.username ) ) {
        console.log( `[${_method}] Debug - data.username is a STRING` )

        newDoc.username = data.username
      }
      else if ( _.isObject( data.name ) && Object.keys( data.name ).length !== 0 ) {
        let un = []

        if ( _.isString( data.name.first ) ) 
          un.push( data.name.first )
        
        if ( _.isString( data.name.last ) )
          un.push( data.name.last )
        
        if ( un.length === 0 ){
          console.log( `[${_method}] ABORT - Unable to define username - No username provided & no first/last name to construct one from` )
          return rej( `[${_method}] ABORT - Unable to define username - No username provided & no first/last name to construct one from` )
        }

        newDoc.username = un.join('.')

        console.log( `[${_method}] Debug - data.username is UNDEFINED but a username was constructed from the users name:`, ewDoc.username )
      }
      else {
        console.log( `[${_method}] Aborting - No username or first/last name provided - unable to define a username` )
        return rej( `[${_method}] Aborting - No username or first/last name provided - unable to define a username` )
      }

      new _this( data )
        .save()
        .then( newUserDoc => {
          console.log( `[${_method}] User Created - newUserDoc:`, newUserDoc )

          return res( newUserDoc )
        } )
        .catch( err => rej( err ) )

    })
  }

  static findUserByUsername( username ) {
    const _this = this
    const _method = "(static) UserClass.findUserByUsername"

   return new Promise( ( res, rej ) => {
      if ( ! username || ! _.isString( username ) )
        return rej( `[${_method}] Username is empty or non-string value` )

      let docQuery

      docQuery = this
        .findOne({
          username: username
        })

      docQuery
        .then( userDoc => {
          // If no results were found, then 
          if ( _.isEmpty( userDoc ) )
            return rej( `[${_method}] No user with the name ${username} found` )

          // Otherwise, return a single object
          return res( userDoc )
        })
        .catch( err => {
          console.error( `[${_method}] ERROR:`, err )
          return rej( err )
        })

    })
  }
}

/*
_.forEach( [ 'find', 'findOne', 'findOneById', 'findOneAndRemove', 'findOneAndUpdate' ], query => {
  AssetSchema.pre( query, function() {
    this
      .populate( 'attributes._field' )
      .populate( { path: '_partition' } )
  })
})

Account.Schema = new Schema({
      name: {
        first: String,
        value: String
      },
      username: { 
        type: String, 
        required: true, 
        unique: true 
      },
      password: { 
        type: String, 
        required: 
        true 
      },
      admin: Boolean,
      location: String,
      meta: {
        age: Number,
        website: String
      },
      created_at: Date,
      updated_at: Date
    })

schema.post('save', function (doc) {
  console.log('this fired after a document was saved');
});

schema.post('find', function(docs) {
  console.log('this fired after you run a find query');
});

*/

var logpre = '>>>\t'

_.forEach( [ 
  'find', 'findOne', 'findOneById', 'findOneAndRemove', 
  'findOneAndUpdate', 'save', 'update', 'findOneAndUpdate' 
  ], query => {
  Account.Schema
    .pre( query, function( next ) {
      console.log( logpre + '[Account.Schema.pre(%s)]', query )
      //console.log( logpre + '[Account.Schema.pre(%s)] this:', query, this )
      next()
    })
    .pre( query, true, function(next, done) {
      next()
      setTimeout( () => {
        console.log( logpre + '[Account.Schema.pre(%s) parallel]', query )
        //console.log( logpre + '[Account.Schema.pre(%s) parallel] this:', query, this )
        done()
      }, 100)
    })
    .post( query, function( ) {
      console.log( logpre + '[Account.Schema.post(%s)]', query )
      //console.log( logpre + '[Account.Schema.post(%s)] this:', query, this )
    })
})

Account.Model = Mongoose.model( Account, Account.Schema )


module.exports = Account

/**
EXAMPLE USAGE:

'use strict'

const _             = require( 'lodash' )
const Async         = require( 'async' )
const Util          = require( 'util' )
const AppRoot       = require( 'app-root-path' )
const Path          = require( 'path' )
const Columnify     = require( 'columnify' )
const Mongoose      = require( 'mongoose' )

Mongoose.Promise = require( 'bluebird' )

Mongoose.connect( 'mongodb://127.0.0.1:27017/sasset_test', { config: { autoIndex: false } })

const Account = require('./models/Account')

new Account({
    name: {
      first: 'John',
      last: 'doe'
    },
    username: 'idkwtf',
    password: 'asdfadf'
  })
  .save()
  .then( doc => {
    console.log("Created:",doc)
  })
  .catch( err => {
    console.error( 'ERROR:',err )
  } )
  .finally( () => {
    console.log('Finally.. ending')
    Mongoose.connection.close()
  } )

Account
  .createUser({
    name: {
      first: 'foo', last: 'bar'
    },
    username: 'Foobar',
    password: 'idkwtf'
  })
  .then( doc => {
    console.log("Created:",doc)
    console.log("doc.fullName:",doc.fullName)
  })
  .catch( err => {
    console.error( 'ERROR:',err )
  } )
  .finally( () => {
    console.log('Finally.. ending')
    Mongoose.connection.close()
  } )


Account
  .findUserByUsername('Foobar')
  .then( doc => {
    console.log("Found:",doc)
    console.log("doc.fullName:",doc.fullName)
  })
  .catch( err => {
    console.error( 'ERROR:',err )
  } )
  .finally( () => {
    console.log('Finally.. ending')
    Mongoose.connection.close()
  } )

*/