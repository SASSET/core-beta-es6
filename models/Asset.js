'use strict'

//const _             = require( 'lodash' )
const _ = require( '../mongoose-mixins' )
const Async = require( 'async' )
const Util = require( 'util' )
const Path = require( 'path' )
const Mongoose = require( 'mongoose' )
const Promise = require( 'bluebird' )

const {
  Schema,
  Types,
  Model
} = Mongoose

const Base = require( './Base' )

if ( ! _.isAlive( Mongoose ) )
  throw new Error( `The Mongoose connection is not active` )

class Asset extends Base {
  constructor( data ) {
    super( data )
  }

  // --------------------------------------------------------------------

  static get Schema() {
    if ( ! Asset._schema ) {
      Asset._schema = new Schema( {
        status: {
          type: Schema.Types.String,
          default: 'unlocked',
          select: true,
          minlength: 6, // Length of 'locked'
          maxlength: 108, // Length of _.passwordHash value
          // Validate that its locked, unlocked, or a 108 character hash (made by _.passwordHash)
          validate: {
            validator: status => _.includes( [ 'unlocked', 'locked' ], status ) || status.length === 108,
            message: '{VALUE} is not a valid status - Must be "locked", "unlocked" or a 108 character password hash'
          }
        },
        _createdBy: {
          //required: true,
          type: Schema.Types.ObjectId,
          ref: 'Account'
        },
        _updatedBy: {
          type: Schema.Types.ObjectId,
          ref: 'Account'
        },
        attrCache: new Schema( {}, {
          strict: false
        } ),
        attributes: [ {
          _field: {
            type: Schema.Types.ObjectId,
            ref: 'Field',
            required: true
          },
          value: {
            type: Schema.Types.Mixed,
            required: true
          },
          // Determines if the value for this attribute on the asset doc is immutable or not
          immutable: {
            type: Schema.Types.Boolean,
            required: false,
            default: false
          }
        } ],
        _partition: {
          type: Schema.Types.ObjectId,
          ref: 'Partition',
          required: true
        },
        // Determines if this asset can be modifiedd, or is immutable 
        immutable: {
          type: Schema.Types.Boolean,
          required: false,
          default: false
        }
      }, {
        /**
         * @type Date
         * @see http://mongoosejs.com/docs/guide.html#timestamps
         * @ignore
         */
        timestamps: {
          createdAt: 'createdAt',
          updatedAt: 'updatedAt'
        },
        strict: true
      } )
    }

    return Asset._schema
  }

  // VIRTUAL PROPERTIES -------------------------------------------------

  // VIRTUAL PROPERTIES -------------------------------------------------

  /**
   * Retrieve the primary value of an asset. The main goal of this is to quickly be able to reference
   * assets by their primary value, if one is set. This defaults back to the assets _id string
   *
   * NOTE: For the identifier virtual property to work properly, the _partition and _partition._fields
   *       both need to be populated, otherwise, the assets ID will be returned
   *
   * @this    module:AssetModel
   * @instance
   * @readonly
   * @name    module:AssetModel#identifier
   * @memberof module:AssetModel
   * @returns {string}    Whatever the value of the primary field is for this asset, or if there isn't a
   *                      primary field, or it isn't populated, return the assetID
   *
   * @example // In partition without a primary field, the identifier defaults to the documents ObjectID
   *  AssetModel.create( partitionId, ( error, assetDoc ) => {
   *      if ( error ) 
   *          return console.error( `Error: ${error}` )
   *
   *      console.log( `The asset ${assetDoc.identifier} was created successfully` ) 
   *      // => The asset 56d0819b655baf4a4a7f9cad was created successfully
   *  })
   * 
   * @example // In a partition with a primary field, the primaryField value is the identifier
   *  AssetModel.create( partitionId, {
   *      primaryAttribute: 'asset-123'
   *  }, ( error, assetDoc ) => {
   *      if ( error ) 
   *          return console.error( `Error: ${error}` )
   *
   *      console.log( `The asset ${assetDoc.identifier} was created successfully` ) 
   *      // => The asset asset-123 was created successfully
   *  })
   */
  get identifier() {
    // Value to return if no primary field is configured or no value is found
    const assetID = this._id

    // If the partition or partition fields werent loaded, then return null
    // (Should only happen if they weren't populated via the query)
    if ( ! this._partition || ! this._partition._fields )
      return assetID

    // Filter for the primary field..
    const primaryField = _.find( this._partition._fields, {
      primary: true
    } )

    // If no primary field is found, just return null
    if ( _.isUndefined( primaryField ) )
      return assetID

    // Filter through the assets attributes for the primary field attribute
    const primaryVal = _.find( this.attributes, f => {
      // If the field is an object, then the attributes._field has been populated,
      // so check the _id of the field, rather than the field itself..
      if ( _.isObject( f._field ) )
        return f._field._id.toString() === primaryField._id.toString()

      // Otherwise, just do a simple comparison
      return f._field.toString() === primaryField._id.toString()
    } )

    // If its not found, return null. This should only happen if the primary field was
    // set/configured after the asset was already made
    if ( ! primaryVal )
      return assetID

    // If the primary value is empty/null (which should only happen if the asset was
    // created before the primary field was configured), then return the assets ID
    return _.isEmpty( primaryVal.value ) ?
      assetID :
      primaryVal.value
  }

  // --------------------------------------------------------------------

  set identifier( id ) {
    // If the partition has a primary field, then attempt to update it
  }

  // STATIC METHODS -----------------------------------------------------

