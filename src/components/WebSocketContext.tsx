import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

type WebSocketContextType = WebSocket | null;

// Create a WebSocket Context
const WebSocketContext = createContext<WebSocketContextType>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("wss://p2p-file-sharing-system-rsnt.onrender.com");

    ws.onopen = () => console.log("WebSocket connected!");
    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket disconnected!");

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={socket}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom Hook for WebSocket Access
export const useWebSocket = (): WebSocketContextType => {
  return useContext(WebSocketContext);
};
