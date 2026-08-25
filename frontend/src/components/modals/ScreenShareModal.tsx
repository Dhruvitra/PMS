import React, { useState, useEffect, useRef } from 'react';
import { Monitor, X, Play, Square, AlertCircle, ShieldCheck } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';

interface ScreenShareModalProps {
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    initials: string;
    color: string;
  };
}

const COLOR_MAP: Record<string, string> = {
  '#7c3aed': 'bg-[#7c3aed]',
  '#2563eb': 'bg-[#2563eb]',
  '#059669': 'bg-[#059669]',
  '#d97706': 'bg-[#d97706]',
  '#e11d48': 'bg-[#e11d48]',
  '#0891b2': 'bg-[#0891b2]',
  '#4f46e5': 'bg-[#4f46e5]',
  '#db2777': 'bg-[#db2777]',
};

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({ onClose, targetUser }) => {
  const socket = useSocket();
  const [status, setStatus] = useState<'requesting' | 'waiting' | 'connecting' | 'streaming' | 'failed'>('requesting');
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!socket) return;

    // 1. Initialize WebRTC first to avoid race conditions
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });
    peerConnection.current = pc;

    const candidateQueue: RTCIceCandidateInit[] = [];
    let isRemoteDescriptionSet = false;

    // Handle answer from user
    const handleAnswer = async (data: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
      if (data.fromUserId !== targetUser.id || !peerConnection.current) {
        console.log('ADMIN: Ignoring answer (wrong user or no PC)');
        return;
      }
      
      try {
        console.log('ADMIN: Received Screen Offer, establishing link...');
        setStatus('connecting');
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        isRemoteDescriptionSet = true;

        // Process queued candidates
        console.log(`ADMIN: Processing ${candidateQueue.length} queued candidates`);
        while (candidateQueue.length > 0) {
          const cand = candidateQueue.shift();
          if (cand) await peerConnection.current.addIceCandidate(new RTCIceCandidate(cand));
        }

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        
        socket.emit('webrtc:answer', {
          targetUserId: targetUser.id,
          answer: answer
        });
      } catch (err) {
        console.error('ADMIN: Failed to set remote description:', err);
        setError('Connection failed during handshake');
        setStatus('failed');
      }
    };

    // Handle ICE candidates
    const handleIceCandidate = (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      if (data.fromUserId !== targetUser.id) return;
      if (peerConnection.current && isRemoteDescriptionSet) {
        peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      } else {
        candidateQueue.push(data.candidate);
      }
    };

    // Handle user rejecting or stopping
    const handleStop = (data: { fromUserId: string }) => {
      if (data.fromUserId !== targetUser.id) return;
      setStatus('failed');
      setError('User ended the session');
    };

    socket.on('admin:screen-answer', handleAnswer);
    socket.on('admin:ice-candidate', handleIceCandidate);
    socket.on('webrtc:stop-share', handleStop);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('admin:ice-candidate', { 
          targetId: `user:${targetUser.id}`, 
          candidate: event.candidate 
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ADMIN: ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        // Disconnected can be temporary but usually means terminal in this context
        if (pc.iceConnectionState === 'failed') {
          setError('Connection failed (ICE Error)');
          setStatus('failed');
        }
      }
    };

    pc.ontrack = (event) => {
      console.log('ADMIN: Received remote track!', event.track.kind);
      setStatus('streaming');
      
      const stream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStream(stream);
    };

    // 2. Finally, send request to user
    const adminName = `${localStorage.getItem('firstName') || 'Admin'} ${localStorage.getItem('lastName') || ''}`;
    console.log(`ADMIN: Dispatching Monitor Request to ${targetUser.name} (${targetUser.id})`);
    
    socket.emit('admin:request-screen', { 
      targetUserId: targetUser.id,
      adminName: adminName 
    });
    setStatus('waiting');

    return () => {
      socket.off('admin:screen-answer', handleAnswer);
      socket.off('admin:ice-candidate', handleIceCandidate);
      socket.off('webrtc:stop-share', handleStop);
      socket.emit('webrtc:stop-share', { targetUserId: targetUser.id });
      pc.close();
      peerConnection.current = null;
    };
  }, [socket, targetUser.id]);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      console.log('ADMIN: Attaching stream to video element', remoteStream.id);
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(err => {
        console.warn('ADMIN: Autoplay prevented or failed:', err);
      });
    }
  }, [remoteStream, status]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-6xl aspect-video bg-[#0B0D11] rounded-[32px] overflow-hidden shadow-2xl border border-white/5 flex flex-col">
        
        {/* Top Header */}
        <div className="absolute top-0 left-0 w-full p-8 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Monitor size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-indigo-500 text-[9px] font-black text-white rounded uppercase tracking-[0.2em]">Remote Monitoring</span>
                <h2 className="text-lg font-bold text-white tracking-tight">{targetUser.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${status === 'streaming' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {status === 'requesting' && 'Initializing Request...'}
                  {status === 'waiting' && 'Waiting for permission...'}
                  {status === 'connecting' && 'Establishing Secure Link...'}
                  {status === 'streaming' && 'Live Content'}
                  {status === 'failed' && 'Session Interrupted'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-green-500/10 rounded-xl border border-green-500/20 flex items-center gap-2">
              <ShieldCheck size={14} className="text-green-500" />
              <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Admin Privacy Mode</span>
            </div>
            <button 
              onClick={onClose} 
              title="Close Monitoring"
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 bg-gray-900/40 flex items-center justify-center relative overflow-hidden">
          {status === 'streaming' ? (
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-contain"
            />
          ) : (
             <div className="flex flex-col items-center animate-scale-up">
                <div 
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-2xl mb-8 opacity-40 grayscale ${COLOR_MAP[targetUser.color] || 'bg-gray-700'}`}
                >
                  {targetUser.initials}
                </div>
                {error ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-red-500/10 text-red-500">
                      <AlertCircle size={32} />
                    </div>
                    <p className="text-red-400 font-bold uppercase tracking-widest text-xs">{error}</p>
                    <button onClick={onClose} className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest transition-all">Dismiss</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 relative">
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    </div>
                    <p className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Establishing Connection...</p>
                  </div>
                )}
             </div>
          )}
        </div>

        {/* Footer controls */}
        {status === 'streaming' && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button onClick={onClose} className="flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/20">
              <Square size={16} fill="white" />
              Stop Monitoring
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
