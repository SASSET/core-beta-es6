'use strict'

const _             = require( 'lodash' )
const Mongoose      = require( 'mongoose' )
Mongoose.Promise    = Promise = require( 'bluebird' )
const AppRoot       = require( 'app-root-path' )



Mongoose.connect(
  //'mongodb://sasset_user:SassetPass1@ds047365.mongolab.com:47365/jhyland_test'
  //'mongodb://root:password@localhost:47365/sasset_test'
  'mongodb://127.0.0.1:27017/sasset_test'
)

const Setting = AppRoot.require('./models/Setting')

const _setting = {
  name: `test-${Date.now()}`,
  value: `Epoch time is now ${Date.now()}`,
  pets: ["Cat","Dog"]
}


Setting.createSetting( _setting )
//Setting.create( _setting )
  .then( data =>  {
    console.log( '[Setting.create] data:', data )
  })
  .catch( err => {
    console.log( '[Setting.create] err:', err )
  })
  .finally( () => {
    console.log( '[Setting.create] finally' ) 
    setTimeout(() => {
      Mongoose.connection.close()
      console.log('# Connection Closed')
    }, 3000) 
  })