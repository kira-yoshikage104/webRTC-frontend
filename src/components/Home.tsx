import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "./WebSocketContext"; // ✅ Use the WebSocket context

const Home = () => {
    const navigate = useNavigate();
    const socket = useWebSocket(); // ✅ Get WebSocket from context

    useEffect(() => {
        if (!socket) return;

        const handleMessage = (event: MessageEvent) => {    
            try {
                const message = JSON.parse(event.data);
                console.log("Received:", message);

                if (message.type === "roomId") {
                    navigate(`/host?hostId=${message.hostId}&userId=${message.hostId}`);
                    console.log("navigating")
                }else{
                    console.log("not navigating")
                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        socket.addEventListener("message", handleMessage);

        return () => {
            socket.removeEventListener("message", handleMessage);
        };
    }, [socket, navigate]);

    const createhandleClick = () => {
        if (!socket) {
            console.error("WebSocket is not initialized.");
            return;
        }

        if (socket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not open yet. Current state:", socket.readyState);
            return;
        }

        console.log("Sending create-room request");
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
