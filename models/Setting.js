'use strict'

const AppRoot       = require( 'app-root-path' )
const _             = require( 'sasset-lodash' )
const Async         = require( 'async' )
const Util          = require( 'util' )
const Path          = require( 'path' )
const Mongoose      = require( 'mongoose' )
Mongoose.Promise    = require( 'bluebird' )

const { Schema, Types, Model } = Mongoose

const { 
  String,
  Number,
  Boolean,
  DocumentArray,
  Embedded,
  Array,
  Buffer,
  Date,
  ObjectId,
  Mixed,
  Decimal,
  Decimal128,
  Oid,
  Object,
  Bool
} = Schema.Types

const Base = require('./Base')


class Setting extends Base {
  constructor ( data ) {
    super( data )
  }

  static get Schema() {
    if ( ! Setting._schema ) {
      Setting._schema = new Schema({
        name: {
          type: String,
          required: true,
          minlength: 3,
          maxlength: 35,
          select: true,
          unique: true,
          lowercase: true,
          trim: true,
          validate: value => {
            if ( ! _.isString( value ) )
              return false

            if ( ! RegExp('^[a-zA-Z][a-zA-Z0-9_\.\-]*[a-zA-Z0-9]$').test( value ) )
              return false
            
            return true
          }
        },
        value: {
          type: Mixed,
          select: true,
          trim: true
        },
        type: {
          type: String,
          //required: true,
          default: 'string',
          lowercase: true,
          trim: true,
          enum: {
            values: [
              'string','boolean','single-select','multi-select',
              'decimal','integer','number','date','email','ip-address',
              'phone-number'
            ],
            message: 'Illegal setting type `{VALUE}` for setting (`{PATH}`)'
          }
        },
        description: {
          type: String,
          maxlength: 255,
          //required: true,
          //default: 'string',
          //lowercase: true,
          trim: true
        },
        pets: {
          type: [String], 
          foobar: 'asdf',
          enum: ["Cat", "Dog", "Bird", "Snake"]
        }
      }, {
        timestamps: {
          createdAt: 'createdAt',
          updatedAt: 'updatedAt'
        }
      })
    }

    return Setting._schema
  }

  // --------------------------------------------------------------------

  /**
   *
   */
  static createSetting( settingData, callback ){
    return new Promise( ( res, rej ) => {
      if ( ! _.isPlainObject( settingData ) )
        return rej( 'Data provided is invalid or undefined' )
      
      console.log('settingData:', settingData)

      var newSetting = new Setting( settingData )

      newSetting.validate( err => {
        if ( err ) return rej( err )

        newSetting.save( ( err, data ) => {
          if ( err ) return rej( err )

          res( data )
        })

      })
       
    }).asCallback( ( args  => _.findLast( args, a => _.isFunction( a ) ) )( _.takeRight( arguments, 2 ) ) )
  }

  // --------------------------------------------------------------------

  /**
   *
   */

  static deleteSetting( setting, callback ){

  }

  // --------------------------------------------------------------------

  /**
   *
   */
  static getSetting( setting, callback ){

  }

  // --------------------------------------------------------------------

  /**
   *
   */
  static findSetting( data, callback ){

  }

  // --------------------------------------------------------------------

  /**
   *
   */
  updateValue( data, callback ){

  }

  // --------------------------------------------------------------------

  /**
   *
   */

}

Setting.Schema.plugin(require('./plugins/enum-verification'), {
  TESTER: 'Foo',
  idkwtf: [ 'Hello', 'World' ],
  testObj: {
    a: 1
  }
})

Setting.Model = Mongoose.model( Setting, Setting.Schema )

module.exports = Setting
