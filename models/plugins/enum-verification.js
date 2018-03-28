'use strict'

const _         = require( 'sasset-lodash' )
const Mongoose  = require( 'mongoose' )
const Promise   = require( 'bluebird' )

/**
 * Mongoose plugin to validate enumerated values for schema items 
 *
 * @todo: Check if the item type is an array or a single item; then check the 
 *        enumerated values accordingly
 * @todo: Allow a function input at item.enum.map to alter the data before its 
 *        compared to the enum values (EG usage: convert int/floats to strings)
 */
function checkEnumVals( schema, options ){
  options = options || {};

  // Find the schema items that use Enum
  const enumItems = _.chain( schema.obj )
    .transform( ( result, value, key ) => {
      value.name = key
      result[ key ] = value
      return value
    })
    .filter( ( sItm, sKey ) => _.has( sItm, 'enum') )
    .mapKeys( sItm => sItm.name )
    .mapValues( sItm => {
      if ( _.isArray( sItm.enum ) )
        return sItm.enum

      if ( _.isObject( sItm.enum ) && _.isArray( sItm.enum.values ) )
        return sItm.enum.values

      return false
    } )
    .value()

  // Iterate over the schema items that have an enum property
  _.each( enumItems, ( enumValues, itemName ) => {
    let itemPath = deepPath(schema, itemName)

    itemPath.validate(function() {
      let thisDoc = this
      return new Promise( resolve => {

        if ( _.isNil( thisDoc[itemName] ) )
          return resolve(true)

        if ( _.isString( thisDoc[itemName] ) || _.isNumber( thisDoc[itemName] ) )
          return resolve( enumValues.indexOf( thisDoc[itemName] ) !== -1 )

        if ( _.isArray( thisDoc[itemName] ) ) {
          let badVals = _.chain( thisDoc[itemName] )
            .filter( v => enumValues.indexOf( v ) === -1 )
            .value()

          return resolve( badVals.length === 0 )
        }

        resolve( false )
      })
    })
  })
}

function deepPath(schema, pathName) {
  let path
  const paths = pathName.split('.')

  if ( paths.length > 1 ) 
    pathName = paths.shift()

  if ( typeof schema.path === 'function' ) 
    path = schema.path(pathName)

  if ( path && path.schema ) 
    path = deepPath( path.schema, paths.join('.') )

  return path
}

module.exports = checkEnumVals