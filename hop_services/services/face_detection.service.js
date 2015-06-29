/*!
 * @file face_detection.service.js
 * @brief Face detection hop front-end service.
 *
 */

"use strict";


console.log('Initiated Face Detection front-end service');

// TODO -- Load PLATFORM parameters from JSON file
// TODO -- Load ROS-Topics/Services names from parameter server (ROS)


/*---------Sets required file Paths-------------*/
var user = process.env.LOGNAME;
var module_path = '../utilities/js/'
/*----------------------------------------------*/

/*--------------Load required modules-----------*/
var Fs = require( module_path + 'fileUtils.js' );
var hop = require('hop');
var RandStringGen = require ( module_path + 'randStringGen.js' );
/*----------------------------------------------*/

/*-----<Define face-detection ROS service name>----*/
var ros_service_name = '/rapp/rapp_face_detection/detect_faces';
/*------------------------------------------------------*/

/*----<Random String Generator configurations---->*/
var stringLength = 5;
var randStrGen = new RandStringGen( stringLength );
/*------------------------------------------------*/

/* -- Set timer values for websocket communication to rosbridge -- */
var timer_tick_value = 100 // ms
var max_time = 2000 // ms
var max_tries = 2
//var max_timer_ticks = 1000 * max_time / tick_value;
/* --------------------------------------------------------------- */


/*!
 * @brief Face Detection HOP Service Core.
 *
 * @param file_uri Path of uploaded image file. Returned by hop server.
 * @return Message response from faceDetection ROS Service.
 *
 */
service face_detection ( {file_uri:''} )
{
  console.log("[face-detection]: Client Request");
  console.log('[face-detection]: Image stored at:', file_uri);

  /* --< Perform renaming on the reived file. Add uniqueId value> --- */
  var unqExt = randStrGen.createUnique();
  var file = file_uri.split('.');
  var file_uri_new = file[0] + '.' + file[1] +  unqExt + '.' + file[2];

  /* --------------------- Handle transferred file ------------------------- */
  if (Fs.rename_file_sync(file_uri, file_uri_new) == false)
  {
    Fs.rm_file_sync(file_uri);
    // Dismiss the unique identity key
    randStrGen.removeCached(unqExt);
    //could not rename file. Probably cannot access the file. Return to client!
    var resp_msg = craft_error_response(); 
    console.log("[face-detection]: Returning to client with error");
    return resp_msg; 
  }
  
  /*-------------------------------------------------------------------------*/
   
  // Dismiss the unique identity key
  randStrGen.removeCached(unqExt);

  //var star_time = undefined;
  //var elapsed_time = undefined;

  // Asynchronous Response. Implementation
  /*----------------------------------------------------------------- */
  return hop.HTTPResponseAsync(
    function( sendResponse ) { 

     var args = {
       /* Image path to perform faceDetection, used as input to the 
        *  Face Detection ROS Node Service
        */
       "imageFilename": file_uri_new
     };  

/*=============================TEMPLATE======================================================*/
      var rosbridge_connection = true;
      var respFlag = false;

      // Create a unique caller id
      var uniqueID = randStrGen.createUnique();
      var rosbridge_msg = craft_rosbridge_msg(args, ros_service_name, uniqueID);

      /* ------ Catch exception while open websocket communication ------- */
      try{
        var rosWS = new WebSocket('ws://localhost:9090');
      }
      catch(e){
        rosbridge_connection = false; // Could not open websocket to rosbridge websocket server
        console.error('[face-detection] ERROR: Cannot open websocket to rosbridge' +  
          '--> [ws//localhost:9090]' );
        Fs.rm_file_sync(file_uri_new);
        // Print exception 
        console.log(e);
        // Craft return to client message
        var resp_msg = craft_error_response();
        // Return to Client
        sendResponse( resp_msg ); 
        console.log("[face-detection]: Returning to client with error");
        return
      }
      /* ----------------------------------------------------------------- */
     
      /* ------- Add into a try/catch block to ensure safe access -------- */
      try{
        // Implement WebSocket.onopen callback
        rosWS.onopen = function(){
          rosbridge_connection = true;
          console.log('[face-detection]: Connection to rosbridge established');
          this.send(JSON.stringify(rosbridge_msg));
        }
        // Implement WebSocket.onclose callback
        rosWS.onclose = function(){
          console.log('[face-detection]: Connection to rosbridge closed');
        }
        // Implement WebSocket.message callback
        rosWS.onmessage = function(event){
          console.log('[face-detection]: Received message from rosbridge');
          Fs.rm_file_sync(file_uri_new);
          //console.log(event.value);
          var resp_msg = craft_response( event.value ); // Craft response message
          this.close(); // Close websocket 
          rosWS = undefined; // Ensure deletion of websocket
          respFlag = true; // Raise Response-Received Flag

          // Dismiss the unique rossrv-call identity  key for current client
          randStrGen.removeCached( uniqueID ); 
          sendResponse( resp_msg );
          console.log("[face-detection]: Returning to client");
        }
      }
      catch(e){
        rosbridge_connection = false;
        console.error('[face-detection] --> ERROR: Cannot open websocket' + 
          'to rosbridge --> [ws//localhost:9090]' );
        Fs.rm_file_sync(file_uri_new);
        console.log(e);
        var resp_msg = craft_error_response;
        sendResponse( resp_msg ); 
        console.log("[face-detection]: Returning to client with error");
        return;
      }
      /*------------------------------------------------------------------ */

      var timer_ticks = 0;
      var elapsed_time;
      var retries = 0;

      // Set Timeout wrapping function
      function asyncWrap(){
        setTimeout( function(){
         timer_ticks += 1;
         elapsed_time = timer_ticks * timer_tick_value;

         if (respFlag == true)
         {
           return
         }
         else if (respFlag != true && elapsed_time > max_time ){
           timer_ticks = 0;
           retries += 1;

           console.log("[face-detection]: Reached rosbridge response timeout" + 
             "---> [%s] ms ... Reconnecting to rosbridge. Retry-%s", 
             elapsed_time.toString(), retries.toString());

           if (retries > max_tries) // Reconnected for max_tries times
           {
             console.log("[face-detection]: Reached max_retries (%s)" + 
               "Could not receive response from rosbridge... Returning to client",
               max_tries);
             Fs.rm_file_sync(file_uri_new);
             var respMsg = craft_error_response();
             sendResponse( respMsg );
             console.log("[face-detection]: Returning to client with error");
             return; 
           }

           if (rosWS != undefined)
           {
             rosWS.close();
           }
           rosWS = undefined;

           /* --------------< Re-open connection to the WebSocket >--------------*/
           try{
             rosWS = new WebSocket('ws://localhost:9090');

             /* -----------< Redefine WebSocket callbacks >----------- */
             rosWS.onopen = function(){
             console.log('[face-detection]: Connection to rosbridge established');
             this.send(JSON.stringify(rosbridge_msg));
             }

             rosWS.onclose = function(){
               console.log('[face-detection]: Connection to rosbridge closed');
             }

             rosWS.onmessage = function(event){
               console.log('[face-detection]: Received message from rosbridge');
               Fs.rm_file_sync(file_uri_new);
               var resp_msg = craft_response( event.value ); 
               //console.log(resp_msg);
               this.close(); // Close websocket
               rosWS = undefined; // Decostruct websocket 
               respFlag = true;
               randStrGen.removeCached( uniqueID ); //Remove the uniqueID so it can be reused
               sendResponse( resp_msg ); //Return response to client
               console.log("[face-detection]: Returning to client");
             }
           }
           catch(e){
             rosbridge_connection = false;
             console.error('[face-detection] ---> ERROR: Cannot open websocket' + 
               'to rosbridge --> [ws//localhost:9090]' );
             Fs.rm_file_sync(file_uri_new);
             console.log(e);
             var resp_msg = craft_error_response(); 
             sendResponse( resp_msg ); 
             console.log("[face-detection]: Returning to client with error");
             return;
           }

         }
         /*--------------------------------------------------------*/
         asyncWrap(); // Recall timeout function
         
       }, timer_tick_value); //Timeout value is set at 100 ms.
     }
     asyncWrap();
/*==============================================================================================*/
   }, this ); 
};


