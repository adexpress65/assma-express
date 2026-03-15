// web-mock.js
module.exports = {
  RTCView: 'div',
  RTCPeerConnection: class {},
  RTCIceCandidate: class {},
  RTCSessionDescription: class {},
  MediaStream: class {},
  MediaStreamTrack: class {},
  mediaDevices: { getUserMedia: () => Promise.resolve() },
  registerGlobals: () => {},
};