  /**
   * Create one or multiple assets, associating them to the specified partition. This is much easier than inserting 
   * a new asset document manually, since the `attributes` parameter here can be a simple object, (or an array of 
   * objects for multiple assets), and the static/dynamic attributes are extracted by grabbing the partition fields 
   * and parsing the object
   *
   * @function    module:AssetModel.create
   * @alias       module:AssetModel.createAsset
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.create
   * @throws      {module:AssetModel~AssetException}        This throws an AssetError exception
   * @param   {module:AssetModel~ObjectId}                    partitionId  The MDB ObjectId of the partition the assets 
   *                                                                       should be associated to
   * @param   {?(array|object|module:AssetModel~createCb)}   [attrsOrCb]    An object of the attribute values (static and 
   *                                                                       dynamic attrs), or an array of objects (for 
   *                                                                       multiple assets), or undefined for empty 
   *                                                                       attribute values.
   * @param   {module:AssetModel~createCb}                   [callback]     Callback to fire when the assets are successfully 
   *                                                                       or unsuccessfully created (If undefined, then a 
   *                                                                       Promise will be returned from this method)
   * @returns {Promise}   Returns a Bluebird promise, unless a callback is specified
   * @note    I HIGHLY recommend that the assets be created from the Partition instance methods, as they do most of
   *          the validation, this should only be used after the asset attributes are already validated
   * @todo    Validate the asset attributes against the partition field settings
   * @todo    Validate the partition ID exists (by getting the data)
   * @todo    Use above data to verify the primary attibute is populated
   * 
   * @example // Create a single asset without any attribute values defined
   *  AssetModel.create( PartitionsObjectId )
   *      .then( assetDoc => {
   *          console.log( `The asset ${assetDoc.identifier} was successfully created` ) 
   *          // => The asset 56a3e5c72b46691213a8f319 was successfully created
   *      })
   *      .catch( error => console.error( `Error: ${error}` ) )
   *
   * @example // Create a single asset in a partition with the primary field 'primaryAttr', using a callback
   *  AssetModel.create( PartitionsObjectId, {
   *      primaryAttr: 'asset-123', // Primary (string) attribute (Providing callback function)
   *      booleanAttr: false,       // Boolean attribute
   *      numericAttr: 123          // Numeric attribute
   *  })
   *      .then( assetDocs => {
   *          console.log( `The asset ${assetDoc.identifier} was successfully created` ) 
   *          // => The asset asset-123 was successfully created
   *      })
   *      .catch( error => console.error( `Error: ${error}` ) )
   * 
   * @example // Create two assets
   *  AssetModel.create( PartitionsObjectId, [{
   *      stringAttr: 'Asset #1', // String attribute
   *      booleanAttr: false,     // Boolean attribute
   *      numericAttr: 123        // Numeric attribute
   *  },{
   *      stringAttr: 'Asset #2', // String attribute
   *      booleanAttr: true,      // Boolean attribute
   *      numericAttr: 456        // Numeric attribute
   *  }])
   *      .then( assetDocs => {
   *          console.log( `The assets ${_.size( assetDocs )} were successfully created` ) 
   *          // => The assets _____ were successfully created
   *      })
   *      .catch( error => console.error( `Error: ${error}` ) )
   */
  static create( partitionId, attrsOrCb, callback ) {
    /**
     * Internal command to create the document for a new asset
     *
     * @param   {(module:AssetModel~ObjectId|string)}           _pId        Partition ID to add asset to
     * @param   {?(Object|module:AssetModel~createStaticCb)=}   _attrsOrCb  Either the Assets attribute values (static 
     *                                                                      AND dynamic - The static and dynamic attributes 
     *                                                                      are separated, and the proper asset document 
     *                                                                      structure is constructed); Or a callback function
     * @param   {module:AssetModel~createStaticCb=}               _cb  Callback to fire when asset gets created 
     *                                                                      successfully (If undefined, then a Promise 
     *                                                                      will be returned from this method)
     */
    let _create = ( _pId, _attrsOrCb = {}, _cb ) => {
      console.log( `AssetModel.create > _create - _pId: ${_pId}; _attrsOrCb: ${Object.keys(_attrsOrCb)}` )

      return new Promise( ( res, rej ) => {
          // If the _attrsOrCb is defined as something other than an object or a function, abort
          if ( ! _attrsOrCb && ! _.isObject( _attrsOrCb ) && ! _.isFunction( _attrsOrCb ) ) {
            return rej( 'Asset attributes need to be in an object' )
          }

          // Default the attrs to an empty object (which may fail, if the partition has required fields)
          let attrs = ( _.isObject( _attrsOrCb ) ? _attrsOrCb : {} )

          // Values to pull out of the attributes object, as they aren't partition fields
          let statics = [ 'status' ]

          // Separate the static fields from the attributes object (Since they are stored differently in the DB)
          statics = _.removeObj( attrs, statics )

          // Since the asset attributes need to be inserted using the field IDs (as opposed to names), get those
          // first, then use the attribute names to filter for the needed key
          Mongoose.models.Partition.getFieldIdsByName( _pId, Object.keys( attrs ) )
            .then( fields => {
              // Construct the attribute values in the right format (Array of objects like:
              // [ { _field: fieldId, value: 'Attr Val' } ]
              let attrValues = _.map( attrs, ( value, key ) => ( {
                _field: fields[ key ],
                value
              } ) )

              console.log( 'Fields:', fields )

              // Create the new asset with several merged objects, should result in something like:
              // { _partition: pId,
              //   status: 'locked',
              //   attributes: [ { _field: someFieldId, value: 'Some Value' } ] }
              // @todo If this is broken, its probably because of me adding the 'return'
              new this(
                  _.merge( {
                    _partition: _pId
                  }, statics, {
                    attributes: attrValues
                  } )
                )
                .save()
                .then( assetDoc => {
                  console.log( 'assetDoc:', assetDoc )
                  Log.info( `Asset ID ${assetDoc._id.toString()} successfully created in Partition ID ${_pId}` )
                  return res( assetDoc )
                } )
                .catch( err => rej( err ) )
            } )
            .catch( err => rej( _.setException( err ) ) )
        } )
        .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( arguments ) )
    }

