// getting dom elements
const divSelectRoom = document.getElementById("selectRoom");
const divConsultingRoom = document.getElementById("consultingRoom");
const inputName = document.getElementById("name");
const btnJoinBroadcaster = document.getElementById("joinBroadcaster");
const btnJoinViewer = document.getElementById("joinViewer");
const videoElement = document.querySelector("video");
const shareableLinkElement = document.getElementById("shareable-link");
const broadcasterName = document.getElementById("broadcasterName");
const viewers = document.getElementById("viewers");

// variables
let isBrodcaster = window.location.pathname === '/';
let user;
let rtcPeerConnections = {};

// constants
const iceServers = {
  // iceServers: [
  //   { urls: "stun:stun.services.mozilla.com" },
  //   { urls: "stun:stun.l.google.com:19302" },
  // ],
  iceServers: [{
    urls: [ "stun:ss-turn2.xirsys.com" ]
 }, {
    username: "43EP--ehcvHzvwYQryGDdBGJ17Hro5R1hYwyjbT_6bTG8Lpazh2spouAhAqG5hTKAAAAAGJWnLNBYnVsS2FsYW1BWg==",
    credential: "09621b34-bb0f-11ec-9d43-0242ac140004",
    urls: [
        "turn:ss-turn2.xirsys.com:80?transport=udp",
        "turn:ss-turn2.xirsys.com:3478?transport=udp",
        "turn:ss-turn2.xirsys.com:80?transport=tcp",
        "turn:ss-turn2.xirsys.com:3478?transport=tcp",
        "turns:ss-turn2.xirsys.com:443?transport=tcp",
        "turns:ss-turn2.xirsys.com:5349?transport=tcp"
    ]
 }]
 
 
};

// random room number

const roomNumber = getRoomNumber();


// share info

const shareableLink = `${window.location.origin}/room/${roomNumber}`;

// constraints

const streamConstraints = { audio: true, video: { height: 480 } };


// Let's do this 💪
var socket = io();

// Managing buttons

btnJoinBroadcaster.style.display = isBrodcaster ? 'block' : 'none';
btnJoinViewer.style.display = isBrodcaster ? 'none' : 'block';
videoElement.muted = isBrodcaster;

shareableLinkElement.innerText = shareableLink;

// Handling join brodcaster buttons

btnJoinBroadcaster.onclick = function () {
  if (inputName.value === "") {
    alert("Please insert your name");
  } else {
    user = {
      room: roomNumber,
      name: inputName.value,
    };

    divSelectRoom.style = "display: none;";
    divConsultingRoom.style = "display: block;";
    broadcasterName.innerText = user.name + " is streaming...";

    navigator.mediaDevices
      .getUserMedia(streamConstraints)
      .then(function (stream) {
        videoElement.srcObject = stream;
        socket.emit("register as broadcaster", user.room);
      })
      .catch(function (err) {
        console.log("An error ocurred when accessing media devices", err);
      });
  }
};


// handling join viewer button

btnJoinViewer.onclick = function () {
  if (inputName.value === "") {
    alert("Please insert your name");
  } else {
    user = {
      room: roomNumber,
      name: inputName.value,
    };

    divSelectRoom.style = "display: none;";
    divConsultingRoom.style = "display: block;";

    socket.emit("register as viewer", user);
  }
};

// message handlers
socket.on("new viewer", function (viewer) {
  console.log(viewer);
  rtcPeerConnections[viewer.id] = new RTCPeerConnection(iceServers);

  const stream = videoElement.srcObject;
  stream
    .getTracks()
    .forEach((track) => rtcPeerConnections[viewer.id].addTrack(track, stream));

  rtcPeerConnections[viewer.id].onicecandidate = (event) => {
    if (event.candidate) {
      console.log("sending ice candidate");
      socket.emit("candidate", viewer.id, {
        type: "candidate",
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      });
    }
  };

  rtcPeerConnections[viewer.id]
    .createOffer()
    .then((sessionDescription) => {
      rtcPeerConnections[viewer.id].setLocalDescription(sessionDescription);
      socket.emit("offer", viewer.id, {
        type: "offer",
        sdp: sessionDescription,
        broadcaster: user,
      });
    })
    .catch((error) => {
      console.log(error);
    });

  let li = document.createElement("li");
  li.innerText = viewer.name + " has joined";
  viewers.appendChild(li);
});

socket.on("candidate", function (id, event) {
  var candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate,
  });
  rtcPeerConnections[id].addIceCandidate(candidate);
});

socket.on("offer", function (broadcaster, sdp) {
  broadcasterName.innerText = broadcaster.name + " is streaming...";

  rtcPeerConnections[broadcaster.id] = new RTCPeerConnection(iceServers);

  rtcPeerConnections[broadcaster.id].setRemoteDescription(sdp);

  rtcPeerConnections[broadcaster.id]
    .createAnswer()
    .then((sessionDescription) => {
      rtcPeerConnections[broadcaster.id].setLocalDescription(
        sessionDescription
      );
      socket.emit("answer", {
        type: "answer",
        sdp: sessionDescription,
        room: user.room,
      });
    });

  rtcPeerConnections[broadcaster.id].ontrack = (event) => {
    console.log(event);
    videoElement.srcObject = event.streams[0];
  };

  rtcPeerConnections[broadcaster.id].onicecandidate = (event) => {
    if (event.candidate) {
      console.log("sending ice candidate");
      socket.emit("candidate", broadcaster.id, {
        type: "candidate",
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      });
    }
  };
});

socket.on("answer", function (viewerId, event) {
  rtcPeerConnections[viewerId].setRemoteDescription(
    new RTCSessionDescription(event)
  );
});


function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function getRoomNumber() {
  if(isBrodcaster) {
    return randomNumber(1000, 9999)
  } else {
    return window.location.pathname.split('/')[2];
  }
}