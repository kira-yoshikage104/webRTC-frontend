import { useContext, createContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";


const WebSocketContext = createContext<WebSocket | null>(null);
const Home = () => {
    const navigate = useNavigate();
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        socketRef.current = new WebSocket("ws://localhost:8080");

        socketRef.current.onopen = () => {
            console.log("Connected to WebSocket");
        };

        socketRef.current.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        socketRef.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("Received:", data);

                if (data.type === "host-id") {
                    navigate(`/room?roomId=${data.hostId}`, { state: { members: data.members } });
                }
            } catch (error) {
                console.error("Error parsing message:", error);
            }
        };

        return () => {
            socketRef.current?.close();
            console.log("WebSocket closed");
        };
    }, [navigate]);

    const createhandleClick = () => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not open or initialized.");
            return;
        }

        socket.send(JSON.stringify({ type: "create-room" }));
    };

    const joinhandleClick = () => {
        navigate("/join");
    };

    return (
        <div className="flex flex-grow flex-col justify-center items-center bg-gray-100 p-8">
            <h2 className="text-4xl font-bold mb-8 text-gray-800">Welcome to File Sharing</h2>
            <div className="space-y-6 w-full max-w-md">
                <button
                    className="bg-blue-500 text-white w-full py-4 text-xl font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 ease-in-out"
                    onClick={createhandleClick}
                >
                    Create Room
                </button>
                <button
                    className="bg-green-500 text-white w-full py-4 text-xl font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 ease-in-out"
                    onClick={joinhandleClick}
                >
                    Join Room
                </button>
            </div>
        </div>
    );
};

export default Home;
