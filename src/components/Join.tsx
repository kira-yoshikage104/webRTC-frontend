import { FormEvent, useState, useEffect, useRef } from "react"

const Join = () => {
    const socketRef = useRef<WebSocket | null>(null)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const [hostId, setHostId] = useState<string>("")
    const [userId, setUserId] = useState<string>("")

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
                setUserId(userId)
                console.log(`set user id to ${userId}`)
            } else if(message.type === 'create-answer') {
                const pc = peerConnectionRef.current
                pc?.setRemoteDescription(message.answer)
                console.log(`answer recieved and set remote description ${message.answer}`)
            } else if(message.type === 'ice-candidate') {
                const pc = peerConnectionRef.current
                pc?.addIceCandidate(new RTCIceCandidate(message.candidate))
                console.log(`recieved new ice candidate ${message.candidate}`)
            }
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

    return(
        <div className="flex flex-grow flex-col">
            <form className="flex justify-center items-center p-6" onSubmit={handleJoinRoom}>
                <input 
                    type="text" 
                    placeholder="connection url"
                    className="bg-lightahhblue border border-color-white rounded-md py-2 w-1/2 mx-6"
                    value={hostId}
                    onChange={e => setHostId(e.target.value)}
                    required
                />
                <button
                    className="bg-ahhyellow text-ahhblue py-2 px-6 border rounded-md"
                >Join </button>
            </form>
        </div>
    )
}

export default Join