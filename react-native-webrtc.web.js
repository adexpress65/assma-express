// react-native-webrtc.web.js
import { View } from 'react-native';
export const RTCView = View;
export const RTCPeerConnection = class {};
export const RTCIceCandidate = class {};
export const RTCSessionDescription = class {};
export const MediaStream = class {};
export const MediaStreamTrack = class {};
export const mediaDevices = { 
    getUserMedia: () => Promise.resolve(new MediaStream()),
    enumerateDevices: () => Promise.resolve([]) 
};
export const registerGlobals = () => {};
export default {
    RTCView,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    MediaStream,
    MediaStreamTrack,
    mediaDevices,
    registerGlobals
};