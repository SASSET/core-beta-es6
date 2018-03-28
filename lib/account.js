/**
 * LKjlk;ajsdf;alkdfjsakls;dfjkl;asdj
 * 
 * @module AccountLib
 */
 'use strict'

const _             = require( 'moar-lodash' )
const Promise       = require( 'bluebird' )
const Async         = require( 'async' )
const Util          = require( 'util' )
const AppRoot       = require( 'app-root-path' )
//const Log           = AppRoot.require('./lib/utils/logger')({ helper: 'Account Helper'})

/**
 * Private static account data object - Singleton account data storage
 *
 * @var {string}    accountData._id         Account ID (Required)
 * @var {string}    accountData.username    Username of account (Also required)
 */
let accountData = {}
/**
 * Account library
 *
 * @classdesc This module manages the account....? This is done by taking advantage of Node importing all modules as 
 * singletons, meaning this can be used to set the account ID from one file (after authentication), then a separate 
 * file (such as Mongoose models, for example) can load the same module, and call the getAccount method to retrieve the 
 * account that the current user is logged in as.
 * @description Any functionality related to the account login and authentication
 */

const AccountLib = module.exports = {
    /**
     * Set the account data  in the local private accountData object, to be retrieved via getAccount
     *
     * @function    module:AccountLib.setAccount
     * @param       {object|boolean}              data           Object of account data to update to, or false to clear
     * @param       {string}                      data._id       Account document ObjectId (Required)
     * @param       {string}                      data.username  Account username (Required)
     * @returns     {object}   Returns newly saved account data
     * @category    BLAH!...
     *
     * @example // Set the 
     * const AccountLib    = require( '/lib/account' )
     * 
     * AccountLib.setAccount({
     *     username:  'jhyland',
     *     _id: '56a3e7c72b26696213a8f399'
     * })
     */
    setAccount: data => {
        // Clear the account data if needed (EG: Logouts, etc)
        if( data === false )
            return accountData = {}

        if( ! _.isString( data._id ) || ! _.isString( data.username ) ){
            //Log.error(`Failed to set account data - username or _id not provided`)
            throw new Error(`Failed to set account data - username or _id not provided`)
        }

        //Log.debug(`Account ID set to ${data._id} (Username: ${data.username})`)

        return accountData = data
    },

    /**
     * Retrieve account data, either full object, or a specific attribute
     *
     * @function    module:AccountLib.getAccount
     * @param   {string}    attr    Specific attribute to return
     * @param   {boolean}   nice    If set to false, then instead of returning undefined for unset account data,
     *                              an error is thrown. (Nice = true by default, needs to be set to false)
     * @returns {object|Mixed|undefined}    If no attr is defined, full accountData object is returned, if attr is
     *                                      defined, then just that attribute is returned (mixed), if there is no
     *                                      account data set, then undefined is returned (or error thrown if nice
     *                                      is set to false
     */
    getAccount: ( attr, nice ) => {
        if( _.isEmpty( accountData ) ){
            //Log.error(`Account data requested, but no account data is set`)

            if( nice !== true )
                throw new Error('No account data has been set')
            else
                return undefined
        }

        //Log.debug(`Account data requested (${_.isUndefined( attr ) ? 'full object' : attr}) - returning `
         //       + `data for account ID ${accountData._id} (Username: ${accountData.username})`)

        return ! _.isUndefined( attr )
            ? accountData[ attr ]
            : accountData
    }
}
