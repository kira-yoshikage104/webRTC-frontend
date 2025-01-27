import { FormEvent, useState } from "react"

const Join = () => {
    const [hostId, setHostId] = useState<string>("")
    const [userId, setUserId] = useState<string>("")

    const handleJoinRoom = async (e : FormEvent) => {
        e.preventDefault() 
        const socket = new WebSocket('ws://localhost:8080')
        socket.onopen = () => {
            
        }

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