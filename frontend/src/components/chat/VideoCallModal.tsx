import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, X } from 'lucide-react';

interface VideoCallModalProps {
  onClose: () => void;
  onAccept?: () => void;
  isReceiving?: boolean;
  targetUser: {
    name: string;
    avatarUrl?: string;
    initials: string;
    color: string;
  };
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({ onClose, onAccept, isReceiving, targetUser }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState(isReceiving ? 'Incoming Call...' : 'Calling...');
  const [isAccepted, setIsAccepted] = useState(!isReceiving);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isAccepted) return;

    const timer = setTimeout(() => setStatus('Negotiating...'), 2000);
    const timer2 = setTimeout(() => {
      setStatus('Connected - 0:01');
      setIsRemoteConnected(true);
    }, 4000);
    
    // Start camera stream
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Camera access failed:', err);
      }
    };

    startCamera();

    return () => { 
      clearTimeout(timer); 
      clearTimeout(timer2); 
      // Stop all tracks on unmount
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isAccepted]);

  // Handle Video Toggle
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOff;
      });
    }
  }, [isVideoOff, localStream]);

  // Handle Audio Toggle (Mute)
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted, localStream]);

  const handleAccept = () => {
    setIsAccepted(true);
    if (onAccept) onAccept();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-3xl animate-fade-in font-sans selection:bg-indigo-500/30">
      <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col group">
        
        {/* Remote Feed Area (Primary) / Incoming UI */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 to-black z-0 flex items-center justify-center overflow-hidden">
          {isAccepted ? (
            isRemoteConnected ? (
             <div className="w-full h-full relative flex items-center justify-center bg-gray-800/40">
                {/* Simulated Remote Feed with Animated Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent animate-pulse" />
                </div>
                
                <div className="flex flex-col items-center animate-scale-up">
                  <div 
                    className="w-40 h-40 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-[0_0_30px_rgba(255,255,255,0.1)] ring-2 ring-white/10"
                    {...{ style: { backgroundColor: targetUser.color } }}
                  >
                    {targetUser.initials}
                  </div>
                  <h2 className="mt-8 text-3xl font-black text-white tracking-tight drop-shadow-2xl">{targetUser.name}</h2>
                  <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] font-black text-green-400 tracking-widest uppercase">Live Encrypted</span>
                  </div>
                </div>
             </div>
            ) : (
             <div className="flex flex-col items-center">
                <div className="relative w-24 h-24">
                   <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                   <div 
                    className="absolute inset-2 rounded-full flex items-center justify-center text-xl font-bold text-white/40"
                    {...{ style: { backgroundColor: targetUser.color + '20' } }}
                  >
                    {targetUser.initials}
                  </div>
                </div>
                <p className="mt-6 text-indigo-400 font-bold tracking-widest uppercase text-[10px] animate-pulse">{status}</p>
             </div>
            )
          ) : (
            <div className="flex flex-col items-center text-center animate-bounce-subtle">
               <div 
                  className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-2xl ring-8 ring-indigo-100/10 mb-8 animate-pulse"
                  {...{ style: { backgroundColor: targetUser.color } }}
                >
                  {targetUser.initials}
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-2">Incoming Video Call</h2>
                <p className="text-indigo-400 font-bold tracking-widest uppercase text-[12px] mb-12">{targetUser.name} is calling you...</p>
                
                <div className="flex items-center gap-12">
                   <button 
                    onClick={handleAccept}
                    className="p-6 rounded-full bg-green-500 text-white shadow-lg shadow-green-500/20 hover:bg-green-400 transform hover:scale-110 active:scale-95 transition-all"
                    title="Accept Call"
                   >
                     <Video size={36} />
                   </button>
                   <button 
                    onClick={onClose}
                    className="p-6 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-500 transform hover:scale-110 active:scale-95 transition-all"
                    title="Decline Call"
                   >
                     <PhoneOff size={36} />
                   </button>
                </div>
            </div>
          )}
        </div>

        {/* Header Overlay */}
        <div className="absolute top-0 left-0 w-full p-10 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 bg-black/40 backdrop-blur-2xl rounded-2xl text-[11px] font-black text-white tracking-[0.2em] flex items-center gap-3 border border-white/5 uppercase ${!isAccepted && 'hidden'}`}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
              {status}
            </div>
            <div className="px-4 py-2 bg-indigo-500/10 backdrop-blur-2xl rounded-2xl text-[11px] font-black text-indigo-400 tracking-wider flex items-center gap-2 border border-indigo-500/20 uppercase">
              HD Video
            </div>
          </div>
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-[-10px] group-hover:translate-y-0">
            <button className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white border border-white/5" title="Fullscreen">
              <Maximize2 size={18} />
            </button>
            <button onClick={onClose} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white border border-white/5" title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Local Preview Area (Bottom Right) */}
        <div className={`absolute bottom-12 right-12 w-64 aspect-video bg-gray-900 rounded-[30px] overflow-hidden shadow-2xl ring-1 ring-white/10 z-30 transition-all duration-700 hover:scale-105 group/self border-2 border-white/5 ${!isAccepted && 'hidden'}`}>
          {!isVideoOff ? (
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover"
              {...{ style: { transform: 'scaleX(-1)' } }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white/20">
                <VideoOff size={24} />
              </div>
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-xl rounded-lg text-[9px] font-bold text-white/70 uppercase tracking-widest border border-white/5">
            You
          </div>
        </div>

        {/* Controls Overlay (Only when accepted) */}
        {isAccepted && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-10 py-5 bg-black/40 backdrop-blur-2xl rounded-[32px] border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-40 transition-all hover:scale-105 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`p-5 rounded-2xl transition-all ${isMuted ? 'bg-red-500 text-white rotate-12' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              {isMuted ? <MicOff size={26} /> : <Mic size={26} />}
            </button>
            
            <button 
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-5 rounded-2xl transition-all ${isVideoOff ? 'bg-red-500 text-white -rotate-12' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              {isVideoOff ? <VideoOff size={26} /> : <Video size={26} />}
            </button>

            <button 
              onClick={onClose}
              className="p-5 rounded-2xl bg-red-600 text-white hover:bg-red-500 hover:rotate-12 transition-all shadow-[0_0_30px_rgba(220,38,38,0.3)]"
              title="End Call"
            >
              <PhoneOff size={26} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
