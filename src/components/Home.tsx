import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "./WebSocketContext"; // ✅ Use the WebSocket context

const Home = () => {
    const navigate = useNavigate();
    const socket = useWebSocket(); // ✅ Get WebSocket from context

    useEffect(() => {
        if (!socket) return;

        // ✅ Define the WebSocket message handler
        const handleMessage = (event: MessageEvent) => {
            const message = JSON.parse(event.data);
            if (message.type === "host-id") {
                console.log("first log of the day")
                navigate(`/room?roomId=${message.hostId}`, {state: {userId: message.hostId}});
            }
        };

        // ✅ Attach the event listener once
        socket.addEventListener("message", handleMessage);

        return () => {
            // ✅ Cleanup the event listener when component unmounts
            socket.removeEventListener("message", handleMessage);
        };
    }, [socket, navigate]);

    const createhandleClick = () => {
        if (!socket) {
            console.error("WebSocket is not connected.");
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
// The Home component is the main entry point of the application. It allows users to create a new room or join an existing room. When the user clicks the "Create Room" button, the component sends a create-room request to the server. When the user clicks the "Join Room" button, the component navigates to the Join component.    