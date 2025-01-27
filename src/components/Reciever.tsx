import { useState, useEffect, useRef } from 'react'

const Reciever = () => {
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const [hasTrack, setHasTrack] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(document.getElementById('recieve-video') as HTMLVideoElement)

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080')
        socket.onopen = () => {
            socket.send(JSON.stringify({ type : "reciever"}))
        }

        socket.onmessage = async (e) => {
            const message = JSON.parse(e.data)
            if(message.type === "create-offer") {
                if(!peerConnectionRef?.current) {
                    const pc = new RTCPeerConnection()
                    peerConnectionRef.current = pc

                    pc.ontrack = (event : RTCTrackEvent) => {
                        console.log("recieved track : ", event)
                        const video = videoRef.current
                        if(video) {
                            const [track] = event.streams[0].getTracks()
                            const newStream = new MediaStream([track])
                            video.srcObject = newStream
                            setHasTrack(true)
                            // video.play().catch(err => console.error("error playing video : ", err))
                        } else {
                            console.log("video element not found")
                        }
                    }

                    pc.onicecandidate = (e : RTCPeerConnectionIceEvent) => {
                        console.log(e)
                        if(e.candidate) {
                            socket.send(JSON.stringify({ type : "ice-candidates", candidates : e.candidate }))
                        }
                    }
                }
                const pc = peerConnectionRef.current
                await pc.setRemoteDescription(message.offer)
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                socket.send(JSON.stringify({ type : "create-answer", offer : pc.localDescription }))
            } else if(message.type === "ice-candidates") {
                const pc = peerConnectionRef.current
                await pc?.addIceCandidate(new RTCIceCandidate(message.candidates))
            }
        }

        return () => {
            peerConnectionRef?.current?.close()
            socket.close()
            console.log("websocket disconnected")
        }
    }, [])

    const handlePlay = () => {
        const videoElement = videoRef.current
        if(videoRef.current) {
            videoElement.play().catch(err => console.error("error playing the video", err))
        } else {
            console.warn("video ele not found when trying to play")
        }
    }

    return (
        <>
            <h1>Reciever</h1>
            <video 
                id="reciever-video" 
                ref={videoRef}
                autoPlay 
                playsInline 
                style={{ width : '100%', maxWidth : '600px'}} 
            />
            {hasTrack &&
            <button onClick={handlePlay}>Play Video</button>
            }
        </>
    ) 
}

export default Reciever