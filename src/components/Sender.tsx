import { useState, useEffect, useRef } from "react"

const Sender = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080')
        socket.onopen = () => {
            socket?.send(JSON.stringify({ type : "sender" }))
        }
        setSocket(socket)

        return () => {
            peerConnectionRef?.current?.close()
            socket.close()
            console.log("websocket disconnected")
        }
    }, [])

    const startSendingVideo = async () => {
        if(!socket) return

        const pc = new RTCPeerConnection()
        peerConnectionRef.current = pc
            
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video : true, audio : false })
            stream.getTracks().forEach(track => pc.addTrack(track, stream))
            console.log("media stream: ", stream)
        } catch(err) {
            console.error("error accessing video media", err);
            return;
        }

        pc.onnegotiationneeded = async () => {
            console.log("on negotiation needed")
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.send(JSON.stringify({ type : "create-offer", offer : pc.localDescription }))
        }

        pc.onicecandidate = e => {
            console.log(e)
            if(e.candidate) {
                socket.send(JSON.stringify({ type : "ice-candidates", candidates : e.candidate }))
            }
        }

        socket.onmessage = async (e) => {
            const message = JSON.parse(e.data)
            if(message.type === "create-answer") {
                await pc.setRemoteDescription(message.offer)
            } else if(message.type === "ice-candidates") {
                pc.addIceCandidate(message.candidates)
            }
        }
    }

    return (
        <>
            <h1>Sender</h1>
            <button onClick={startSendingVideo}>Send Video</button> 
        </>
    )
}

export default Sender