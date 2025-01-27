import { useState, useEffect, useRef } from 'react'

const Host = () => {
    const socketRef = useRef<WebSocket | null>(null)
    const [hostId, setHostId] = useState<string>("")
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

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

        socket.onmessage = (e) => {
            const message = JSON.parse(e.data)
            if(message.type === 'host-id') {
                setHostId(message.hostId)
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