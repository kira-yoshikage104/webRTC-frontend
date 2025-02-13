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
    const iceServers = [{ urls : "stun:stun.l.google.com:19302" }]

    useEffect(() => {
        const interval = setInterval(() => {
            if(dataChannelRef.current) {
                console.log(`data channel state : ${dataChannelRef.current.readyState}`)
            }
        }, 2000)
        return () => clearInterval(interval)
    }, [])

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
        peerConnectionRef.current = new RTCPeerConnection({ iceServers })
        const pc = peerConnectionRef.current

        const dataChannel = pc.createDataChannel("fileTransfer", { ordered : true })
        dataChannel.binaryType = "arraybuffer"
        dataChannelRef.current = dataChannel

        dataChannel.onopen = () => {
            console.log('data channel opened')
        }

        let recievedBuffers : ArrayBuffer[] = []
        let recievedBytes = 0

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
                console.log(`Received chunk (${ev.data.byteLength} bytes) Total: ${recievedBytes}`);
            }
        }

        dataChannel.onerror = (err) => {
            console.error("data channel error : ", err)
        }

        pc.onicecandidate = (e) => {
            console.log(`sending new ice candidate ${e.candidate}`)
            if(e.candidate) {
                socket.send(JSON.stringify({ type : "ice-candidate", candidate : e.candidate, targetId : hostId }))
            }
        }
        try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.send(JSON.stringify({ type : 'join-room', hostId, offer}))
            console.log(`offer sent ${JSON.stringify(offer)}`)
        } catch(err) {
            console.error("error creating offer", err)
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
        {/* Join Room Form */}
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
                    {isInRoom ? 'Joined' : 'Join Room'}
                </button>
            </form>
        </div>

        {/* Room Information */}
        {isInRoom && (
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
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
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
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* File Transfer Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-600">
                            {selectedFileName || "No file selected"}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSelectFile}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                            >
                                Choose File
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSendFile}
                        className="w-full py-2.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                        disabled={!selectedFileName}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Send File to Host
                    </button>
                </div>

                {/* Connection Status */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Connection Status:</span>
                        <span className={`font-medium ${dataChannelRef.current?.readyState === 'open' ? 'text-green-500' : 'text-yellow-500'}`}>
                            {dataChannelRef.current?.readyState === 'open' ? 'Connected' : 'Connecting...'}
                        </span>
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
    )
}

export default Join