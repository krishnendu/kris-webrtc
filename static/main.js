//urls: ['stun:192.168.88.150', 'stun:stun2.l.google.com:19302','turn:numb.viagenie.ca'],
const servers = {
  iceServers: [
    {
        urls: 'turn:numb.viagenie.ca',
        username: 'krishnendu@bhawan.co.in',
        credential: 'bppimt'
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
const pc = new RTCPeerConnection(servers);
//window.pc=pc;
let localStream = null;
let remoteStream = null;
let facingMode='user';
let audioEnabled=true;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');
const room_id=location.pathname.slice(1)+'_';
const toggleVideo=document.getElementById('toggleVideo');
const toggleAudio=document.getElementById('toggleAudio');
const toggleCamera=document.getElementById('toggleCamera');
// const div=document.getElementById('consolediv');
// 1. Setup media sources
async function toggleAud(){
  audioEnabled=!audioEnabled;
  localStream.getAudioTracks()[0].enabled=audioEnabled;
}
async function toggleVid(){
  if(document.getElementById('webcamVideo').srcObject.getTracks()[0].readyState!=="live"){
    const videoStream = await navigator.mediaDevices.getUserMedia({ 
       video: {facingMode: facingMode}
    });
    let sender = await pc.getSenders().find(function(s) {
      return s.track.kind == 'video';
    });
    const videoTrack=videoStream.getVideoTracks()[0];
    //console.log('found sender:', sender);
    sender.replaceTrack(videoTrack);
    webcamVideo.srcObject = await navigator.mediaDevices.getUserMedia({ 
      video: {facingMode: facingMode},
      audio: false, 
    });
  }
  else{
    let sender = await pc.getSenders().find(function(s) {
      return s.track.kind == 'video';
    });
    await sender.track.stop();
    await webcamVideo.srcObject.getVideoTracks()[0].stop();
  }
}

toggleVideo.addEventListener('click', toggleVid);
toggleAudio.addEventListener('click', toggleAud);

webcamButton.onclick = async () => {
  toggleVideo.disabled=false;
  toggleAudio.disabled=false;
  toggleCamera.disabled=false;
  
  // let currentCam=0;
  let devices=await navigator.mediaDevices.enumerateDevices();
  const videoDevices=await devices.filter(d =>d.kind=='videoinput');
  // div.innerText+=videoDevices+'\n';
  if(videoDevices.length<=1){
    toggleCamera.style.display='none';
  }
  else{
    toggleCamera.addEventListener('click', switchCamera);
  }
  async function switchCamera(){
    facingMode=facingMode==='user'?'environment':'user';
    const videoStream = await navigator.mediaDevices.getUserMedia({ 
       video: {facingMode: facingMode}
    });
    let sender = await pc.getSenders().find(function(s) {
      return s.track.kind == 'video';
    });
    const videoTrack=videoStream.getVideoTracks()[0];
    //console.log('found sender:', sender);
    sender.replaceTrack(videoTrack);
    webcamVideo.srcObject = await navigator.mediaDevices.getUserMedia({ 
      video: {facingMode: facingMode},
      audio: false, 
    });
    
//     currentCam+=1;
//     currentCam=currentCam%videoDevices.length;
//     localStream = await navigator.mediaDevices.getUserMedia({ 
//         video: {deviceId: videoDevices[currentCam].deviceId},
//         audio: {'echoCancellation': true}, 
//     });
    
//     webcamVideo.srcObject = await navigator.mediaDevices.getUserMedia({ 
//     video: {deviceId: videoDevices[currentCam].deviceId},
//     audio: false, 
//   });
//     div.innerText+=currentCam+'\n';
  }
  localStream = await navigator.mediaDevices.getUserMedia({ 
        video: {facingMode: facingMode},
        audio: {'echoCancellation': true}, 
    });
  // localStream = await navigator.mediaDevices.getUserMedia({ 
  //       video: {deviceId: videoDevices[currentCam].deviceId},
  //       audio: {'echoCancellation': true}, 
  //   });
  
  remoteStream = new MediaStream();
  
  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = await navigator.mediaDevices.getUserMedia({ 
    video: {facingMode: facingMode},
    audio: false, 
  });
  // webcamVideo.srcObject = await navigator.mediaDevices.getUserMedia({ 
  //   video: {deviceId: videoDevices[currentCam].deviceId},
  //   audio: false, 
  // });
  remoteVideo.srcObject = remoteStream;
  
  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};
var socket = io();
callInput.value=location.pathname.slice(1);
// 2. Create an offer
callButton.addEventListener('click', async function() {
  answerButton.disabled=true;
    pc.onicecandidate = (event) => {
      console.log('Ice Candidate Fetched');
        event.candidate && socket.emit(room_id+'offer_ice',event.candidate);
    };

    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };
    await socket.emit(room_id+'new_offer',offer);

    // Listen for remote answer
    socket.on(room_id+'offer', function(msg) {
        const data= (msg);
        if (!pc.currentRemoteDescription && data) {
            const answerDescription = new RTCSessionDescription(data);
            pc.setRemoteDescription(answerDescription);
        }
        console.log("Offer Received");
    });

    // When answered, add candidate to peer connection
    socket.on(room_id+'answer_ice', function(msg) {
        const data = (msg);
        pc.addIceCandidate( new RTCIceCandidate(data));
        console.log("Answer Ice Received");
    });
    
    hangupButton.disabled = false;
});

// 3. Answer the call with the unique ID
answerButton.addEventListener('click', async function() {
  callButton.disabled = true;
    pc.onicecandidate = (event) => {
        console.log('Ice Candidate Fetched');
        event.candidate && socket.emit(room_id+'answer_ice',event.candidate);
    };
    
    await socket.on(room_id+'new_offer', async function(msg) {
        console.log("New Offer Received");
        const  offerDescription=await (msg);
        await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };
        //console.log('Answer : ',answer);
        await socket.emit(room_id+'offer',answer);
    });
      try{
        const  offerDescription=await (await fetch(window.location.href+'/new-offer/')).json();
        console.log("New Offer Received");
        if(offerDescription)
        await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };
        //console.log('Answer : ',answer);
        await socket.emit(room_id+'offer',answer);
      }
      catch(error){
        //console.log(error.message);
      }



    socket.on(room_id+'offer_ice', function(msg) {
        const data = (msg);
        pc.addIceCandidate(new RTCIceCandidate(data));
        console.log("Offer Ice Received");
    });
});
