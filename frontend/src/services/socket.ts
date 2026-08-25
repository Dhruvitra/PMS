import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let activeConnections = 0;

export function connectSocket(token: string): Socket {
  activeConnections++;

  if (socket) {
    // Reuse existing socket — just update auth if needed
    if (!socket.connected && !socket.active) {
      socket.auth = { token };
      socket.connect();
    }
    return socket;
  }

  socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    upgrade: false,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
    timeout: 20000,
    autoConnect: false,
  });

  // Handle session errors (e.g. stale SID after backend restart)
  socket.on('connect_error', (err) => {
    if (
      err.message === 'Session ID unknown' ||
      err.message?.includes('xhr poll error') ||
      err.message?.includes('transport error') ||
      err.message?.includes('websocket error')
    ) {
      // Force a clean reconnect with fresh handshake
      if (socket) {
        socket.io.opts.query = {};
        socket.disconnect();
      }
      setTimeout(() => {
        if (socket && activeConnections > 0) {
          socket.connect();
        }
      }, 1000);
    }
  });

  // Delay connect to avoid race with React strict mode double-mount
  setTimeout(() => {
    if (socket && !socket.connected && activeConnections > 0) {
      socket.connect();
    }
  }, 50);

  return socket;
}

export function disconnectSocket(): void {
  activeConnections = Math.max(0, activeConnections - 1);
  // Only disconnect when truly no consumers remain, with delay
  if (activeConnections <= 0) {
    const s = socket;
    setTimeout(() => {
      if (activeConnections <= 0 && s && socket === s) {
        s.disconnect();
        socket = null;
      }
    }, 200);
    activeConnections = 0;
  }
}

export function forceDisconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  activeConnections = 0;
}

export function getSocket(): Socket | null {
  return socket;
}
