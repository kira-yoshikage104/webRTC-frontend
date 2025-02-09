import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const Host = () => {
    const socketRef = useRef<WebSocket | null>(null)
    const [hostId, setHostId] = useState<string>("")
    const peerConnectionsRef = useRef<Map<string, { pc : RTCPeerConnection, dataChannel : RTCDataChannel }>>(new Map()) 
    const [members, setMembers] = useState<Array<string>>([])
    const [selectedFileNames, setSelectedFileNames] = useState<{ [key : string] : string }>({})
    const selectedFilesRef = useRef<Map<string, File>>(new Map())
    const navigate = useNavigate()

    useEffect(() => {
        socketRef.current = new WebSocket('ws://localhost:8080')
        const socket = socketRef.current

        socket.onopen = () => {
            console.log(`connected to websocket 8080`)
            socket.send(JSON.stringify({ type : 'create-room' }))
        }
        
        socket.onerror = (err) => {
            console.error('websocket error', err)
        }

        socket.onmessage = async (e) => {
            const message = JSON.parse(e.data)
            console.log(`message : ${e.data}`)
            if(message.type === 'host-id') {
                setHostId(message.hostId)
            } else if(message.type === 'new-member') {
                const { offer, memberId } = message

                setMembers(prev => [...prev, memberId])
                console.log(`new member ${memberId}`)
                
                const pc = new RTCPeerConnection()

                const dataChannel = pc.createDataChannel("fileTransfer", { ordered : true })
                dataChannel.binaryType = "arraybuffer"

                dataChannel.onopen = () => {
                    console.log(`data channel open for member ${memberId}`)
                }

                dataChannel.onmessage = (e) => {
                    console.log(`Recieved data from member ${memberId} : ${e.data}`)
                }

                peerConnectionsRef.current.set(memberId, { pc, dataChannel })

                pc.onicecandidate = (e) => {
                    console.log(`sending new ice candidate ${e.candidate}`)
                    if(e.candidate) {
                        socket.send(JSON.stringify({ type : "ice-candidate", candidate : e.candidate, id : memberId }))
                    }

                }
                try {
                    await pc.setRemoteDescription(offer)
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    socket.send(JSON.stringify({ type : 'create-answer', answer, memberId }))
                } catch(err) {
                    console.log("error in setting creating answer" );
                    socket.send(JSON.stringify({ error : "error in setting creating answer" }))
                }
            } else if(message.type === 'ice-candidate') {
                const pc = peerConnectionsRef.current.get(message.id)?.pc
                pc?.addIceCandidate(new RTCIceCandidate(message.candidate))
                console.log(`recieved new ice candidate ${message.candidate}`)
            } else if(message.type === 'disconnected') {
                const { memberId } = message
                peerConnectionsRef.current.get(memberId)?.pc?.close()
                peerConnectionsRef.current.delete(memberId)
                setMembers(prev => prev.filter(member => member !== memberId))
            }
        }

        socket.onclose = () => {
            console.log('websocket connection closed')
        }

        return () => {
            const pcs = peerConnectionsRef.current
            pcs?.forEach(({ pc }) => {
                pc.close()
            })
            pcs?.clear()
            
            socketRef?.current?.close()
            setMembers([])
            console.log(`websocket disconnected`)
        }
    }, [])

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

    return(
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-100">
      {/* Host ID Section */}
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-3xl font-semibold mb-4">Host ID</h1>
          <div className="flex justify-center items-center px-6 py-3 bg-blue-100 rounded-md">
            <p className="text-lg font-medium text-blue-800">
              {hostId || "Generating host ID..."}
            </p>
          </div>
        </div>
      </div>

      {/* Connected Members Section */}
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Connected Members</h2>
        {members.length === 0 ? (
          <p className="text-gray-500 italic">No members connected yet.</p>
        ) : (
          <ul className="space-y-4">
            {members.map(memberId => (
              <li key={memberId} className="flex flex-col items-start justify-between bg-gray-50 p-4 rounded-md">
                <div className="w-full flex items-center justify-between">
                  <p className="text-gray-800 font-medium">{memberId}</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSelectFile(memberId)}
                      className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out"
                    >
                      Select File
                    </button>
                    <button
                      onClick={() => handleSendFile(memberId)}
                      className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition duration-300 ease-in-out"
                    >
                      Send File
                    </button>
                  </div>
                </div>
                {/* Display file name if one was selected */}
                {selectedFileNames[memberId] && (
                  <p className="mt-2 text-sm text-gray-600">
                    {selectedFileNames[memberId]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={handleCloseRoom}
        className="bg-red-500 text-white py-3 px-6 rounded-md shadow-md hover:bg-red-600 transition duration-300 ease-in-out"
      >
        Close Room
      </button>
    </div>
    )
}

export default Host