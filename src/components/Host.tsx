import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation, data } from 'react-router-dom'
import { useWebSocket } from './WebSocketContext';

const Host = () => {
    const location = useLocation();
    const socketRef = useWebSocket()
    const peerConnectionsRef = useRef<Map<string, { pc : RTCPeerConnection, dataChannel : RTCDataChannel | null }>>(new Map())
    const selectedFilesRef = useRef<Map<string, File>>(new Map()) 
    const [members, setMembers] = useState<Array<string>>([])
    const [selectedFileNames, setSelectedFileNames] = useState<{ [key : string] : string }>({})
    const [SearchParams] = useSearchParams()
    const dataChannelRef = useRef<RTCDataChannel | null>(null); // Define the ref for DataChannel

    const navigate = useNavigate()
    const iceServers = [
        {
            urls: "stun:stun.l.google.com:19302",
        }
    ];
    const hostId = SearchParams.get('roomId') || ""
    const userId = useLocation().state?.userId || hostId
    console.log("Socket readyState:", socketRef?.readyState);

    useEffect(() => {
        if (!socketRef || !hostId) return;

        const requestUsers = () => {
            socketRef.send(JSON.stringify({ type: "request-users", roomId: hostId }));
        };

        const handleUserList = (event: any) => {
            const message = JSON.parse(event.data);
            if (message.type === "user-list") {
                setMembers(message.members || []);
                console.log(message.members)
            }
        };

        requestUsers();

        socketRef.addEventListener("message", handleUserList);

        return () => {
            socketRef.removeEventListener("message", handleUserList);
        };
    }, [socketRef, hostId]); 


    useEffect(() => {
        if (hostId) {
            setMembers((prevMembers) => {
                if (!prevMembers.includes(hostId)) {
                    return [...prevMembers, hostId];
                }
                return prevMembers;
            });
            members.forEach((id)=>{
                console.log(id);
            })
        }
    }, [hostId]); 
    
    useEffect(() => {
        if(!socketRef || socketRef.readyState === WebSocket.CLOSED) {
            return;
        }
        // implement join room
        if(socketRef.readyState === WebSocket.OPEN){
            socketRef.send(JSON.stringify({ type: "join-room", roomId: hostId, memberId: userId }));
        }
        console.log(`${hostId} is the host id and ${userId} is the user id`)
        
        socketRef.onerror = (err) => {
            console.error('websocket error', err)
         }

        const handleMessage = async (e: MessageEvent) => {
            const message = JSON.parse(e.data)
            console.log(`message : ${e.data}`)
            if(message.type === 'new-member'){
                handleJoinRoom(message)
            } else if (message.type === 'received-offer') {
                const offer = message.offer
                const memberId = message.memberId   // new joiner
                const senderId = message.senderId   // existing members
                setMembers((prevMembers) => {
                    if(!prevMembers.includes(memberId)){
                        return [...prevMembers, memberId]
                    }
                    return prevMembers
                })
                if(peerConnectionsRef.current.has(memberId)){
                    await peerConnectionsRef.current.get(memberId)?.pc.setRemoteDescription(message.offer);
                    return;
                }
                const hostId = message.roomId

                // Create a new PeerConnection
                const pc = new RTCPeerConnection({ iceServers });
                await pc.setRemoteDescription(message.offer);

                // Handle Data Channel
                pc.ondatachannel = (event) => {
                    const dataChannel = event.channel;
                    dataChannel.binaryType = "arraybuffer";
                    console.log("Reaching the pc.ondatachannel state")
                    //peerConnectionsRef.current.set(senderId, { pc, dataChannel });      // new member receiving offer , data channel established with sender

                    dataChannel.onopen = () => {
                        console.log(`Data Channel open for member ${senderId}`);
                    };

                    let receivedBuffers: ArrayBuffer[] = [];
                    let receivedBytes = 0;
                    dataChannel.onmessage = (ev) => {
                        if (typeof ev.data === "string" && ev.data === "EOF") {
                            // When EOF is received, merge all chunks and create a Blob for download
                            const blob = new Blob(receivedBuffers);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `file_from_${senderId}`;
                            a.click();
                            receivedBuffers = [];
                            receivedBytes = 0;
                            console.log("File transfer complete");
                        } else if (ev.data instanceof ArrayBuffer) {
                            receivedBuffers.push(ev.data);
                            receivedBytes += ev.data.byteLength;
                            console.log(`Received chunk (${ev.data.byteLength} bytes), Total: ${receivedBytes}`);
                        }
                    };

                    console.log(`${senderId} data channel created and the channel is ${dataChannel} with peerconnection ${pc}`)
                    // Store connection and data channel
                    peerConnectionsRef.current.set(senderId, { pc, dataChannel });      
                };

                // Handle ICE Candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log(`Sending ICE candidate to ${senderId}`);
                        socketRef.send(JSON.stringify({
                            type: "ice-candidate",
                            candidate: event.candidate,
                            targetId: senderId,
                            roomId: hostId,
                            senderId: memberId
                        }));
                    }else{
                        console.log("All ice candidates sent.")
                    }
                };

                try {                   

                    // Create Answer
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    // Send Answer to the Sender
                    socketRef.send(JSON.stringify({
                        type: 'send-answer',
                        answer: answer,
                        targetId: senderId,
                        senderId: memberId,
                        roomId: hostId
                    }));

                    console.log(`Sent answer from ${memberId} to ${senderId}`);
                } catch (err) {
                    console.error("Error in processing offer:", err);
                }
                
            } else if (message.type === 'received-answer') {
                // new member receives this
                console.log(`Received answer from ${message.senderId}`)
//                console.log(peerConnectionsRef.current.keys());
                console.log(`${userId} is the user id and ${message.senderId} is the sender id`)
                const senderId = message.senderId;
                
                const pc = peerConnectionsRef.current.get(senderId)?.pc
                if (pc) {
                    try {
                            await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                            console.log(`✅ Set remote description for ${userId} from ${message.senderId}`);
                        
                        
                        // Update members state if this member is not already added
                        setMembers((prevMembers) => {
                            if (!prevMembers.includes(senderId)) {
                                return [...prevMembers, senderId];
                            }
                            return prevMembers;
                        });
                    } catch (err) {
                        console.error("Error setting remote description:", err)
                    }
                }else{
                    console.log("pc does not exist")
                }
            } else if(message.type === 'ice-candidate' && message.candidate) {
                try {
                    const candidate = new RTCIceCandidate(message.candidate);
                    console.log(`All the current peerconnections are `)
                    console.log(peerConnectionsRef.current.keys());
                    const pc = peerConnectionsRef.current.get(message.senderId)?.pc;
                    if (!pc) {
                        console.warn("Peer connection not found for:", message.senderId);       // this
                        return;
                    }
                    await pc.addIceCandidate(candidate);
                    console.log("Added ICE candidate:", candidate);
                } catch (err) {
                    console.error("Error adding received ICE candidate", err);
                }
            } else if(message.type === 'disconnected') {
                const { memberId } = message
                peerConnectionsRef.current.get(memberId)?.pc?.close()
                peerConnectionsRef.current.delete(memberId)
                setMembers(prev => prev.filter(member => member !== memberId))
            }
        }
        socketRef.addEventListener('message', handleMessage);
        

        socketRef.onclose = () => {
            console.log('websocket connection closed')
        }

        return () => {
            socketRef.removeEventListener('message', handleMessage)
            const pcs = peerConnectionsRef.current
            pcs?.forEach(({ pc }) => {
                pc.close()
            })
            pcs?.clear()
            socketRef.removeEventListener('open', handleJoinRoom)
            
            socketRef?.close()
            if (socketRef.readyState === WebSocket.OPEN) {
                socketRef.close();
            }
            setMembers([])
            console.log(`websocket disconnected`)
        }
    }, [socketRef, hostId])

    
    const handleJoinRoom = async (message: any) => {
        const memberId = message.memberId;  // new member
        if (peerConnectionsRef.current.has(memberId)) {
            console.log(`Skipping duplicate connection for ${memberId}`);
            return;
        }
        console.log(`new member is ${memberId}`)
        const hostId = message.roomId;
        const socket = socketRef;
        if (!socket) {
            return;
        }
        if (!peerConnectionsRef.current) {
            peerConnectionsRef.current = new Map();
        }
        const pc = new RTCPeerConnection({ iceServers })

        const dataChannel = pc.createDataChannel("fileTransfer", { ordered: true });
        dataChannel.binaryType = "arraybuffer";
        dataChannelRef.current = dataChannel;

        setInterval(() => {
            console.log(`DataChannel State: ${dataChannel.readyState}`);
        }, 1000);

        dataChannel.onopen = () => {
            console.log("data channel opened");
        };
        peerConnectionsRef.current.set(memberId, {pc, dataChannel})
        console.log(`peerconnectionsRef: ${peerConnectionsRef.current.keys()}`)
        console.log(peerConnectionsRef.current.keys());


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
                    targetId: memberId,
                    senderId: userId,
                    roomId: hostId,
                })
                );
            } else {
                console.log("All ice candidates sent")
            }
        };
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.send(JSON.stringify({ type: "send-offer", senderId: userId, roomId: hostId, receiverId: memberId, offer: offer }));
            console.log(`offer sent from ${userId} to ${memberId} in room ${hostId}`);
        } catch (err) {
            console.error("error creating offer", err);
        }
    };


    const sendFileOverChannel = (file : File, dataChannel : RTCDataChannel) => {
        const CHUNK_SIZE = 16 * 1024
        let offset = 0
        const reader = new FileReader()

        reader.onload = e => {
            if(e.target?.readyState !== FileReader.DONE) return
            dataChannel.send(e.target.result as ArrayBuffer)
            offset += (e.target.result as ArrayBuffer).byteLength
            if(offset < file.size) {
                readSlice(offset)
            } else {
                dataChannel.send("EOF")
                console.log('file transfer complete')
            }
        }

        const readSlice = (offset : number) => {
            const slice = file.slice(offset, offset + CHUNK_SIZE)
            reader.readAsArrayBuffer(slice)
        }
        readSlice(0)
    }

    const handleSelectFile = (memberId : string) => {
        const input = document.createElement("input")
        input.type = "file"
        input.onchange = () => {
            const file = input.files ? input.files[0] : null
            if(!file) return
            selectedFilesRef.current.set(memberId, file)
            setSelectedFileNames(prev => ({ ...prev, [memberId] : file.name }))
            console.log(`file selected for member ${memberId} : ${file.name}`)
        }
        input.click()
    }

    const handleSendFile = (memberId : string) => {

        const file = selectedFilesRef.current.get(memberId)
        if(!file) {
            alert("please select a file first")
            return
        }
        const connection = peerConnectionsRef.current.get(memberId)
        if(!connection){
            console.log(`no connection exists for ${memberId}`)
            return
        }
        const { dataChannel } = connection
        if(!dataChannel) {
            console.log(`data channel doesnt exist yet to send files`)
            // create a data channel here
            return
        }
        if(dataChannel.readyState === "open") {
            console.log("datachannel is open")
            sendFileOverChannel(file, dataChannel)
        } else {
            console.log("datachannel is not open")
            dataChannel.onopen = () => {
                console.log("Are you open now?")
                sendFileOverChannel(file, dataChannel)
            }
        }
        console.log(`file sent to ${memberId} : ${file.name}`)
    }

    const handleCloseRoom = () => {
        navigate('/')
    }

    const copyToClipboard = (text : string) => {
      navigator.clipboard.writeText(text)
        .then(() => {
          alert("copied to clipboard")
        })
        .catch((err) => {
          console.error("failed to copy", err)
          alert("failed to copy to clipboard")
        })
    }
    //console.log(members); // empty array

    return(
      <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-100">
      {/* Host ID Section */}
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col items-center mb-6">
              <h1 className="text-3xl font-semibold mb-4 text-gray-800">Host Room</h1>
              <div className="flex items-center gap-3 px-6 py-3 bg-blue-50 rounded-lg">
                <span className="text-lg font-medium text-blue-700">Your Host ID:</span>
                <span className="font-mono text-blue-800 bg-blue-100 px-3 py-1 rounded-md">
                    {hostId || "Generating..."}
                </span>
                <button
                     onClick={() => copyToClipboard(hostId)}
                    className="p-1.5 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                    title="Copy to Clipboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                   </svg>
                </button>
            </div>
          </div>
      </div>

      {/* Connected Members Section */}
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Connected Members</h2>
          
          {members.length === 0 ? (
              <div className="text-center py-8">
                  <p className="text-gray-500">No members connected yet.</p>
              </div>
          ) : (
              <ul className="space-y-4">
                  {members.map((memberId) => (
                      <li key={memberId} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center justify-between">
                              {/* Member Info */}
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                      </svg>
                                  </div>
                                  <span className="font-mono text-gray-700">{memberId}</span>
                              </div>

                              {/* File Actions */}
                              <div className="flex items-center gap-2">
                                  <button
                                      onClick={() => handleSelectFile(memberId)}
                                      className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                      </svg>
                                      Select File
                                  </button>
                                  <button
                                      onClick={() => handleSendFile(memberId)}
                                      className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-2"
                                      disabled={!selectedFileNames[memberId]}
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                      Send File
                                  </button>
                              </div>
                          </div>

                          {/* Selected File Name */}
                          {selectedFileNames[memberId] && (
                              <div className="mt-3 pl-11">
                                  <p className="text-sm text-gray-600">
                                      <span className="font-medium">Selected File:</span> {selectedFileNames[memberId]}
                                  </p>
                              </div>
                          )}
                      </li>
                  ))}
              </ul>
          )}
      </div>

      {/* Close Room Button */}
      <button
          onClick={handleCloseRoom}
          className="px-6 py-2.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center gap-2"
      >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Close Room
      </button>
  </div>
    )
}

export default Host