import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  project: string;
  path: string;
  content: string;
  timestamp: number;
}

export function useWebSocket(
  wsUrl: string,
  onFileChange: (project: string, filePath: string, content: string) => void
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let socket: WebSocket;

    const connect = () => {
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('Connected to WebSocket server');
        setConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          if (data.type === 'file_change') {
            console.log(`Live Reload update received for ${data.project}/${data.path}`);
            onFileChange(data.project, data.path, data.content);
          } else if (data.type === 'reload') {
            console.log('Operational architecture reload received');
            window.dispatchEvent(new CustomEvent('current-architecture-reload'));
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed. Retrying in 3 seconds...');
        setConnected(false);
        setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl, onFileChange]);

  return connected;
}