    return new Promise( ( res, rej ) => {

        // Validate the partition ID is a valid Mongoose ID
        if ( ! Types.ObjectId.isValid( partitionId.toString() ) ) {
          return rej( 'Need a partition ID to add the assets to' )
        }

        // If the attributes are not unset AND not an object, then throw a hissy fit
        if ( ! attrsOrCb && ! _.isObject( attrsOrCb ) && ! _.isArray( attrsOrCb ) && ! _.isFunction( attrsOrCb ) ) {
          return rej( 'Asset attributes need to be in an object (If creating a single asset), or an array of ' +
            'objects (when creating multiple), or not at all (to create an asset with empty attributes)' )
        }

        // If attrsOrCb is falsey, then just use an empty object (creating a partition with no attr values)
        //attrsOrCb = ( _.isObject( attrsOrCb ) ? attrsOrCb : {} )
        if ( ! attrsOrCb ) {
          attrsOrCb = {}
        }

        // Check if an array is specified, which would mean were creating more than one asset
        if ( _.isArray( attrsOrCb ) ) {
          // If so, then create the asset documents asynchronously
          Async.mapSeries( attrsOrCb, ( attrs, cb ) => {
            // Create this asset, and send the new asset doc data via the cb
            //_create( partitionId, attrs, ( err, assetDoc ) => {
            //    cb( err, assetDoc )
            //} )
            _create( partitionId, attrs )
              .then( assetDoc => {
                console.log( 'Created:', assetDoc )
                cb( null, assetDoc )
              } )
              .catch( err => {
                console.log( 'Errored:', err )
                cb( err )
              } )
          }, ( err, results ) => {
            console.log( 'ERR:', err )
            console.log( 'RESULTS:', results )
            if ( err ) {
              console.log( 'Async Error:', err )
              /*
              return rej( new AppError({
                  code: 'partition.assets.create.createFailed',
                  data: err
              }) )
              */

              return rej( `Error(s) encountered while creating the asset documents - ${err}` )
            }
            console.log( 'Async Result:', results )
            return res( results )
          } )
        }

        // Creating a single asset
        else {
          _create( partitionId, attrsOrCb )
            .then( assetDoc => res( assetDoc ) )
            .catch( err => rej( err ) )
        }
      } )
      .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( arguments ) )
  }

  // --------------------------------------------------------------------

  /**
   * Find an asset by its identifier - This isn't much different than the other asset searches, other than it just
   * specifies the where object for you. If were provided an array of identifiers, then return an object, with the
   * identifier value as the key, and only return the identifiers that were found to have assets - Meaning if an
   * identifier was provided and no asset was found for it, then don't return it.
   *
   * @function    module:AssetModel.findByIdentifier
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.findByIdentifier
   * @throws      {module:AssetModel~AssetException}          This throws an AssetError exception
   * @param       {(string|Object|module:PartitionModel~ObjectId)}    pidOrOpts                   The name or ObjectId of the assets partition
   * @param       {(string|module:PartitionModel~ObjectId)}           [pidOrOpts.partitionId]     The name or ObjectId of the assets partition
   * @param       {string}                                            [pidOrOpts.identifier]      The assets identifier
   * @param       {(string|function)}                                 [aidOrCb]                   If pidOrOpts is an object, then this can be a callback 
   *                                                                                              function; Otherwise, it must be the assets identifier
   * @param       {function}                                          [callback]                  Callback to execute, otherwise a promise is returned
   * @returns {Promise}   Promise returned, or callback executed
   * @note    This is the same thing as Partition.findAssetByIdentifier(), except since this is a static method, the
   *          partitions ID needs to be specified
   * @note    Even though the parameters pidOrOpts.identifier and identifier are set as optional, one of the two must be provided; 
   *          Just as if pidOrOpts is ab Object, then pidOrOpts.partitionId is required
   * 
   * @example  // Find asset by identifier using a promise
   *  AssetModel.findByIdentifier( 'd8i3nas0p3na1pvg98d763m', 'webserver.phx.ad' )
   *      .then( assetDoc => {
   *          console.log( `Asset found` )
   *          console.log( `\t Document ObjectId   : ${assetDoc._id.toString()}` )
   *          console.log( `\t Document Identifier : ${assetDoc.identifier}` )
   *      } )
   *      .catch( error => console.error( `Error: ${error}` ) )
   *
   * @example  // Same result as above example, but using an object as the filter, and a callback
   *  AssetModel.findByIdentifier( { 
   *      partitionId: 'd8i3nas0p3na1pvg98d763m', 
   *      identifier: 'webserver.phx.ad' 
   *  }, ( assetError, assetDoc ) => {
   *      if ( assetError ) 
   *          return console.error( `Error: ${assetError}` )
   *      
   *      console.log( `Asset found` )
   *      console.log( `\t Document ObjectId   : ${assetDoc._id.toString()}` )
   *      console.log( `\t Document Identifier : ${assetDoc.identifier}` )
   * } )
   */
  static findByIdentifier( pidOrOpts, aidOrCb, callback ) {
    return new Promise( ( res, rej ) => {
        let partitionId

        // If this is executed by providing the Partition ID and identifier as separate params..
        if ( _m.isObjectId( pidOrOpts ) ) {
          partitionId = pidOrOpts

          if ( _.isNaN( identifier ) )
            return rej( new Error( 'Asset identifier is either invalid or absent' ) )

        }

        // If the 2nd param (pidOrOpts) is an object, then it must contain the assets partition and the assets identifier
        else if ( _.isObject( pidOrOpts ) ) {
          if ( ! _m.isObjectId( pidOrOpts.partitionId ) )
            return rej( new Error( 'Partition ID provided either invalid or absent' ) )

          partitionId = pidOrOpts.partitionId

          if ( _.isNaN( pidOrOpts.identifier ) )
            return rej( new Error( 'Asset identifier is either invalid or absent' ) )

          identifier = pidOrOpts.identifier
        }

        // Anything else means the partition ID and asset ID arent provided properly
        else {
          return rej( new Error( 'Invalid data provided - Expecting either the partition ID and asset ID as separate params, or an object with both' ) )
        }

        /*
        if ( ! _.isString( identifier )
            && ! _.isNumeric( identifier )
            && ! _m.isObjectId( identifier )
            && ! _.isArray( identifier ) ){
            return rej( new Error( 'Invalid identifier provided, needs to be a string, number or array' ) )
        }
        */

        //const partitionId = options.partitionId
        //const identifier  = options.identifier

        // Get the partition first, to get the ID of the primary field, then query for an asset using that
        Mongoose.models.Partition.getPartition( partitionId )
          .then( partitionData => {
            const primaryField = _.find( partitionData._fields, f => ! ! f.primary )

            if ( _.isEmpty( primaryField ) ) {
              return rej( new Error( 'No primary field found' ) )
            }

            const where = {
              'attributes._field': primaryField._id
            }

            // If were looking for more than one asset, use an array as the where clause
            if ( _.isArray( identifier ) ) {
              where[ 'attributes.value' ] = {
                $in: identifier
              }
            }
            // Or not
            else {
              where[ 'attributes.value' ] = identifier
            }

            // Query for an asset with the value as the primary fields ID, and the specified identifier
            // Keep it as a sub-promise, because we need the primaryField data for the error
            this.find( where )
              .then( assetData => {
                if ( _.isEmpty( assetData ) ) {
                  return rej( new Error( `No asset found with the ${primaryField.name} '${(_.isArray( identifier ) ? identifier.join("', '") : identifier)}' in this partition` ) )
                }

                // If we were given an array, then structure an object, with the identifiers as the keys
                if ( _.isArray( identifier ) ) {
                  return res( this.setIdentifiers( assetData ) )
                  /*
                  const result = {}

                  // Only add the assets that were found, so if there was an identifier provided that doesnt
                  // exist, then dont add it
                  _.forEach( assetData, ad => {
                      let primaryAttr = _.find( ad.attributes, a => a._field._id.toString() === primaryField._id.toString() )

                      result[ primaryAttr.value ] = ad
                  })

                  return res( result )
                  */
                }

                // Otherwise, just return the only asset that should have been found
                return res( assetData )
              } )
              .catch( err => rej( _.setException( err ) ) )
          } )
          .catch( err => rej( _.setException( err ) ) )

      } )
      .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( _.takeRight( arguments, 2 ) ) )
  }

  // --------------------------------------------------------------------

  /**
   * Check if an attribute value exists for a specific field in a specific partition
   *
   * @function    module:AssetModel.isAttrValueUnique
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.isAttrValueUnique
   * @throws      {module:AssetModel~AssetException}        This throws an AssetError exception
   * @param   {object}    data                Object with partition/field/value
   * @param   {string}    data.partitionId    Partition ID to query (can also be passed as data.partition)
   * @param   {Mixed}     data.value          Value to check (can also be passed as data.val)
   * @param   {string}    data.field          Field being validated (can also be passed as data.attr and
   *                                          data.attribute)
   * @param   {function}  [callback]          Callback to fire (or a promise is returned)
   * @returns {Promise}
   */
  static isAttrValueUnique( data, callback ) {
    return new Promise( ( res, rej ) => {
        let partitionId = data.partitionId || data.partition
        let field = data.field || data.attribute || data.attr
        let value = ! _.isUndefined( data.value ) ?
          data.value :
          data.val

        partitionId = partitionId.toString()
        field = field.toString()

        // Verify that a partition ID was specified (as partition or partitionId)
        //if ( ! _.isString( data.partitionId ) && ! _.isString( data.partition ) )
        if ( ! _.isString( partitionId ) ) {
          return rej( new Error( 'No partition ID specified' ) )
        }

        // Verify that a value was provided (as value or val)
        //if ( _.isUndefined( data.value ) && _.isUndefined( data.val ) )
        if ( _.isUndefined( value ) ) {
          return rej( new Error( 'No attribute value specified' ) )
        }

        // Verify that the field was specified (as field, attribute or attr)
        //if ( _.isUndefined( data.field ) && _.isUndefined( data.attribute ) && _.isUndefined( data.attr ) )
        if ( _.isUndefined( field ) ) {
          return rej( new Error( 'No field was specified' ) )
        }

        // Start the where operator used in the query
        const where = {
          _partition: partitionId
        }

        // If were ignoring any asset IDs
        if ( ! _.isUndefined( data.ignore ) ) {
          // Ignoring multiple asset IDs
          if ( _.isArray( data.ignore ) ) {
            if ( _.every( data.ignore, _m.isObjectId ) ) {
              where._id = {
                $nin: data.ignore
              }
            } else {
              return rej( new Error( `Failed to validate unique value - one or more of the asset IDs provided in the ignore array was not a valid asset ID` ) )
            }
          }

          // Ignoring a single asset ID
          else if ( _m.isObjectId( data.ignore ) ) {
            where._id = {
              $ne: data.ignore
            }
          }

          // The `data.ignore` value wasn't a valid ID or array of IDs
          return rej( new Error( `Failed to validate unique value - the asset ID provided is not a valid document ObjectId` ) )
        }

        this.find( where )
          //.populate( { path: '_partition' } )
          .populate( {
            path: 'attributes._field',
            match: {
              name: {
                $eq: field
              }
            }
          } )
          .then( data => {
            // If any assets were found with this field, at all (not value specific yet)
            if ( data.length > 0 ) {
              // Check through those assets found for any matching values
              return ! ! _.filter( data, d => ! ! _.filter( d.attributes, a => a.value == value )
                  .length )
                .length ?
                rej( new Error( `The value ${value} was found for another asset` ) ) :
                res( true )
            }

            return res( true )
          } )
          .catch( err => rej( _.setException( err ) ) )
      } )
      .asCallback( callback )
  }

  // --------------------------------------------------------------------

  /**
   * Retrieve all or one
   * 
   * @function    module:AssetModel.getPartitionsAssets
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.getPartitionsAssets
   * @throws      {module:AssetModel~AssetException}          This throws an AssetError exception
   * @param       {(string|module:PartitionModel~ObjectId)}   partition       Partition name or partitions ObjectId
   * @param       {(object|function)}                         [attrsOrCb]     Attributes to retrieve, or callback
   * @param       {function}                                  [callback]      Callback to execute (if not treated as 
   *                                                                          promise)
   * 
   * @example
   * AssetModel.getPartitionsAssets( 'Some Partition Name' )
   *     .then( assetDocs => console.log( 'Assets:', assetDocs ) )
   *     .catch( error => console.error( `Error retrieving assets - ${error.message}`))
   */
  static getPartitionsAssets( partition, attrsOrCb, callback ) {
    return new Promise( ( res, rej ) => {
        if ( ! _m.isObjectId( partition ) ) {
          return rej( new Error( `The partition needs to be a valid Partition ID` ) )
        }

        const where = {
          _partition: partition.toString()
        }

        if ( _.isObject( attrsOrCb ) ) {
          _.assignIn( where, attrsOrCb )
        }

        this.find( where )
          .then( assetDocs => {
            if ( _.isEmpty( assetDocs ) ) {
              return res( [] )
            }

            const result = []

            // If theres some filters..
            if ( _.isPlainObject( attrsOrCb ) && ! _.isEmpty( attrsOrCb ) ) {
              // Values to pull out of the attributes object, as they aren't partition fields
              let statics = [ 'status' ]

              // Separate the static fields from the attributes object (Since they are stored differently in the DB)
              statics = _.removeObj( attrsOrCb, statics )

              // Statics are at the top level, so those are easy to search first, if any are set
              if ( ! _.isEmpty( statics ) ) {
                let filteredStatics = _.remove( assetDocs, ad => {

                } )
              }
            }

            res( assetDocs )
          } )
          .catch( err => rej( _.setException( err ) ) )
      } )
      .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( arguments ) )
  }

  // --------------------------------------------------------------------

  /**
   * When assets are returned from a query, they are returned as an array of objects. This method can be used to 
   * restructure the array of objects into an object of objects, with the object keys being the value of the asset
   * identifiers (so could be an attribute value, or the ObjectId). The asset identifiers are populated by calling the
   * documents 'identifier' virtual property.
   *
   * @function    module:AssetModel.setIdentifiers
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.setIdentifiers
   * @throws      {module:AssetModel~AssetException}          This throws an AssetError exception
   * @param   {array}     collection  Collection of assets (Array from a query)
   * @param   {boolean}   forceIds    If this is set to true, then the documents ObjectIds will be used as the object 
   *                                  keys (as opposed to using the primary attribute value, if available)
   * @returns {object}    The restructured object is returned
   * @note    This is setup as an instance method, so the partitions primary field ID can be grabbed without having
   *          to execute another query
   * @note    If the partition does NOT have a primary field, then the assets ID will be used as the identifier
   * @note    Any errors will throw a new Error()
   *
   * @example // Query for all assets in a partition, then reconstruct the result from an array of objects (asset 
   * // documents), to an object of objects, with the asset ID as the object keys
   * Asset.getPartitionsAssets( '56d0807d66b93cad49dbbbe4' )
   * .then( assets => {
   *     // Currently, assets is an array of objects
   *     return Asset.setIdentifiers( assets )
   * } )
   * .then( assets => {
   *     // After passing the assets array through Asset.setIdentifiers, 
   *     // assets is now an object of objects, with the asset 
   *     // identifiers as the object key values
   *     return console.log( '# RESULT:', assets )
   * } )
   * .catch( err => console.error( '# ERROR:',err ) )
   */
  static setIdentifiers( collection, forceIds ) {
    if ( ! _.isArray( collection ) ) {
      throw new Error( `An array of asset documents is required - received a ${_.typeof(collection)}` )
    }

    return _.mapKeys( collection, a => a.identifier )
  }

  // --------------------------------------------------------------------

  /**
   * Retrieve a specific asset by the asset documents ObjectId. 
   *
   * @function    module:AssetModel.get
   * @alias       module:AssetModel.getAssets module:AssetModel.getAsset
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.get
   * @throws      {module:AssetModel~AssetException}   This throws an AssetError exception
   * @param       {module:AssetModel~ObjectId}    assetId     Assets document Object Id or primary value (If parent 
   *                                                          partition has one)
   * @param       {module:AssetModel~getCb}       [callback]  Callback to fire, or a promise is returned
   * @returns     {Promise}   Promise returned, or callback executed if provided
   * @todo        Allow this to work with the assets identifier
   *
   * @example // Query for a single Asset document
   * Asset.getAsset( '56d0819b655baf4a4a7f9cad' )
   *     .then( data => console.log( 'Result:', data ) )
   *     .catch( err => console.error( 'Error:', err ) )
   * 
   * @example // Query for multiple assets
   * Asset.getAssets( ['56d0819b655baf4a4a7f9cad','56d0819c655baf4a4a7f9cb4'] , ( err, data ) => {
   *     if ( err ) throw new Error( err )
   * 
   *     console.log( 'Result:', data )
   * })
   */
  static getAsset( assetId, callback ) {
    let exc = Mongoose.exception()

    return new Promise( ( res, rej ) => {
        //console.log('Finding ID:',assetId)
        let docQuery

        // If more than one asset ID was provided in an array.. then return an array of results
        if ( _.isArray( assetId ) ) {
          docQuery = this.find( {
            _id: {
              $in: assetId
            }
          } )
        }

        // Otherwise, return a single object
        else if ( _.isString( assetId ) || _m.isObjectId( assetId ) ) {
          docQuery = this.findById( assetId )
        }

        // 
        else {
          return rej( new ModelException( 'Invalid asset ID specified' ) )
        }

        docQuery
          .then( assetDoc => {
            // If no results were found, then 
            if ( _.isEmpty( assetDoc ) ) {
              var idTxt = ( _.isArray( assetId ) ? 'IDs ' + assetId.join( ', ' ) : 'ID ' + assetId )

              return rej( new ModelException( `Asset ${idTxt} not found` ) )
            }

            // If more than one asset ID was provided in an array.. then return the Document Objects in an 
            // object, with the document identifiers as the object keys
            if ( _.isArray( assetId ) ) {
              return res( this.setIdentifiers( assetDoc ) )
            }

            // Otherwise, return a single object
            return res( assetDoc )
          } )
          .catch( err => {
            console.error( 'Error:', err )
            return rej( _.setException( err ) )
          } )
      } )
      .asCallback( callback )
  }

  // --------------------------------------------------------------------

  /**
   * Find multiple assets, given specific criteria
   *
   * @function    module:AssetModel.findAssets
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.findAssets
   * @throws      {module:AssetModel~AssetException}   This throws an AssetError exception
   * @param       {(Object|string)}                           criteria                       Search criteria, can be a string, or an object
   * @param       {(Object|array)}                            [criteria.attribute]           Filter assets by a single attribute ({key:val}), or an array of attributes
   * @param       {Object[]}                                  criteria.attribute             Array of attribute filters
   * @param       {(string|module:AssetModel~ObjectId)}       criteria.attribute[].name      Name of attribute to filter
   * @param       {mixed}                                     criteria.attribute[].value     Value to filter for
   * @param       {module:AssetModel~findAssetsCb}            [callback]                     Callback to fire, or a promise is returned
   * @returns     {Promise}   Promise returned, or callback executed if provided
   */
  static findAssets( criteria, callback ) {
    return new Promise( ( res, rej ) => {

      } )
      .asCallback( callback )
  }

  // --------------------------------------------------------------------

  /**
   * Find a single asset, this is essentially the same as the static [find]{@link module:AssetModel.find} method, 
   * except only the first result is returned.
   *
   * @function    module:AssetModel.findAsset
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.findAsset
   * @throws      {module:AssetModel~AssetException}   This throws an AssetError exception
   * @param       {(Object|string)}                           criteria                    Search criteria
   * @param       {(Object|array)}                            [criteria.attribute]        Array of attribute filters
   * @param       {Object[]}                                  criteria.attribute          Array of attribute filters
   * @param       {(string|module:AssetModel~ObjectId)}   criteria.attribute[].name   Name of attribute to filter
   * @param       {mixed}                                     criteria.attribute[].value  Value to filter for
   * @param       {module:AssetModel~findAssetCb}             [callback]                  Callback to fire, or a promise is returned
   * @returns     {Promise}   Promise returned, or callback executed if provided
   */
  static findAsset( criteria, callback ) {
    return new Promise( ( res, rej ) => {

      } )
      .asCallback( callback )
  }

  // --------------------------------------------------------------------

  /**
   * Delete one or more assets by the Asset ObjectIds, unlike the Partition models delete method, this doesn't
   * require a Partition object
   *
   * @function    module:AssetModel.delete
   * @alias       module:AssetModel.deleteAsset, module:AssetModel.deleteAssets
   * @memberof    module:AssetModel
   * @this        module:AssetModel
   * @name        module:AssetModel.delete
   * @throws      {module:AssetModel~AssetException}   This throws an AssetError exception
   *
   * @param   {(string|object|array|module:AssetModel~ObjectId)}  options             Options with asset ObjectIds and other options;  A string 
   *                                                                                  for a single asset ObjectId; Or an array of ObjectIds for  
   *                                                                                  multiple assets
   * @param   {Object[]}                                          options.attribute   Array of attribute filters and delte by
   * @param   {Object.<string>}                                   [options.attribute] Attribute name/vak
   * @param   {string}                                            [options.comment]   Remark on why the asset(s) were deleted
   * @param   {(boolean|string)}                                  [options.force]     Force a delete by overriding a locked asset; If the asset  
   *                                                                                  is password protected, provide the password, otherwise just  
   *                                                                                  boolean
   * @param   {module:AssetModel~deleteStaticCb}                  [callback]          Callback to execute (optional)
   * @return  {Promise}   On success, an array of asset data is returned, if requireDelete is false,
   *                      and no assets were found/deleted, then null is returned
   * @todo  Determine what data is handed to the promise (last asset document data? asset ID? nothing?)
   *
   * @example // Delete a single asset (handled as a promise) via the asset ID
   *  AssetModel.delete( '56d0819b655baf4a4a7f9cad' )
   *      .then( data => {
   *          console.log( `Deleted ....??` )
   *          // => Deleted
   *      })
   *      .catch( error => console.error( `Error: ${error}` ) )
   *
   * @example // Delete two assets (handled as a promise) via one asset ID and one asset primary value
   *  AssetModel.delete( [
   *      '56d0819b655baf4a4a7f9cad', 'asset-123'
   *  ] )
   *      .then( data => {
   *          console.log( `Deleted ....??` )
   *          // => Deleted
   *      })
   *      .catch( error => console.error( `Error: ${error}` ) )
   * 
   * @example // Same as previous example, except the options parameter is an object, and a comment is specified
   *  AssetModel.delete( {
   *      assetIds : [ '56d0819b655baf4a4a7f9cad', 'asset-123' ],
   *      comment  : 'Deleting a few assets, because I feel like it'
   *  })
   *      .then( data => {
   *          console.log( `Deleted ....??` )
   *          // => Deleted
   *      })
   *      .catch( error => console.error( 'Error:', error )
   */
  static deleteAssets( options, callback ) {
    return new Promise( ( res, rej ) => {
        let assetIds
        let requireDelete = false

        //assetIds, requireDelete = false
        // An object will have more than just the asset Ids (possibly)..
        if ( _.isObject( options ) ) {
          // If assetIds isnt present throw an error
          if ( _.isUndefined( options.assetIds ) ) {
            throw new Error( 'No asset IDs specified to delete' )
          }
          // Yay, asset ID's were specified
          else {
            assetIds = options.assetIds
          }

          // See if requireDelete was set
          requireDelete = _.isBoolean( options.requireDelete ) ?
            options.requireDelete :
            false
        }
        // An array or string is one or more asset IDs
        else if ( _.isArray( options ) || _.isString( options ) ) {
          assetIds = options
        }
        // If it gets here, then no asset ID(s) were specified
        else {
          throw new Error( 'No asset ID(s) specified to delete' )
        }

        // Add the successfully deleted asset data to results.deleted, and the failed ID's to results.failed
        let results = {
          deleted: [],
          error: []
        }

        /* @todo Switch the below Async.each to this
        Async.mapSeries( assets, ( thisAsset, asyncCb ) => {
            this.deleteAsset( { asset: thisAsset, requireDelete: requireDelete }, ( error, result ) => asyncCb( error, result ))
        }, ( error, results ) =>  error
            ? rej( error )
            : res( results ) )
        */

        // Delete all assets asynchronously, saving the data to the results object
        Async.each( _.flattenDeep( [ assetIds ] ), ( assetId, done ) => {
          this.findByIdAndRemove( assetId )
            .then( data => {
              // If data is falsey, then it didn't delete, add the ID to the error array
              if ( ! data ) {
                results.error.push( assetId )
              }
              // Otherwise, add the asset data to the deleted data array
              else {
                results.deleted.push( data )
              }

              done()
            } )
            .catch( err => rej( _.setException( err ) ) )
        }, err => {
          if ( err ) {
            return rej( _.setException( err ) )
          }

          // Remove either array that may be empty
          results = _.omitBy( results, _.isEmpty )

          // If requireDelete is true, and there were some errors, then reject (but with same data as a success)
          if ( results.error && requireDelete ) {
            rej( _.setException( results ) )
          }

          res( results )
        } )
      } )
      .asCallback( callback )
  }

  // INSTANCE METHODS ---------------------------------------------------

  // INSTANCE METHODS ---------------------------------------------------


  /**
   * Dump asset attributes (into the console output)
   *
   * 
   */
  dumpAttrs() {
    var attrData = []

    _.forEach( this.attributes, ( attr, key ) => {
      attrData.push( {
        attribute: attr._field.name,
        type: attr._field.type,
        value: ( _.isArray( attr.value ) ? attr.value.join( ', ' ) : attr.value )
      } )
    } )

    console.log( Columnify( attrData ) )
  }

  // --------------------------------------------------------------------

  /**
   * Delete an asset - This is meant to be more complicated than just removing the document from the collection, as
   * there should be certain other actions taken, and if it's a soft delete, just update the doc
   *
   * @function module:AssetModel#delete
   * @name     module:AssetModel#delete
   * @instance
   * @param   {?(string|module:AssetModel~deleteInstCb)}  [commentOrCb]   Any comment to add for the logs, such as why 
   *                                                                      the asset was deleted
   * @param   {module:AssetModel~deleteInstCb}            [callback]      Callback to fire when asset gets deleted 
   *                                                                      successfully (If undefined, then a Promise 
   *                                                                      will be returned from this method)
   * @returns {Promise}   Returns a Bluebird promise, but only if the callback param is undefined
   *
   * @example // Query for an asset, then delete it (with a comment)
   *  AssetModel.get( 'asset-123' )
   *      .then( assetDoc => { return assetDoc.delete( `Deleting asset ${assetDoc.identifier} (duplicate)`) })
   *      .then( data => console.log( 'Asset successfully deleted' ) )
   *      .catch( error => console.error( `Error: ${error}` ) )
   *
   * @example // Query for an asset, then delete it (without a comment)
   *  AssetModel.get( 'asset-123' )
   *      .then( assetDoc => assetDoc.delete )
   *      .then( data => console.log( 'Asset successfully deleted' ) )
   *      .catch( error => console.error( `Error: ${error}` ) )
   */
  delete( commentOrCb ) {
    return new Promise( ( res, rej ) => {

      } )
      .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( arguments ) )
  }

  // --------------------------------------------------------------------

  /**
   * Create an entry in the Revisions collection with a copy of the assets current values
   *
   * @this        module:AssetModel
   * @function    module:AssetModel#createRevisionHistory
   * @name        module:AssetModel#createRevisionHistory
   * @param       {module:AssetModel~createRevisionCb}    [callback]    Callback to fire (Optional, or promise returned)
   * @returns     {Promise}   Returns a Bluebird promise, but only if the callback param is undefined
   */
  createRevisionHistory( callback ) {
    return new Promise( ( res, rej ) => {

      } )
      .asCallback( callback )
  }

  // --------------------------------------------------------------------

  /**
   * Retrieve an assets history
   *
   * @param   {(string|function)}     [filterOrCb]    Either a string to filter the history for, or a callback
   * @param   {function}              [callback]      If filterOrCb is a filter, this can optionally be a callback
   */
  history( filterOrCb, callback ) {
    return new Promise( ( res, rej ) => {

        if ( _.isPlainObject( filterOrCb ) ) {

        } else {

        }


      } )
      .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( arguments ) )
  }

  // --------------------------------------------------------------------

  /**
   * Get a specific revision number for the instances asset
   *
   * @param   {number}    revision    The assets revision number (NOT the revision ID)
   * @param   {function}  [callback]    Callback to execute if needed
   * @returns {Promise}   Promise, or callback executed if defined
   */
  getRevisions( revision, callback ) {
    return Mongoose.models.Revision.getRevision( {
      assetId: this._id,
      revision: revision
    }, callback )
  }

  // --------------------------------------------------------------------

  /**
   * Lock an asset, or optionally change the assets locked password
   *
   * @param   {string|object|function}    [pwdOrCb]           Password to use to secure asset, if none, asset is
   *                                                          locked with no password; Or callback to be executed
   *                                                          (optional, which will lock password with no password)
   * @param     {string}                  [pwdOrCb.password]  Password to use, if not set, then the asset will be
   *                                                          locked with no password
   * @param     {boolean}                 [pwdOrCb.override]  If an asset is already locked with a password, this will
   *                                                          override the unlock step by just resetting the password
   * @param     {string}                  [pwdOrCb.current]   Current password, used if the asset is currently secured,
   *                                                          and were re-locking it with a different password.
   *                                                          (Setting password.force to true will override this)
   * @param   {function}                  [callback]          Callback to execute, or Promise returned
   * @returns {Promise}   Promise returned (with new asset doc if resolved), or callback is executed if defined
   */
  lock( pwdOrCb, callback ) {
    return new Promise( ( res, rej ) => {
        // If the status isn't locked or unlocked, then assume its secured with a password hash
        if ( ! _.includes( [ 'locked', 'unlocked' ], this.status ) ) {
          // If the asset is secured, and the first parameter is an object, then we can continue to check if it
          // can be unlocked
          if ( _.isObject( pwdOrCb ) ) {
            // If the override flag is true, then don't reject anything, otherwise, continue with the checks..
            if ( pwdOrCb.override ! == true ) {
              // If were providing the current password of the secured asset, require a successful verification
              if ( _.isString( pwdOrCb.current ) ) {
                // Attempt to verify the provided password against the assets password (stored in the status)
                if ( ! _.passwordVerify( pwdOrCb.current, this.status ) )
                  return rej( new Error( 'The password provided to unlock the asset does not match the current password used to secure the asset' ) )
              }

              // Otherwise, reject the promise, as the status requires the current password or an override
              else {
                return rej( new Error( 'The asset is currently secured, and the current password is needed to make any changes' ) )
              }
            }
          }

          // If the asset is secured, and pwdOrCb isn't an object (meaning there's no pwdOrCb.override or
          // pwdOrCb.current), then reject the promise
          else {
            return rej( new Error( 'The asset is currently secured, and the current password is needed to make any changes' ) )
          }
        }

        // If this method has not yet been rejected, then we should be good to apply the changes to the asset

        // Set the password used to lock the asset, or leave it undefined
        const password = ( pwd => {
          if ( _.isString( pwd ) ) {
            return pwd
          } else if ( _.isObject( pwd ) && _.isString( pwd.password ) ) {
            return pwd.password
          }

          return undefined
        } )( pwdOrCb )

        // If the asset is locked (but unsecured), and there's no new password to secure the asset (meaning were
        // just locking it again, unsecured), then just resolve the method, don't re-save the asset document again,
        // that will just create a new revision with the same data
        if ( this.status === 'locked' && _.isUndefined( this ) ) {
          return res( this )
        }

        // If we've gotten this far, then the asset document will definitely be updated

        // Set the assets status
        this.status = ! _.isUndefined( password ) ?
          _.passwordHash( password ) :
          'locked'

        // Make sure Mongoose knows to update it
        this.markModified( 'status' )

        // SAVE! ..
        this.save( ( err, newAssetDoc ) => ( ! _.isEmpty( err ) ?
          rej( _.setException( err ) ) :
          res( newAssetDoc )
        ) )
      } )
      .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( arguments ) )
  }

  // --------------------------------------------------------------------

  /**
   * Lock an asset, or optionally change the assets locked password
   *
   * @param   {string|object|function}    [pwdOrCb]           Password to use to unlock asset (if its secured); Or an
   *                                                          object with the password and/or an override boolean; Or
   *                                                          callback to be executed (optional, which will lock
   *                                                          password with no password)
   * @param     {string}                  [pwdOrCb.password]  Password to use, if not set, then the asset will be
   *                                                          locked with no password
   * @param     {boolean}                 [pwdOrCb.override]  If an asset is already locked with a password, this will
   *                                                          override the unlock step by just resetting the password
   * @param   {function}                  [callback]          Callback to execute, or Promise returned
   * @returns {Promise}   Promise returned (with new asset doc if resolved), or callback is executed if defined
   */
  unlock( pwdOrCb, callback ) {
    return new Promise( ( res, rej ) => {
        // If the asset is already unlocked, then just resolve the method, don't re-save the asset document again,
        // that will just create a new revision with the same data
        if ( this.status === 'unlocked' ) {
          return res( this )
        }

        // If the status isn't 'locked', then assume its secured
        if ( this.status ! == 'locked' ) {
          // If the asset is secured, and the first parameter is an object, then we can continue to check if it
          // can be unlocked
          if ( _.isObject( pwdOrCb ) ) {
            // If the override flag is true, then don't reject anything, otherwise, continue with the checks..
            if ( pwdOrCb.override ! == true ) {
              // If were providing the current password of the secured asset, require a successful verification
              if ( _.isString( pwdOrCb.password ) ) {
                // Attempt to verify the provided password against the assets password (stored in the status)
                if ( ! _.passwordVerify( pwdOrCb.password, this.status ) )
                  return rej( new Error( 'The password provided to unlock the asset does not match the current password used to secure the asset' ) )
              }

              // Otherwise, reject the promise, as the status requires the current password or an override
              else {
                return rej( new Error( 'The asset is currently secured, and the current password is needed to make any changes' ) )
              }
            }
          }

          // If the first param is the password, then verify its the correct password
          else if ( _.isString( pwdOrCb ) ) {
            if ( ! _.passwordVerify( pwdOrCb, this.status ) )
              return rej( new Error( 'The password provided to unlock the asset does not match the current password used to secure the asset' ) )
          }

          // If the asset is secured, and pwdOrCb isn't an object (meaning there's no pwdOrCb.override or
          // pwdOrCb.current), then reject the promise
          else {
            return rej( new Error( 'The asset is currently secured, and the current password is needed to make any changes' ) )
          }
        }

        // If this method has not yet been rejected, then we should be good to apply the changes to the asset

        // Set the password used to lock the asset, or leave it undefined
        const password = ( pwd => {
          if ( _.isString( pwd ) ) {
            return pwd
          } else if ( _.isObject( pwd ) && _.isString( pwd.password ) ) {
            return pwd.password
          }

          return undefined
        } )( pwdOrCb )

        // If we've gotten this far, then the asset document will definitely be updated

        // Set the assets status
        this.status = 'unlocked'

        // Make sure Mongoose knows to update it
        this.markModified( 'status' )

        // SAVE! ..
        this.save( ( err, newAssetDoc ) => ( ! _.isEmpty( err ) ?
          rej( _.setException( err ) ) :
          res( newAssetDoc )
        ) )

      } )
      .asCallback( ( args => _.findLast( args, a => _.isFunction( a ) ) )( arguments ) )
  }

  // --------------------------------------------------------------------

  /**
   * Find revisions for associated asset
   *
   * @param   {object}        [options]             Options for filters
   * @param   {Date}          [options.date]        Grab revisions created on specific date
   * @param   {Date}          [options.before]      Grab revisions created before date
   * @param   {Date}          [options.after]       Grab revisions created after date
   * @param   {object}        [options.attributes]  Attributes to filter for (Must be exact case)
   * @param   {Date}          [options.except]      Grab revisions not created on date
   * @param   {object}        [options.where]       Custom defined mongoose 'where' object content (merged with existing)
   * @param   {number}        [options.limit]       How many revisions to return
   * @param   {object|string} [options.sort]        Sort revisions by this
   * @param   {function}      [callback]            Callback to fire, (or promise returned)
   * @return  {Promise}   Promise returned, or callback executed
   */
  revisions( options, callback ) {
    return new Promise( ( res, rej ) => {
        let where = {
          _asset: this._id
        }

        // Filter for any attributes (The MDB query needs to be setup like {'attrMeta.key': value} )
        if ( _.isObject( options.attributes ) )
          _.forEach( options.attributes, ( val, key ) => {
            where[ `attrMeta.${key}` ] = val
          } )

        // If any specific dates were defined...
        if ( _.isDate( options.after ) ||
          _.isDate( options.before ) ||
          _.isDate( options.date ) ||
          _.isDate( options.except ) ) {
          where.createdAt = {}

          // Revisions created after date
          if ( _.isDate( options.after ) )
            where.createdAt.$gt = options.after

          // Revisions created before date
          if ( _.isDate( options.before ) )
            where.createdAt.$lt = options.before

          // revisions created on specific date
          if ( _.isDate( options.date ) ) {
            // Create a window that will set a gte the date, and lte date + 24 hrs
            where.createdAt.$gte = options.date
            where.createdAt.$lte = new Date( new Date( options.date )
              .getTime() + 60 * 60 * 24 * 1000 )
          }

          // Exclude revisions created on date
          if ( _.isDate( options.except ) )
            where.createdAt.$ne = options.except
        }

        // If a specific where clause object was provided..
        if ( ! _.isObject( options.where ) )
          where = _.merge( where, options.where )

        const revisionQuery = Mongoose.models.Revision.find( where )

        // If a limit was specified
        if ( _.isNumber( options.limit ) )
          revisionQuery.limit( options.limit )

        // If sorting was requested..
        if ( _.isObject( options.sort ) || _.isObject( options.string ) )
          revisionQuery.sort( options.sort )

        // Execute the query..
        revisionQuery
          .then( data => {
            if ( _.isEmpty( data ) ) {
              return rej( new Error( 'No revisions found' ) )
            }

            // Convert the array of objects into an object of objects, with the revision as the indexes
            res( _.mapKeys( data, r => r.revision ) )
          } )
          .catch( err => rej( _.setException( err ) ) )
      } )
      .asCallback( callback )
  }

  // --------------------------------------------------------------------

  /**
   * Get the latest revision of an asset, that is NOT the current revision. This will search for all documents in the
   * revision table with the _asset ID of this asset, then sort it by the revision, and exclude the current
   * revision (__v value), then limit the responses to one document.
   *
   * @this        module:AssetModel
   * @function    module:AssetModel#lastRevisionCb
   * @name        module:AssetModel#lastRevision
   * @param       {?module:AssetModel~lastRevisionCb}  [callback]    Callback to execute, or promise returned if undefined
   * @returns     {Promise} 
   *
   * @example // Retrieve an asset document, query for the latest revision, then restore it (as a promise)
   *  AssetModel.getAsset( assetIdentifier )
   *      .then( assetDoc => assetDoc.lastRevision )
   *      .then( revisionDoc => revisionDoc.restore )
   *      .then( data => console.log( `Revision ID ${data.revision._id} restored to Asset ${data.asset._id}` ) )
   *      .catch( error => console.error( `Error: ${error}` ) )
   */
  lastRevision( callback ) {
    return new Promise( ( res, rej ) => {
        const Revision = Mongoose.models.Revision

        Revision.findOne( {
            _asset: this._id,
            // Get the latest revision that's NOT the current revision
            revision: {
              $ne: this.__v
            }
          } )
          .sort( {
            revision: 'desc'
          } )
          .limit( 1 )
          .then( data => {
            if ( _.isEmpty( data ) ) {
              return rej( new Error( 'No revision found' ) )
            }

            res( data )
          } )
          .catch( err => rej( _.setException( err ) ) )
      } )
      .asCallback( callback )
  }

  // --------------------------------------------------------------------

  /**
   * Manage a specific attribute of a specific asset. The top attr instance method returns an object with three
   * functions that can be used to retrieve (attr.value) the attribute, update (attr.set) the attributes value, and
   * delete (attr.delete) the attribute.
   *
   * @param   {string}    name    Attributes name or the attributes ID (ObjectId)
   * @returns {object}    Object with 3 other functions
   * @note    Any attribute modifications (delete/set) only change the attribute in memory, meaning the asset document
   *          will still need to be saved via Doc.save() for the changes to take effect
   * @note    If there is somehow more than one attribute found with the name specified (which shouldn't happen unless
   *          someone interacts with documents directly), then only the first asset will be retrieved
   * @example const Hostname = assetDoc.attr('Hostname')
   *          console.log(`Asset Hostname: ${Hostname.value()}`)
   *          Hostname.set('something.whatever.tld')
   *          Hostname.delete()
   * @todo    This needs to execute AttrCache middleware
   */
  attr( name ) {
    if ( _.isUndefined( name ) ) {
      return undefined
    }

    // Hold the asset in memory, since we a couple functions deep, lexical wont suffice
    const thisAsset = this

    // Shown before any errors thrown here
    const errPrefix = `Unable to retrieve/update the attribute ${name} for asset ID ${thisAsset._id}`

    // Make sure the attributes are set... This should never be false, but just in case
    if ( ! thisAsset.attributes || _.isUndefined( thisAsset.attributes[ 0 ] ) ) {
      throw new Error( `${errPrefix} - No attributes were found .. How did that happen??` )
    }

    // Make sure the fields were populated (This is done via getAttributes() automatically)
    if ( ! _.isObject( thisAsset.attributes[ 0 ]._field ) ) {
      throw new Error( `${errPrefix} - It doesn't look like the attributes._field was populated` )
    }

    // Get the index for the desired attribute from within the attributes array
    let attrIdx = _.findIndex( thisAsset.attributes, a => a._field.name.toLowerCase() === name.toLowerCase() || a._field._id.toString() === name )

    // If no attribute was found, then its undefined!
    if ( attrIdx === -1 ) {
      return undefined
    }

    const foundAttrsTotal = _( thisAsset.attributes )
      .filter( a => a._field.name.toLowerCase() === name.toLowerCase() || a._field._id.toString() === name )
      .size()

    // Check if there is somehow more than 1 attribute with this name, this should never happen (unless someone tries
    // to do something manually). If more than 1 is found, just console a notice, saying we will only be impacting
    // the first one matched
    // @todo This should be logged, whenever logging is created
    if ( foundAttrsTotal > 1 ) {
      Log.notice( `There were ${foundAttrsTotal} attributes found with the name ${name} (Not sure how ` +
        `that happened) - This method is attaching to only the first one found` )
    }

    /**
     * Attribute management functions. These are only accessible if the attribute itself has already been verified
     * via the above code, if it wasn't then either an error will be thrown, or undefined will be returned if the
     * attribute does not exist
     *
     * @var this.set    Set an attributes value (im memory, still needs to be saved via Doc.save())
     * @var this.delete Delete the specified attribute from memory
     * @var this.value  Retrieve the attributes value
     */
    return {
      /**
       * Set the attributes value in memory
       *
       * @param   {Mixed} value   New value of attribute
       * @returns {void}  Nothing to return..
       */
      set: value => {
        thisAsset.attributes[ attrIdx ].value = value
      },

      /**
       * Delete the attribute from the asset (in memory)
       *
       * @returns {boolean|object}    If there was an error removing it for some reason, then `false` is returned;
       *                              If the single attribute was deleted, return the attribute itself
       */
      delete: () => {
        // Use lodash to remove the attribute from the attributes, returning the deleted attribute
        const removed = _.remove( thisAsset.attributes, a => a._field.name.toLowerCase() === name.toLowerCase() || a._field._id.toString() === name )

        // If something was deleted.. mark the attributes as modified, or it wont get saved
        if ( ! _.isEmpty( removed ) ) {
          thisAsset.markModified( 'attributes' )
        }

        // There shouldn't be more than 1 attribute with the same name... unless someone tries to do something manually
        if ( removed.length > 1 ) {
          Log.notice( `There was more than 1 attribute found for ${name}... weird` )
        }

        // Make sure there isn't an attribute with the same name, just to be sure it was deleted
        attrIdx = _.findIndex( thisAsset.attributes, a => a._field.name.toLowerCase() === name.toLowerCase() || a._field._id.toString() === name )

        // If somehow it wasn't deleted, then false
        if ( attrIdx ! == -1 ) {
          return false
        }

        // If there was an attribute removed, then return it
        return removed[ 0 ]
      },

      /**
       * Retrieve attributes value
       *
       * @param   {boolean}   full    If true, then the entire attribute will be returned (should be populated)
       * @returns {Mixed|object}  If not full, attr value returned (mixed); If full, full attr returned (object)
       */
      value: full => {
        return full ?
          thisAsset.attributes[ attrIdx ] :
          thisAsset.attributes[ attrIdx ].value
      }
    }
  }

  // --------------------------------------------------------------------

  toString() {
    return this.identifier
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
    .pre( query, function ( next ) {
      console.log( logpre + '[Account.Schema.pre(%s)]', query )
      //console.log( logpre + '[Account.Schema.pre(%s)] this:', query, this )
      next()
    } )
    .pre( query, true, function ( next, done ) {
      next()
      setTimeout( () => {
        console.log( logpre + '[Account.Schema.pre(%s) parallel]', query )
        //console.log( logpre + '[Account.Schema.pre(%s) parallel] this:', query, this )
        done()
      }, 100 )
    } )
    .post( query, function () {
      console.log( logpre + '[Account.Schema.post(%s)]', query )
      //console.log( logpre + '[Account.Schema.post(%s)] this:', query, this )
    } )
} )

Account.Model = Mongoose.model( Account, Account.Schema )


module.exports = Account