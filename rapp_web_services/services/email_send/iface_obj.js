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


var clientRes = function( ){
  var obj = {
    error: ''
  };
  return obj;
};


var clientReq = function( )
{
  var obj = {
    file_uri: '',
    email: '',
    passwd: '',
    server: '',
    port: '',
    recipients: [],
    body: '',
    subject: ''
  };
  return obj;
};


var rosReq = function( )
{
  var obj = {
    files: [],
    userEmail: '',
    password: '',
    server: '',
    port: '',
    recipients: [],
    body: '',
    subject: ''
  };
  return obj;
};


var rosRes = function(){
  var obj = {
    status: 0
  };
  return obj;
};

exports.client_res = clientRes;
exports.client_req = clientReq;
exports.ros_req = rosReq;
exports.ros_res = rosRes;
