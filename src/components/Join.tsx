import { FormEvent, useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

const Join = () => {
    const socketRef = useRef<WebSocket | null>(null)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const dataChannelRef = useRef<RTCDataChannel | null>(null)
    const selectedFileRef = useRef<File | null>(null)
    const [selectedFileName, setSelectedFileName] = useState<string>("")
    const [isInRoom, setIsInRoom] = useState(false)
    const [hostId, setHostId] = useState<string>("")
    const [userId, setUserId] = useState<string>("")
    const navigate = useNavigate()

    useEffect(() => {
        socketRef.current = new WebSocket('ws://localhost:8080')
        const socket = socketRef.current

        socket.onopen = () => {
            console.log(`connected to server 8080`)
        }

        socket.onerror = (err) => {
            console.error(`websocket error `, err)
        }

        socket.onmessage = (e) => {
            const message = JSON.parse(e.data)
            console.log(`message : ${e.data}`)
            if(message.type === 'userId') {
                setUserId(message.userId)
                console.log(`set user id to ${message.userId}`)
            } else if(message.type === 'create-answer') {
                const pc = peerConnectionRef.current
                pc?.setRemoteDescription(message.answer)
                setIsInRoom(true)
                console.log(`answer recieved and set remote description ${message.answer}`)
            } else if(message.type === 'ice-candidate') {
                const pc = peerConnectionRef.current
                pc?.addIceCandidate(new RTCIceCandidate(message.candidate))
                console.log(`recieved new ice candidate ${message.candidate}`)
            } else if(message.type === 'disconnected') {
                peerConnectionRef.current?.close()
                socketRef.current?.close()
                console.log('room closed')
                navigate('/')
            }
        }

        return () => {
            peerConnectionRef.current?.close()
            socketRef.current?.close()
            console.log('websocket connection disconnected')
        }
    }, [])

    const handleJoinRoom = async (e : FormEvent) => {
        e.preventDefault() 
        const socket = socketRef.current
        if(!socket) {
            return;
        }
        peerConnectionRef.current = new RTCPeerConnection()
        const pc = peerConnectionRef.current

        pc.ondatachannel = (e) => {
            const channel = e.channel
            channel.binaryType = "arraybuffer"
            channel.onopen = () => {
                console.log(`data channel open`)
            }
            channel.onmessage = (event) => {
                console.log(`recieved data ${event.data}`)
            }
            dataChannelRef.current = channel
        }

        pc.onicecandidate = (e) => {
            console.log(`sending new ice candidate ${e.candidate}`)
            if(e.candidate) {
                socket.send(JSON.stringify({ type : "ice-candidate", candidate : e.candidate }))
            }
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.send(JSON.stringify({ type : 'join-room', hostId, offer}))
        console.log(`offer sent ${JSON.stringify(offer)}`)
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

    const handleSelectFile = () => {
        const input = document.createElement("input")
        input.type = "file"
        input.onchange = () => {
            const file = input.files ? input.files[0] : null
            if(!file) return
            selectedFileRef.current = file
            setSelectedFileName(file.name)
            console.log(`file selected ${file.name}`)
        }
        input.click()
    }

    const handleSendFile = () => {
        const dataChannel = dataChannelRef.current
        if(!dataChannel) {
            console.log(`data channel doesnt exist yet to send files`)
            //create data channel here if it doesnt exist aldready
            return
        }
        const file = selectedFileRef.current
        if(!file) {
            alert("select a file first")
            return
        }
        if(dataChannel.readyState === "open") {
            sendFileOverChannel(file, dataChannel)
        } else {
            dataChannel.onopen = () => {
                sendFileOverChannel(file, dataChannel)  
            }
        }
    }

    const handleLeaveRoom = () => {
        navigate('/')
    }

    return(
        <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
        <form className="flex flex-col space-y-4" onSubmit={handleJoinRoom}>
          <input 
            type="text" 
            placeholder="Enter host ID"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={hostId}
            onChange={e => setHostId(e.target.value)}
            required
          />
          <button
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isInRoom}
          >
            Join Room
          </button>
        </form>
      </div>

      {isInRoom && (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Room Information</h2>
          <p className="text-gray-700 mb-4">Host ID: <span className="font-medium">{hostId}</span></p>
          <div className="flex space-x-2 mb-4">
            <button 
              onClick={handleSelectFile} 
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out"
            >
              Select File
            </button>
            <button 
              onClick={handleSendFile}
              className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition duration-300 ease-in-out"
            >
              Send File
            </button>
          </div>
          {/* Display selected file name */}
          {selectedFileName && (
            <p className="mb-4 text-sm text-gray-600">{selectedFileName}</p>
          )}
          <button
            onClick={handleLeaveRoom}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition duration-300 ease-in-out"
          >
            Leave Room
          </button>
        </div>
      )}

      {!isInRoom && (
        <button
          onClick={handleLeaveRoom}
          className="mt-4 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition duration-300 ease-in-out"
        >
          Back to Home
        </button>
      )}
    </div>
    )
}

export default Join