import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    const s = io(URL, { withCredentials: true });
    
    s.on('connect', () => {
      if (mounted) {
        setSocket(s);
        setConnected(true);
      }
    });
    s.on('disconnect', () => setConnected(false));

    return () => {
      mounted = false;
      s.disconnect();
    };
  }, []);

  return { socket, connected };
};
