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
    const ws = new WebSocket("ws://localhost:5000"); // Change to your backend URL if deployed

    ws.onopen = () => {
      console.log("WebSocket connected!");
      setSocket(ws); // Set socket only after successful connection
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected!");
      setSocket(null);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []);

  return <WebSocketContext.Provider value={socket}>{children}</WebSocketContext.Provider>;
};

// Custom Hook for WebSocket Access
export const useWebSocket = (): WebSocketContextType => {
  return useContext(WebSocketContext);
};
