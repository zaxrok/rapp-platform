/***
 * Copyright 2015 RAPP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Authors: Konstantinos Panayiotou
 * Contact: klpanagi@gmail.com
 *
 */


/***
 * @fileOverview
 *
 * [Qr-Detection] RAPP Platform front-end web service.
 *
 *  @author Konstantinos Panayiotou
 *  @copyright Rapp Project EU 2015
 */

var hop = require('hop');
var path = require('path');
var util = require('util');


var PKG_DIR = ENV.PATHS.PKG_DIR;
var INCLUDE_DIR = ENV.PATHS.INCLUDE_DIR;

var svcUtils = require(path.join(INCLUDE_DIR, 'common',
    'svc_utils.js'));

var Fs = require( path.join(INCLUDE_DIR, 'common', 'fileUtils.js') );

var RandStringGen = require ( path.join(INCLUDE_DIR, 'common',
    'randStringGen.js') );

var ROS = require( path.join(INCLUDE_DIR, 'rosbridge', 'src',
    'Rosbridge.js') );

var interfaces = require( path.join(__dirname, 'iface_obj.js') );

/* ------------< Load parameters >-------------*/
var svcParams = ENV.SERVICES.qr_detection;
var SERVICE_NAME = svcParams.name;
var rosSrvName = svcParams.ros_srv_name;

var SERVICES_CACHE_DIR = ENV.PATHS.SERVICES_CACHE_DIR;
var SERVER_CACHE_DIR = ENV.PATHS.SERVER_CACHE_DIR;
/* ----------------------------------------------------------------------- */

// Instantiate interface to rosbridge-websocket-server
var ros = new ROS({hostname: ENV.ROSBRIDGE.HOSTNAME, port: ENV.ROSBRIDGE.PORT,
  reconnect: true, onconnection: function(){
    // .
  }
});

/*----------------< Random String Generator configurations >---------------*/
var stringLength = 5;
var randStrGen = new RandStringGen( stringLength );
/* ----------------------------------------------------------------------- */

/* ------< Set timer values for websocket communication to rosbridge> ----- */
var timeout = svcParams.timeout; // ms
var maxTries = svcParams.retries;
/* ----------------------------------------------------------------------- */


/**
 *  [Qr-Detection] RAPP Platform front-end web service.
 *  <p> Serves requests for qr_detection on given input image frame.</p>
 *
 *  @function qr_detection
 *
 *  @param {Object} args - Service input arguments (object literal).
 *  @param {String} args.file_uri - System uri path of transfered (client) file, as
 *    declared in multipart/form-data post field. The file_uri is handled and
 *    forwared to this service, as input argument, by the HOP front-end server.
 *    Clients are responsible to declare this field in the multipart/form-data
 *    post field.
 *
 *  @returns {Object} response - JSON HTTPResponse Object.
 *    Asynchronous HTTP Response.
 *  @returns {Array} response.qr_centers - An array of qr-center objects.
 *  @returns {Array} response.qr_messages - The array of the qr-messages. One
 *    qr_message string message for each found QR code.
 *  @returns {String} response.error - Error message string to be filled
 *    when an error has been occured during service call.
 */
