import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import './TeamChat.css';
import { playNotificationSent } from '../utils/notificationSound';
import { useAppSelector } from '../store';

interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface MentionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ChatMessage {
  id: string;
  text: string | null;
  imageUrl: string | null;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string };
}

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#e11d48', '#0891b2', '#4f46e5', '#db2777',
];

function getColorIndex(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % AVATAR_COLORS.length;
}

function getColor(id: string) {
  return AVATAR_COLORS[getColorIndex(id)];
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0) || ''}`.toUpperCase();
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  currentUserId: string;
  targetUser: ChatUser;
  onClose: () => void;
}

export function TeamChat({ currentUserId, targetUser, onClose }: Props) {
  const currentOrg = useAppSelector((state) => state.organization.currentOrg);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Mention State ── */
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionMembers, setMentionMembers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: ChatMessage[] }>(`/messages/${targetUser.id}`);
      if (res.data.success) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUser.id]);

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadMessages]);

  /* ── Load members for @mention ── */
  useEffect(() => {
    const loadMentionMembers = async () => {
      if (!currentOrg?.id) return;
      try {
        const res = await api.get<{ success: boolean; data: MentionUser[] }>('/users/all', { params: { orgId: currentOrg.id } });
        setMentionMembers(res.data.data);
      } catch (err) {
        console.error('Failed to load members for mention:', err);
      }
    };
    loadMentionMembers();
  }, [currentOrg?.id]);

  /* ── Close mention picker on outside click ── */
  useEffect(() => {
    if (!showMentions) return;
    const handler = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMentions]);

  const filteredMentionMembers = mentionMembers.filter(m => m.id !== currentUserId && `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || val[lastAtIdx - 1] === ' ' || val[lastAtIdx - 1] === '\n')) {
      const query = val.slice(lastAtIdx + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (user: MentionUser) => {
    const lastAtIdx = text.lastIndexOf('@');
    const before = text.slice(0, lastAtIdx);
    const afterAt = text.slice(lastAtIdx);
    const spaceIdx = afterAt.indexOf(' ', 1);
    const after = spaceIdx === -1 ? '' : afterAt.slice(spaceIdx);
    const mentionText = `@${user.firstName}${user.lastName} `;
    setText(before + mentionText + after);
    setShowMentions(false);
    const cursorPos = before.length + mentionText.length;
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      }
    }, 50);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (msgText?: string, imgUrl?: string) => {
    if (!msgText && !imgUrl) return;
    setSending(true);
    setSendError('');
    try {
      const res = await api.post<{ success: boolean; data: ChatMessage }>('/messages', {
        receiverId: targetUser.id,
        text: msgText || undefined,
        imageUrl: imgUrl || undefined,
      });
      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setText('');
        setImagePreview(null);
        playNotificationSent();
      }
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to send message. Try again.';
      setSendError(errMsg);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !imagePreview) return;
    sendMessage(trimmed || undefined, imagePreview || undefined);
  };

  const sendImageFile = (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSendError('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      sendMessage(undefined, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const sendImageDirectly = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sendImageFile(file);
      e.target.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          sendImageFile(file);
        }
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      setSharing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) {
      console.error('Screen share failed:', err);
    }
  };

  const stopScreenShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setSharing(false);
  };

  const colorIndex = getColorIndex(targetUser.id);

  return (
    <div className="fixed inset-x-3 bottom-3 top-20 sm:inset-x-auto sm:top-auto sm:bottom-4 sm:right-4 z-[9999] w-auto h-auto sm:w-[420px] sm:h-[560px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden team-chat-container">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-500">
        <div
          className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ring-2 ring-white/30 bg-gradient-to-br from-blue-500 to-purple-600"
        >
          {initials(targetUser.firstName, targetUser.lastName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {targetUser.firstName} {targetUser.lastName}
          </p>
          <p className="text-[11px] text-indigo-100 truncate">{targetUser.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={sharing ? stopScreenShare : startScreenShare}
            className={`p-2.5 rounded-lg transition-colors ${sharing ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30' : 'text-white/70 hover:bg-white/20'}`}
            title={sharing ? 'Stop sharing' : 'Share screen'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg text-white/70 hover:bg-white/20 transition-colors"
            title="Send photo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={sendImageDirectly} title="Upload a file" />
          <button onClick={onClose} className="p-2.5 rounded-lg text-white/70 hover:bg-white/20 transition-colors" title="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Screen share preview */}
      {sharing && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-600">Sharing your screen</span>
            <button onClick={stopScreenShare} className="ml-auto text-[11px] text-red-500 hover:text-red-700 font-medium">
              Stop
            </button>
          </div>
          <video ref={videoRef} autoPlay muted className="w-full rounded border border-red-200 team-chat-video-preview" />
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50/50 dark:bg-gray-900/50">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <svg className="animate-spin mr-2 h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No messages yet</p>
            <p className="text-xs mt-0.5 text-gray-400">Send a message to start chatting!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.senderId === currentUserId;
            const showSender = !isMine && (i === 0 || messages[i - 1].senderId !== msg.senderId);
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                {/* Other person avatar */}
                {!isMine && (
                  <div
                    className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-auto mr-1.5 bg-gradient-to-br from-blue-500 to-purple-600"
                  >
                    {initials(targetUser.firstName, targetUser.lastName)}
                  </div>
                )}
                <div className="max-w-[72%]">
                  {/* Sender name */}
                  {showSender && (
                    <p className="text-[10px] text-gray-400 mb-0.5 ml-1 font-medium">
                      {msg.sender.firstName} {msg.sender.lastName}
                    </p>
                  )}
                  {isMine && (i === 0 || messages[i - 1].senderId !== msg.senderId) && (
                    <p className="text-[10px] text-indigo-400 mb-0.5 mr-1 font-medium text-right">You</p>
                  )}
                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${isMine
                        ? 'bg-indigo-500 text-white rounded-br-md'
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-600 shadow-sm rounded-bl-md'
                      }`}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="shared photo"
                        className="max-w-full rounded-lg mb-1.5 cursor-pointer hover:opacity-90 transition-opacity team-chat-image-msg"
                        onClick={() => {
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.write(`<img src="${msg.imageUrl}" style="max-width:100%;max-height:100vh;margin:auto;display:block" />`);
                          }
                        }}
                      />
                    )}
                    {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                  </div>
                  <p className={`text-[10px] mt-0.5 px-1 ${isMine ? 'text-right' : ''} text-gray-400`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
                {/* My avatar */}
                {isMine && (
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-auto ml-1.5">
                    You
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {sendError && (
        <div className="px-4 py-1.5 bg-red-50 border-t border-red-100">
          <p className="text-[11px] text-red-500 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            {sendError}
            <button onClick={() => setSendError('')} className="ml-auto text-red-400 hover:text-red-600">dismiss</button>
          </p>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="px-3 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center gap-2">
          <img src={imagePreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-indigo-200" />
          <span className="text-xs text-indigo-600 flex-1">Image ready to send</span>
          <button onClick={() => setImagePreview(null)} className="text-indigo-400 hover:text-indigo-600" title="Remove image preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2.5 bg-white dark:bg-gray-800 relative">
        {/* @Mention Dropdown */}
        {showMentions && filteredMentionMembers.length > 0 && (
          <div ref={mentionRef} className="absolute bottom-full left-0 right-0 mb-0 mx-3 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-[200px] overflow-y-auto">
            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">People</span>
            </div>
            {filteredMentionMembers.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => insertMention(m)}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left ${idx === mentionIndex ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                title={`Mention ${m.firstName}`}
              >
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                  {m.firstName?.[0]}{m.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 truncate">{m.firstName} {m.lastName}</p>
                  <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              // Handle mention navigation
              if (showMentions && filteredMentionMembers.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIndex(prev => (prev + 1) % filteredMentionMembers.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionIndex(prev => (prev - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  insertMention(filteredMentionMembers[mentionIndex]);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowMentions(false);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message... (@ to mention)"
            rows={1}
            disabled={sending}
            title="Type a message"
            className="flex-1 resize-none text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 max-h-20 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!text.trim() && !imagePreview)}
            className={`p-2.5 rounded-xl transition-all ${text.trim() || imagePreview
                ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
                : 'bg-gray-100 text-gray-400'
              } disabled:opacity-50`}
          >
            {sending ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
