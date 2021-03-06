#!/usr/bin/env python
# -*- coding: utf-8 -*-

#Copyright 2015 RAPP

#Licensed under the Apache License, Version 2.0 (the "License");
#you may not use this file except in compliance with the License.
#You may obtain a copy of the License at

    #http://www.apache.org/licenses/LICENSE-2.0

#Unless required by applicable law or agreed to in writing, software
#distributed under the License is distributed on an "AS IS" BASIS,
#WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#See the License for the specific language governing permissions and
#limitations under the License.

PKG='rapp_speech_detection_google'

import sys
import unittest
import rospy
import rospkg

from rapp_platform_ros_communications.srv import (
  SpeechToTextSrv,
  SpeechToTextSrvRequest
  )

## @class SpeechToTextFunc
# Inherits the unittest.TestCase class in order to offer functional tests functionality
class SpeechToTextFunc(unittest.TestCase):

    ## Tests Google ASR with a NAO captured wav file, 1 channel. Should return yes and no
    def test_wavFile(self):
        rospack = rospkg.RosPack()
        google_service = rospy.get_param(\
                "rapp_speech_detection_google_detect_speech_topic")
        rospy.wait_for_service(google_service)
        stt_service = rospy.ServiceProxy(google_service, SpeechToTextSrv)
        req = SpeechToTextSrvRequest()
        req.filename = rospack.get_path('rapp_testing_tools') + \
                '/test_data/yes-no.wav'
        req.audio_type = 'nao_wav_1_ch'
        req.user = 'rapp'
        req.language = 'en'
        response = stt_service(req)
        words_basic = len(response.words)

        # Check number of words
        self.assertEqual( words_basic, 2)
        self.assertEqual( 'yes' in response.words, True)
        self.assertEqual( 'no' in response.words, True)

    ## Tests Google ASR with a NAO recorded ogg file. Should return "Monday"
    # @unittest.skip("Depends on Google ASR result - Sometimes fails")
    # def test_wavFile_2(self):
        # rospack = rospkg.RosPack()
        # google_service = rospy.get_param(\
                # "rapp_speech_detection_google_detect_speech_topic")
        # rospy.wait_for_service(google_service)
        # stt_service = rospy.ServiceProxy(google_service, SpeechToTextSrv)
        # req = SpeechToTextSrvRequest()
        # req.filename = rospack.get_path('rapp_testing_tools') + \
                # '/test_data/speech_detection_samples/recording_monday.ogg'
        # req.audio_type = 'nao_ogg'
        # req.user = 'rapp'
        # req.language = 'en'
        # response = stt_service(req)
        # words_basic = len(response.words)

        # Check number of words
        # self.assertEqual( words_basic, 1)
        # self.assertEqual( 'Monday' in response.words, True)

    ## Tests Google ASR with an image. Should return nothing
    def test_imageFile(self):
        rospack = rospkg.RosPack()
        google_service = rospy.get_param(\
                "rapp_speech_detection_google_detect_speech_topic")
        rospy.wait_for_service(google_service)
        stt_service = rospy.ServiceProxy(google_service, SpeechToTextSrv)
        req = SpeechToTextSrvRequest()
        req.filename = rospack.get_path('rapp_testing_tools') + \
                '/test_data/Lenna.png'
        req.audio_type = 'nao_wav_1_ch'
        req.user = 'rapp'
        req.language = 'en'
        response = stt_service(req)
        words_basic = len(response.words)

        # Check number of words
        self.assertEqual( words_basic, 0)

        # Check number of alternatives
        self.assertEqual( len(response.alternatives), 0)

    ## Tests Google ASR with a missing file. Should return nothing
    def test_notExistentFile(self):
        rospack = rospkg.RosPack()
        google_service = rospy.get_param(\
                "rapp_speech_detection_google_detect_speech_topic")
        rospy.wait_for_service(google_service)
        stt_service = rospy.ServiceProxy(google_service, SpeechToTextSrv)
        req = SpeechToTextSrvRequest()
        req.filename = rospack.get_path('rapp_testing_tools') + \
                '/test_data/something.flac'
        req.audio_type = 'nao_wav_1_ch'
        req.user = 'rapp'
        req.language = 'en'
        response = stt_service(req)
        words_basic = len(response.words)

        # Check number of words
        self.assertEqual( words_basic, 0)

        # Check number of alternatives
        self.assertEqual( len(response.alternatives), 0)

## The main function. Initializes the Google ASR functional tests
if __name__ == '__main__':
    import rosunit
    rosunit.unitrun(PKG, 'SpeechToTextFunc', SpeechToTextFunc)














