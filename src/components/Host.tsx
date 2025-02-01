import { useState, useEffect, useRef } from 'react'

const Host = () => {
    const socketRef = useRef<WebSocket | null>(null)
    const [hostId, setHostId] = useState<string>("")
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const [members, setMembers] = useState<Array<string>>([])

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

                peerConnectionRef.current = new RTCPeerConnection()
                const pc = peerConnectionRef.current

                pc.onicecandidate = (e) => {
                    console.log(`sending new ice candidate ${e.candidate}`)
                    if(e.candidate) {
                        socket.send(JSON.stringify({ type : "ice-candidate", candidate : e.candidate }))
                    }

                }
                await pc.setRemoteDescription(offer)
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                socket.send(JSON.stringify({ type : 'create-answer', answer, memberId }))
            } else if(message.type === 'ice-candidate') {
                const pc = peerConnectionRef.current
                pc?.addIceCandidate(new RTCIceCandidate(message.candidate))
                console.log(`recieved new ice candidate ${message.candidate}`)
            }
        }

        socket.onclose = () => {
            console.log('websocket connection closed')
        }

        return () => {
            peerConnectionRef?.current?.close()
            socketRef?.current?.close()
            console.log(`websocket disconnected`)
        }
    }, [])

    return(
        <div className="flex flex-col flex-grow">
            <div className='flex flex-grow justify-center items-center'>
                <h1 className='text-3xl mx-5'>HOST-ID : </h1>
                <div className='flex justify-start items-center px-4 bg-lightahhblue min-w-64 min-h-10 rounded-md'>
                    <p>{hostId || "generating host id...."}</p>
                </div>
            </div>
        </div>
    )
}

export default Host