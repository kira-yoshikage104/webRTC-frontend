import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useWebSocket } from './WebSocketContext';

const Host = () => {
    const location = useLocation();
    const socketRef = useWebSocket()
    const peerConnectionsRef = useRef<Map<string, { pc : RTCPeerConnection, dataChannel : RTCDataChannel }>>(new Map())
    const selectedFilesRef = useRef<Map<string, File>>(new Map()) 
    const [members, setMembers] = useState<Array<string>>([])
    const [selectedFileNames, setSelectedFileNames] = useState<{ [key : string] : string }>({})
    const [SearchParams] = useSearchParams()
    const navigate = useNavigate()
    const iceServers = [{ urls : "stun:stun.l.google.com:19302" }]
    const hostId = SearchParams.get('hostId') || ""
    const userId = SearchParams.get('userId') || ""

    console.log(`user-id: ${userId}`)
  
    useEffect(() => {
        console.log("huitrdj");
        if(!socketRef){
            console.log("oh you're here")
            return;
        }
        console.log("Socket state:", socketRef?.readyState);
        // implement join room
        if(socketRef.readyState === WebSocket.OPEN) {
            handleWebSocketOpen()
        }else{
            socketRef.onopen = handleWebSocketOpen
        }   
        
        socketRef.onerror = (err) => {
            console.error('websocket error', err)
        }

        socketRef.onmessage = async (e) => {
            console.log("message")
            const message = JSON.parse(e.data)
            console.log(`message : ${e.data}`)
            if(message.type === 'new-member') {
                const offer = message.offer
                const memberId = message.memberId
                const hostId = message.hostId       

                setMembers(prev => [...prev, memberId])
                console.log(`new member ${memberId}`)
                
                const pc = new RTCPeerConnection({ iceServers })

                pc.ondatachannel = (event) => {
                    const dataChannel = event.channel
                    dataChannel.binaryType = "arraybuffer"

                    dataChannel.onopen = () => {
                        console.log(`Data Channel open for member ${memberId}`)
                    }

                    let recievedBuffers : ArrayBuffer[] = []
                    let recievedBytes = 0
                    dataChannel.onmessage = (ev) => {
                      if (typeof ev.data === "string" && ev.data === "EOF") {
                        const blob = new Blob(recievedBuffers);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `file_from_${memberId}`;
                        a.click();
                        recievedBuffers = [];
                        recievedBytes = 0;
                        console.log("File transfer complete");
                      } else if (ev.data instanceof ArrayBuffer) {
                            recievedBuffers.push(ev.data);
                            recievedBytes += ev.data.byteLength;
                            console.log(`Received chunk (${ev.data.byteLength} bytes) Total: ${recievedBytes}`);
                      }
                    }

                    peerConnectionsRef.current.set(memberId, { pc, dataChannel })

                }

                pc.onicecandidate = (e) => {
                    console.log(`sending new ice candidate ${e.candidate}`)
                    if(e.candidate) {
                        socketRef.send(JSON.stringify({ type : "ice-candidate", candidate : e.candidate, targetId : memberId }))
                    }
                }

                try {
                    await pc.setRemoteDescription(offer)
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    socketRef.send(JSON.stringify({ type : 'join-room', answer, memberId }))
                } catch(err) {
                    console.log("error in setting creating answer" );
                    socketRef.send(JSON.stringify({ error : "error in setting creating answer" }))
                }
            } else if(message.type === 'ice-candidate') {
                const pc = peerConnectionsRef.current.get(message.senderId)?.pc
                pc?.addIceCandidate(new RTCIceCandidate(message.candidate))
                console.log(`recieved new ice candidate ${message.candidate}`)
            } else if(message.type === 'disconnected') {
                const { memberId } = message
                peerConnectionsRef.current.get(memberId)?.pc?.close()
                peerConnectionsRef.current.delete(memberId)
                setMembers(prev => prev.filter(member => member !== memberId))
            }
        }

        socketRef.onclose = () => {
            console.log('websocket connection closed')
        }

        return () => {
            const pcs = peerConnectionsRef.current
            pcs?.forEach(({ pc }) => {
                pc.close()
            })
            pcs?.clear()
            
            socketRef?.close()
            setMembers([])
            console.log(`websocket disconnected`)
        }
    }, [socketRef, hostId])

    const handleWebSocketOpen = async () => {
        if(!socketRef) return
        console.log(`websocket connected`)
        const pc = new RTCPeerConnection({ iceServers });

        // Create a DataChannel for file transfers
        const dataChannel = pc.createDataChannel("fileTransfer");
        dataChannel.binaryType = "arraybuffer";

        dataChannel.onopen = () => {
            console.log(`DataChannel is open for ${userId}`);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.send(JSON.stringify({
                    type: "ice-candidate",
                    candidate: event.candidate,
                    targetId: hostId
                }));
            }
        };

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Store the connection
            peerConnectionsRef.current.set(userId, { pc, dataChannel });

            // Send join-room request with offer
            socketRef.send(JSON.stringify({
                type: 'join-room',
                hostId,
                memberId: userId,
                offer
            }));

        } catch (err) {
            console.error("Error creating offer:", err);
        }
    }


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
        if(!connection) return
        const { dataChannel } = connection
        if(!dataChannel) {
            console.log(`data channel doesnt exist yet to send files`)
            // create a data channel here
            return
        }
        if(dataChannel.readyState === "open") {
            sendFileOverChannel(file, dataChannel)
        } else {
            dataChannel.onopen = () => {
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