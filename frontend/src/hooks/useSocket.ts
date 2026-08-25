import { useEffect, useState } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useAppSelector } from '../store';
import type { Socket } from 'socket.io-client';

export function useSocket(): Socket | null {
  const token = useAppSelector((state) => state.auth.accessToken);
  const [socket, setSocket] = useState<Socket | null>(getSocket());

  useEffect(() => {
    if (token) {
      const s = connectSocket(token);
      setSocket(s);
      return () => {
        disconnectSocket();
      };
    } else {
      setSocket(null);
    }
  }, [token]);

  return socket;
}
