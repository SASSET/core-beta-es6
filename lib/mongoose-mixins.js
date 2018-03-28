'use strict'

const Mongoose      = require( 'mongoose' )
const _             = require( 'lodash' )

const _internal = {
  states: {
    // List of valid Mongoose states
    readyStates: [ 
      'disconnected', // readyState: 0
      'connected',    // readyState: 1
      'connecting',   // readyState: 2
      'disconnecting' // readyState: 3
    ],
    // List of states that can be interpreted as "connected"
    connectedStates: [ 1, 2 ]
  }
}

function isAlive( mdb ) {
  var state = getState( mdb )

  return _.isInteger( state ) && _internal.states.connectedStates.indexOf( state ) !== -1
}

function getState( mdb, asTxt ) {
  let state = false

  if ( ! _.isObject( mdb ) )
    return false
  
  let objClass = _.get( mdb, 'constructor.name', false )

  if ( objClass !== 'Mongoose' )
    return false

  try {
    state = _.get( mdb, 'connection.readyState', false )
  }
  catch( e ){
    return false
  }

  if ( ! _.isInteger( state ) || ! _.isString( _internal.states.readyStates[ state ] )) 
    return false

  if ( asTxt === true )
    return _internalstates.states.readyStates[ state ]

  return state
}



_.mixin({ 
  'isAlive': isAlive,
  'getState': getState  
}, { 
  'chain': false 
})


module.exports = _

/*
0 = disconnected
1 = connected
2 = connecting
3 = disconnecting
*/