/*!
 * @brief Crafts the form/format for the message to be returned
 * @param rosbridge_msg Return message from ROS Service.
 * return Message to be returned from service.
 */
function craft_response(rosbridge_msg)
{
  var msg = JSON.parse(rosbridge_msg);
  var faces_up_left = msg.values.faces_up_left
  var faces_down_right = msg.values.faces_down_right;
  var call_result = msg.result;
  var error = msg.values.error;

  var crafted_msg = { faces_up_left:[], faces_down_right:[], error: '' };
  
  if (call_result)
  {
    for (var ii = 0; ii < faces_up_left.length; ii++)
    {
      crafted_msg.faces_up_left.push( faces_up_left[ii].point )
    }
    for (var ii = 0; ii < faces_down_right.length; ii++)
    {
      crafted_msg.faces_down_right.push( faces_down_right[ii].point )
    }   
    crafted_msg.error = error; 
  }
  else{
    crafted_msg.error = "RAPP Platform Failure";
  }
 
  //console.log(craftedMsg);
  return JSON.stringify(crafted_msg)
};


/*!
 * @brief Crafts response message on Platform Failure
 */
function craft_error_response()
{
  // Add here to be returned literal
  var crafted_msg = {faces_up_left: [], faces_down_right: [], error: 'RAPP Platform Failure'};
  return JSON.stringify(crafted_msg);
}


/*!
 * @brief Crafts ready to send, rosbridge message.
 *   Can be used by any service!!!!
 */
function craft_rosbridge_msg(args, service_name, id){

  var rosbrige_msg = {
    'op': 'call_service',
    'service': service_name,
    'args': args,
    'id': id
  };

  return rosbrige_msg;
}


