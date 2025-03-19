import { FormEvent, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface chatMessageInterface{
  senderId : string;
  text : string;
  timestamp : number;
}

const Join = () => {
  const socketRef = useRef<WebSocket | null>(null);
  // const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const peerConnectionRef = useRef<Map<string, { pc : RTCPeerConnection, dataChannel : RTCDataChannel | null }>>(new Map());
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const selectedFileRef = useRef<Map<string, File | null>>(new Map());

  const [roomMembers, setRoomMembers] = useState<string[]>([]);
  const [peerFileNames, setPeerFileNames] = useState<{[key : string] : string}>({});
  // const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [hostId, setHostId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [enterID, setEnterID] = useState(true);
  const [publicRoom, setPublicRoom] = useState(false);
  const [disRoom, setDisRoom] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<chatMessageInterface>>([]);
  const [newMessage, setNewMessage] = useState<string>("");

  const navigate = useNavigate();
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

  useEffect(() => {
    const interval = setInterval(() => {
      if (dataChannelRef.current) {
        console.log(
          `data channel state : ${dataChannelRef.current.readyState}`
        );
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:8080");
    const socket = socketRef.current;

    socket.onopen = () => {
      console.log(`connected to server 8080`);
    };

    socket.onerror = (err) => {
      console.error(`websocket error `, err);
    };

    socket.onmessage = (e) => {
      const message = JSON.parse(e.data);
      console.log(`message : ${e.data}`);
      if (message.type === "userId") {
        setUserId(message.userId);
        console.log(`set user id to ${message.userId}`);
      } else if(message.type === "new-member") {
        const { memberId } = message;
        console.log(`member ${memberId} joined!`);
        setRoomMembers(prev => [...prev, memberId]);
      } else if (message.type === "create-answer") {
        const { senderId } = message;
        const pc = peerConnectionRef.current.get(senderId)?.pc;
        pc?.setRemoteDescription(message.answer);
        setIsInRoom(true);
        console.log(
          `answer recieved and set remote description ${message.answer} for ${senderId}`
        );
      } else if (message.type === "room-members") {
        const { members } = message;
        setRoomMembers(members);

        members.forEach((memberId : string) => {
          initiatePeerConnection(memberId);
        })
      } else if (message.type === "peer-connection-offer") {
        const { senderId, offer } = message;
        handlePeerOffer(senderId, offer);
      } else if (message.type === "peer-connection-answer") {
        const { senderId, answer } = message;
        handlePeerAnswer(senderId, answer);
      } else if (message.type === "ice-candidate") {
        const { senderId, candidate} = message;
        const pc = peerConnectionRef.current.get(senderId)?.pc;
        if(!pc?.remoteDescription) {
          if(!pendingIceCandidatesRef.current.has(senderId)) {
            pendingIceCandidatesRef.current.set(senderId, [candidate]);
          } else {
            pendingIceCandidatesRef.current.get(senderId)?.push(candidate);
          }
        }
        pc?.addIceCandidate(new RTCIceCandidate(candidate)); // could be await 
        console.log(`recieved new ice candidate ${candidate} from ${senderId}`);
      } else if (message.type === "public-rooms") {
        const roomsArray = Object.entries(message.rooms).map(([id, room]) => {
          const typedRoom = room as {
            roomName: string;
            genre: string;
            isPublic: boolean;
            members: string[];
          };
          return {
            id,
            name: typedRoom.roomName,
            genre: typedRoom.genre,
            isPublic: typedRoom.isPublic,
            users: typedRoom.members.length,
          };
        });
        setDisRoom(roomsArray);
      } else if (message.type === "room-closed") {
        peerConnectionRef.current.forEach((value) => {
          value.pc?.close();
        });
        socketRef.current?.close();
        console.log("room closed");
        navigate("/");
      } else if(message.type === "disconnected") {
        const { memberId } = message;
        console.log(`${memberId} has left the room`);
        setRoomMembers(prev => prev.filter(id => id !== memberId));
        const peerConnection = peerConnectionRef.current.get(memberId);
        if(peerConnection) {
          peerConnection.pc?.close();
          peerConnectionRef.current.delete(memberId);
        }
      } else if (message.type === "chat-message") {
        const { senderId, text, timestamp} = message; 
        console.log(`${senderId} sent message : ${text}`) 
        setChatMessages(prev => [...prev, { senderId, text, timestamp }]);
      }
    };

    return () => {
      peerConnectionRef.current.forEach(value => value.pc.close());
      socketRef.current?.close();
      console.log("websocket connection disconnected");
    };
  }, []);

  const initiatePeerConnection = async (targetId : string) => {
    if(peerConnectionRef.current.has(targetId)) return;

    const pc = new RTCPeerConnection({ iceServers });

    const dataChannel = pc.createDataChannel("fileTransfer", { ordered : true });
    dataChannel.binaryType = "arraybuffer";

    setupDataChannel(dataChannel, targetId);

    peerConnectionRef.current.set(targetId, { pc, dataChannel });

    pc.onicecandidate = (e) => {
      console.log(`sending new ice candidate ${e.candidate}`);
      if (e.candidate) {
        socketRef.current?.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: e.candidate,
            targetId,
          })
        );
      }
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.send(JSON.stringify({ type: "peer-connection-offer", targetId, offer }));
      console.log(`offer sent ${JSON.stringify(offer)}`);
    } catch (err) {
      console.error(`error creating offer for ${targetId}`, err);
    }
  }

  const handlePeerOffer = async (senderId : string, offer : RTCSessionDescriptionInit) => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.ondatachannel = (event) => {
      const dataChannel = event.channel;
      dataChannel.binaryType = "arraybuffer";
      setupDataChannel(dataChannel, senderId);
      peerConnectionRef.current.set(senderId, { pc, dataChannel });
    }

    pc.onicecandidate = (e) => {
      console.log(`sending new ice candidate ${e.candidate} to ${senderId}`);
      if (e.candidate) {
        socketRef.current?.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: e.candidate,
            targetId: senderId,
          })
        );
      }
    };

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.send(JSON.stringify({ type : "peer-connection-answer", targetId : senderId, answer}));
    } catch(err) {
      console.error(`error creating offer for ${senderId}`, err);
    }
  }

  const handlePeerAnswer = async (senderId : string, answer : RTCSessionDescriptionInit) => {
    const connection = peerConnectionRef.current.get(senderId);
    if(connection?.pc) {
      try {
        await connection.pc.setRemoteDescription(answer);
        const pendingCandidates = pendingIceCandidatesRef.current.get(senderId) || [];
        pendingCandidates.forEach(async (candidate) => {
          await connection.pc.addIceCandidate(candidate)
        });
        pendingIceCandidatesRef.current.delete(senderId);
      } catch(err) {
        console.error(`error setting remote description for ${senderId}`, err);
      }
    }
  }

  const handleJoinRoom = async (e: FormEvent) => {
    e.preventDefault();
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    const pc = new RTCPeerConnection({ iceServers });
    // peerConnectionRef.current = new RTCPeerConnection({ iceServers });
    // const pc = peerConnectionRef.current;

    const dataChannel = pc.createDataChannel("fileTransfer", { ordered: true });
    dataChannel.binaryType = "arraybuffer";
    dataChannelRef.current = dataChannel;

    peerConnectionRef.current.set(hostId, { pc, dataChannel});

    dataChannel.onopen = () => {
      console.log("data channel opened");
    };

    let recievedBuffers: ArrayBuffer[] = [];
    let recievedBytes = 0;

    dataChannel.onmessage = (ev) => {
      if (typeof ev.data === "string" && ev.data === "EOF") {
        const blob = new Blob(recievedBuffers);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "received_file";
        a.click();
        recievedBuffers = [];
        recievedBytes = 0;
        console.log("File transfer complete");
      } else if (ev.data instanceof ArrayBuffer) {
        recievedBuffers.push(ev.data);
        recievedBytes += ev.data.byteLength;
        console.log(
          `Received chunk (${ev.data.byteLength} bytes) Total: ${recievedBytes}`
        );
      }
    };

    dataChannel.onerror = (err) => {
      console.error("data channel error : ", err);
    };

    pc.onicecandidate = (e) => {
      console.log(`sending new ice candidate ${e.candidate}`);
      if (e.candidate) {
        socket.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: e.candidate,
            targetId: hostId,
          })
        );
      }
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.send(JSON.stringify({ type: "join-room", targetId : hostId, offer }));
      console.log(`offer sent ${JSON.stringify(offer)} to ${hostId}`);
    } catch (err) {
      console.error("error creating offer", err);
    }
  };

  const setupDataChannel = (dataChannel : RTCDataChannel, peerId : string) => {
    dataChannel.onopen = () => {
      console.log(`data channel opened with peer ${peerId}`);
    };

    let recievedBuffers: ArrayBuffer[] = [];
    let recievedBytes = 0;

    dataChannel.onmessage = (ev) => {
      if (typeof ev.data === "string" && ev.data === "EOF") {
        const blob = new Blob(recievedBuffers);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `file from ${peerId}`;
        a.click();
        recievedBuffers = [];
        recievedBytes = 0;
        console.log("File transfer complete");
      } else if (ev.data instanceof ArrayBuffer) {
        recievedBuffers.push(ev.data);
        recievedBytes += ev.data.byteLength;
        console.log(
          `Received chunk (${ev.data.byteLength} bytes) Total: ${recievedBytes}`
        );
      }
    };
  }
  
  const sendFileToPeer = (peerId : string) => {
    const connection = peerConnectionRef.current.get(peerId);
    if(!connection?.dataChannel) {
      console.error(`no data channel for ${peerId}`);
      return;
    }
    const dataChannel = connection.dataChannel;
    const file = selectedFileRef.current.get(peerId);
    if(!file) {
      alert("pls select a file");
      return;
    }
    if(dataChannel.readyState === "open") {
      sendFileOverChannel(file, dataChannel);
    } else {
      alert("data Channel not ready yet");
    }
  }

  const sendFileOverChannel = (file: File, dataChannel: RTCDataChannel) => {
    const CHUNK_SIZE = 16 * 1024;
    let offset = 0;
    const reader = new FileReader();

    reader.onload = (e) => {
      if (e.target?.readyState !== FileReader.DONE) return;
      dataChannel.send(e.target.result as ArrayBuffer);
      offset += (e.target.result as ArrayBuffer).byteLength;
      if (offset < file.size) {
        readSlice(offset);
      } else {
        dataChannel.send("EOF");
        console.log("file transfer complete");
      }
    };

    const readSlice = (offset: number) => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };
    readSlice(0);
  };

  const handleSelectFile = (peerId : string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files ? input.files[0] : null;
      if (!file) return;
      selectedFileRef.current.set(peerId, file);
      setPeerFileNames(prev => ({...prev, [peerId] : file.name }));
      console.log(`file selected ${file.name} for ${peerId}`);
    };
    input.click();
  };

  const handleSendFile = (peerId : string) => {
    const dataChannel = dataChannelRef.current;
    if (!dataChannel) {
      console.log(`data channel doesnt exist yet to send files`);
      //create data channel here if it doesnt exist aldready
      return;
    }
    const file = selectedFileRef.current.get(peerId);
    if (!file) {
      alert("select a file first");
      return;
    }
    if (dataChannel.readyState === "open") {
      sendFileOverChannel(file, dataChannel);
    } else {
      dataChannel.onopen = () => {
        sendFileOverChannel(file, dataChannel);
      };
    }
  };

  const enterRoomID = () => {
    setEnterID(true);
    setPublicRoom(false);
  };

  const showPublicRoom = () => {
    setPublicRoom(true);
    setEnterID(false);

    const socket = socketRef.current;
    if (!socket) return;
    socket.send(JSON.stringify({ type: "public-rooms" }));
  };

  const joinRoom = (roomId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setHostId(roomId);

    setEnterID(true);
    setPublicRoom(false); 
  };

  const handleLeaveRoom = () => {
    navigate("/");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("copied to clipboard");
      })
      .catch((err) => {
        console.error("failed to copy", err);
        alert("failed to copy to clipboard");
      });
  };

  const sendMessage = () => {
    if(newMessage.trim() && socketRef.current) {
      const servSock = socketRef.current;
      servSock.send(JSON.stringify({ type : "chat-message", text : newMessage.trim() }));
    }
    setNewMessage("");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-100">
      {!isInRoom && (
        <div className="flex w-[25rem] max-w-md mb-6">
          <button
            className={`w-full p-2 text-lg transition ${
              enterID ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={enterRoomID}
          >
            Enter Room ID
          </button>
          <button
            className={`w-full p-2 text-lg transition ${
              publicRoom ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={showPublicRoom}
          >
            Public Rooms
          </button>
        </div>
      )}
      {/* Join Room Form */}
      {enterID && !isInRoom && (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
          <form className="flex flex-col space-y-4" onSubmit={handleJoinRoom}>
            <input
              type="text"
              placeholder="Enter host ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              required
            />
            <button
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isInRoom}
            >
              {isInRoom ? "Joined" : "Join Room"}
            </button>
          </form>
        </div>
      )}
      {/* Display Public Rooms */}
      {publicRoom && !isInRoom && (
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6">
          <table className="w-full border-collapse border border-gray-300 mt-4">
            <thead>
              <tr className="bg-gray-200">
                <th className="border p-2">Room Name</th>
                <th className="border p-2">Genre</th>
                <th className="border p-2">Users</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {disRoom.length > 0 ? (
                disRoom.map((room) => {
                  if (!room.isPublic) return null;
                  return (
                    <tr key={room.id} className="text-center">
                      <td className="border p-2">{room.name}</td>
                      <td className="border p-2">{room.genre}</td>
                      <td className="border p-2">{room.users + 1}</td>
                      <td className="border p-2">
                        <button
                          className="bg-blue-500 text-white p-2 w-[4rem] rounded-md"
                          onClick={(e) => joinRoom(room.id, e)}
                        >
                          Join
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="border p-2 text-center">
                    No public rooms available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Room Information */}
      {isInRoom && (
        <>
          <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Room Information</h2>
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600">Host ID:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-blue-600">{hostId}</span>
                  <button
                    onClick={() => copyToClipboard(hostId)}
                    className="p-1.5 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                    title="Copy Host ID"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-blue-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600">Your ID:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-green-600">{userId}</span>
                  <button
                    onClick={() => copyToClipboard(userId)}
                    className="p-1.5 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                    title="Copy Your ID"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-green-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
  
            {/* Connection Status */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Connection Status:</span>
                <span
                  className={`font-medium ${
                    dataChannelRef.current?.readyState === "open"
                      ? "text-green-500"
                      : "text-yellow-500"
                  }`}
                >
                  {dataChannelRef.current?.readyState === "open"
                    ? "Connected"
                    : "Connecting..."}
                </span>
              </div>
            </div>
            
            {/* Host File Transfer Section */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-xl font-semibold mb-4">Send File to Host</h3>
              <div className="space-y-4">
                <button
                  onClick={() => handleSelectFile(hostId)}
                  className="w-full px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  Choose File
                </button>
                {peerFileNames[hostId] && (
                  <div className="text-sm text-gray-600">
                    Selected: {peerFileNames[hostId]}
                  </div>
                )}
                <button
                  onClick={() => handleSendFile(hostId)}
                  className="w-full py-2.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  disabled={!peerFileNames[hostId]}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Send File to Host
                </button>
              </div>
            </div>
  
            {/* Leave Room Button */}
            <button
              onClick={handleLeaveRoom}
              className="w-full mt-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              Leave Room
            </button>
          </div>
  
          {/* Room Members Section */}
          {roomMembers.length > 0 && (
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4">Room Members</h2>
              <div className="space-y-4">
                {roomMembers.map((memberId) => (
                  memberId !== userId && memberId !== hostId && (
                    <div key={memberId} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-blue-500"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <span className="font-mono text-sm text-gray-700">{memberId}</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 space-y-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSelectFile(memberId)}
                            className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex-1"
                          >
                            Select File
                          </button>
                          <button
                            onClick={() => sendFileToPeer(memberId)}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 flex-1"
                            disabled={!peerFileNames[memberId]}
                          >
                            Send File
                          </button>
                        </div>
                        {peerFileNames[memberId] && (
                          <p className="text-sm text-gray-600">
                            Selected: {peerFileNames[memberId]}
                          </p>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          <span className={`${
                            peerConnectionRef.current.get(memberId)?.dataChannel?.readyState === "open"
                              ? "text-green-500"
                              : "text-yellow-500"
                          }`}>
                            {peerConnectionRef.current.get(memberId)?.dataChannel?.readyState === "open"
                              ? "Connected"
                              : "Connecting..."}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
  
          {/* Chat Section */}
          <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Chat</h2>
            
            <div className="h-48 overflow-y-auto mb-4 border rounded-lg p-3 bg-gray-50">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`mb-3 ${msg.senderId === userId ? 'text-right' : ''}`}>
                  <div className={`inline-block p-2 rounded-lg ${msg.senderId === userId ? 'bg-blue-100' : 'bg-green-100'}`}>
                    <p className="text-sm text-gray-600">
                      {msg.senderId === userId ? "You" : 
                      msg.senderId === hostId ? "Host" : msg.senderId}
                    </p>
                    <p className="text-gray-800">{msg.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
  
      {/* Back Button */}
      {!isInRoom && (
        <button
          onClick={handleLeaveRoom}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          ← Back to Home
        </button>
      )}
    </div>
  );    
};

export default Join;
