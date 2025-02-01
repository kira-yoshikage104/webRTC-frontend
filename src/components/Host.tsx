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
        <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-100">
            <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6 mb-8">
                <div className='flex flex-col items-center mb-6'>
                    <h1 className='text-3xl font-semibold mb-4'>Host ID</h1>
                    <div className='flex justify-center items-center px-6 py-3 bg-blue-100 min-w-64 rounded-md'>
                        <p className="text-lg font-medium text-blue-800">
                            {hostId || "Generating host ID..."}
                        </p>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4">Connected Members</h2>
                {members.length === 0 ? (
                    <p className="text-gray-500 italic">No members connected yet.</p>
                ) : (
                    <ul className="space-y-4">
                        {members.map(memberId => (
                            <li key={memberId} className="flex items-center justify-between bg-gray-50 p-4 rounded-md"> 
                                <p className="text-gray-800 font-medium">{memberId}</p>
                                <button className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition duration-300 ease-in-out">
                                    Send File
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

export default Host