function svcImpl ( kwargs )
{
  var req = new interfaces.client_req();
  var error = '';

  kwargs = kwargs || {};
  for( var i in req ){
    req[i] = (kwargs[i] !== undefined) ? kwargs[i] : req[i];
  }


  /***
   *  For security reasons, if file_uri is not defined under the
   *  server_cache_dir do not operate. HOP server stores the files under the
   *  SERVER_CACHE_DIR directory.
   */
  if( req.file_uri.indexOf(SERVER_CACHE_DIR) === -1 )
  {
    var errorMsg = "Service invocation error. Invalid {file_uri} field!" +
        " Abortion for security reasons.";
    var response = svcUtils.errorResponse(new interfaces.client_res());
    return hop.HTTPResponseJson(response);

  }
  /* ----------------------------------------------------------------------- */

  // Assign a unique identification key for this service request.
  var unqCallId = randStrGen.createUnique();

  var startT = new Date().getTime();
  var execTime = 0;

  var logMsg = 'Image stored at [' + req.file_uri + ']';

  /* --< Perform renaming on the reived file. Add uniqueId value> --- */
  var fileUrl = req.file_uri.split('/');
  var fileName = fileUrl[fileUrl.length -1];

  var cpFilePath = SERVICES_CACHE_DIR + fileName.split('.')[0] + '-'  +
    unqCallId + '.' + fileName.split('.')[1];
  cpFilePath = Fs.resolvePath(cpFilePath);
  /* ---------------------------------------------------------------- */


  /* --------------------- Handle transferred file ------------------------- */
  if (Fs.renameFile(req.file_uri, cpFilePath) === false)
  {
    //could not rename file. Probably cannot access the file. Return to client!
    var logMsg = 'Failed to rename file: [' + req.file_uri + '] --> [' +
      cpFilePath + ']';

    Fs.rmFile(req.file_uri);
    randStrGen.removeCached(unqCallId);
    var response = svcUtils.errorResponse(new interfaces.client_res());
    return hop.HTTPResponseJson(response);
  }
  logMsg = 'Created copy of file ' + req.file_uri + ' at ' + cpFilePath;
  /*-------------------------------------------------------------------------*/

  /***
   * Asynchronous http response
   */
  return hop.HTTPResponseAsync(
    function( sendResponse ) {

      /***
       *  Status flags.
       */
      var respFlag = false;
      var retClientFlag = false;
      var wsError = false;
      var retries = 0;
      /* --------------------------------------------------- */

      // Fill Ros Service request msg parameters here.
      var rosSvcReq = new interfaces.ros_req();
      rosSvcReq.imageFilename = cpFilePath;


      /***
       * Declare the service response callback here!!
       * This callback function will be passed into the rosbridge service
       * controller and will be called when a response from rosbridge
       * websocket server arrives.
       */
      function callback(data){
        respFlag = true;
        if( retClientFlag ) { return; }
        // Remove this call id from random string generator cache.
        randStrGen.removeCached( unqCallId );
        // Remove cached file. Release resources.
        Fs.rmFile(cpFilePath);
        //console.log(data);
        // Craft client response using ros service ws response.
        var response = parseRosbridgeMsg( data );
        // Asynchronous response to client.
        sendResponse( hop.HTTPResponseJson(response) );
        retClientFlag = true;
      }

      /***
       * Declare the onerror callback.
       * The onerror callack function will be called by the service
       * controller as soon as an error occures, on service request.
       */
      function onerror(e){
        respFlag = true;
        if( retClientFlag ) { return; }
        // Remove this call id from random string generator cache.
        randStrGen.removeCached( unqCallId );
        // Remove cached file. Release resources.
        Fs.rmFile(cpFilePath);
        // craft error response
        var response = svcUtils.errorResponse(new interfaces.client_res());
        // Asynchronous response to client.
        sendResponse( hop.HTTPResponseJson(response) );
        retClientFlag = true;
      }


      // Invoke ROS-Service request.
      ros.callService(rosSrvName, rosSvcReq,
        {success: callback, fail: onerror});

      /***
       * Set Timeout wrapping function.
       * Polling in defined time-cycle. Catch timeout connections etc...
       */
      function asyncWrap(){
        setTimeout( function(){

         /***
          * If received message from rosbridge websocket server or an error
          * on websocket connection, stop timeout events.
          */
          if ( respFlag || wsError || retClientFlag ) { return; }

          retries += 1;

          var logMsg = 'Reached rosbridge response timeout' + '---> [' +
            timeout.toString() + '] ms ... Reconnecting to rosbridge.' +
            'Retry-' + retries;

          /***
           * Fail. Did not receive message from rosbridge.
           * Return to client.
           */
          if ( retries >= maxTries )
          {
            logMsg = 'Reached max_retries [' + maxTries + ']' +
              ' Could not receive response from rosbridge...';

            // Remove cached file. Release resources.
            Fs.rmFile(cpFilePath);

            execTime = new Date().getTime() - startT;

            var response = svcUtils.errorResponse(new interfaces.client_res());
            sendResponse( hop.HTTPResponseJson(response));
            retClientFlag = true;
            return;
          }
          /*--------------------------------------------------------*/
          asyncWrap();

        }, timeout);
      }
      asyncWrap();
      /*=================================================================*/
    }, this );
}


/***
 * Crafts response object.
 *
 *  @param {Object} rosbridge_msg - Return message from rosbridge
 *
 *  @returns {Object} response - Response Object.
 *  @returns {Array} response.qr_centers - An array of qr-center objects.
 *  @returns {Array} response.qr_messages - The array of the qr-messages. One
 *    qr_message string message for each found QR code.
 *  @returns {String} response.error - Error message string to be filled
 *    when an error has been occured during service call.
 */
function parseRosbridgeMsg(rosbridge_msg)
{
  var qrCenters = rosbridge_msg.qr_centers;
  var qrMessages = rosbridge_msg.qr_messages;
  var error = rosbridge_msg.error;

  var logMsg = 'Returning to client.';

  var response = new interfaces.client_res();

  for (var ii = 0; ii < qrCenters.length; ii++)
  {
    var qrPoint = { x: 0, y: 0};

    qrPoint.x = qrCenters[ii].point.x;
    qrPoint.y = qrCenters[ii].point.y;
    response.qr_centers.push(qrPoint);
    response.qr_messages.push(qrMessages[ii]);
  }

  response.error = error;

  if (error !== '')
  {
    logMsg += ' ROS service [' + rosSrvName + '] error' +
      ' ---> ' + error;
  }
  else
  {
    logMsg += ' ROS service [' + rosSrvName + '] returned with success';
  }

  return response;
}


registerSvc(svcImpl, svcParams);