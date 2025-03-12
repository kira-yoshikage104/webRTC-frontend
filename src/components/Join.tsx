import { FormEvent, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "./WebSocketContext";

const Join = () => {
    const [hostId, setHostId] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const socket = useWebSocket();
    const navigate = useNavigate();

    console.log(`socket connection state is ${socket}`);

    useEffect(() => {
        if (!socket || !hostId) return;

        console.log("🔹 Sending get-id request");
        socket.send(JSON.stringify({ type: "get-id", hostId }));

        const handleMessage = (event: MessageEvent) => {
            const message = JSON.parse(event.data);
            console.log("📩 Received message:", message);

            if (message.type === "user-id") {
                setUserId(message.userId);
                console.log(`🔹 Received user ID: ${message.userId}`);
            }
        };

        socket.addEventListener("message", handleMessage);

        return () => {
            socket.removeEventListener("message", handleMessage);
        };
    }, [socket, hostId]);

    const handleJoinRoom = (e: FormEvent) => {
        e.preventDefault();

        if (!hostId.trim()) {
            alert("Invalid Host ID.");
            return;
        }

        if (!userId) {
            alert("User ID is not set yet. Please wait.");
            return;
        }

        navigate(`/room?roomId=${hostId}`, { state: { userId } });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-100">
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
                <form className="flex flex-col space-y-4" onSubmit={handleJoinRoom}>
                    <input
                        type="text"
                        placeholder="Enter host ID"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={hostId || ""}
                        onChange={(e) => setHostId(e.target.value)}
                        required
                    />
                    <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                        Join Room
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Join;
