import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import './ChatPanel.css';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { VideoCallModal } from './VideoCallModal';
import { ScreenShareModal } from '../modals/ScreenShareModal';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { useAppDispatch, useAppSelector } from '../../store';
import { markAsRead, setActiveChat } from '../../store/slices/messageSlice';
import { useToast } from '../../components/ui/Toast';
import { playNotificationSent } from '../../utils/notificationSound';

interface Message {
  id: string;
  text?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  senderId: string;
  receiverId: string;
  createdAt: string;
  readAt?: string;
}

function ChatAvatar({ initials, avatarUrl, size = 'md' }: { colorIdx?: number; initials: string; avatarUrl?: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-[40px] h-[40px] text-[13px]';
  const [imgError, setImgError] = useState(false);
  if (avatarUrl && !imgError) {
    return <img src={avatarUrl} alt="" onError={() => setImgError(true)} className={`${sizeClass} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none bg-gradient-to-br from-blue-500 to-purple-600`}>
      {initials}
    </div>
  );
}

function FilePreview({ name, size, type, url, onPreview }: { name: string; size?: number; type?: string; url: string; onPreview?: (url: string, name: string) => void }) {
  const isImage = type?.startsWith('image/');

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name || 'download';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (isImage) {
    const handlePreviewClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onPreview) {
        onPreview(url, name);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };
    return (
      <div className="mt-1 relative group/img rounded-xl overflow-hidden shadow-md border border-black/10 dark:border-white/5 w-fit">
        {/* Image */}
        <img
          src={url}
          alt={name}
          className="max-h-[300px] max-w-[300px] w-auto object-cover block cursor-pointer"
          loading="lazy"
          onClick={handlePreviewClick}
        />
        {/* Gradient overlay — fades in on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none" />
        {/* Action buttons — slide up from bottom on hover */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-3 translate-y-3 opacity-0 group-hover/img:translate-y-0 group-hover/img:opacity-100 transition-all duration-300">
          <button
            onClick={handlePreviewClick}
            className="w-9 h-9 flex items-center justify-center bg-white hover:bg-gray-100 text-gray-800 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95"
            title="View image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            onClick={handleDownload}
            className="w-9 h-9 flex items-center justify-center bg-[#00a884] hover:bg-[#00c99f] text-white rounded-full shadow-lg transition-all hover:scale-110 active:scale-95"
            title="Download image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handlePreview}
      className="mt-1 flex items-center gap-2 p-2.5 rounded-lg bg-[#f0f2f5] dark:bg-[#12262f] hover:bg-[#e9ebee] dark:hover:bg-[#1a3a47] transition-all max-w-[280px] group cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg bg-[#00a884] flex items-center justify-center text-white shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#111b21] dark:text-[#e9edef] truncate">{name}</p>
        <p className="text-[11px] text-[#667781] dark:text-[#8696a0]">{formatSize(size)} · {type?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
      </div>
      <button
        onClick={handlePreview}
        className="p-1.5 text-[#667781] hover:text-[#00a884] hover:bg-white dark:hover:bg-[#1a3a47] rounded transition-colors"
        title="Preview"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button
        onClick={handleDownload}
        className="p-1.5 text-[#667781] hover:text-[#00a884] hover:bg-white dark:hover:bg-[#1a3a47] rounded transition-colors"
        title="Download"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>
  );
}

interface ChatPanelProps {
  currentUserId: string;
  targetUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    colorIdx?: number;
  };
  onlineUsers?: Set<string>;
  onMessagesRead?: (senderId: string) => void;
  onBack?: () => void;
}

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  } catch (err) {
    console.error('Date formatting error:', err);
    return '';
  }
};

const formatDateSeparator = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
};

const shouldShowDateSeparator = (messages: Message[], idx: number) => {
  if (idx === 0) return true;
  const prev = new Date(messages[idx - 1].createdAt);
  const curr = new Date(messages[idx].createdAt);
  return prev.toDateString() !== curr.toDateString();
};

// Single tick (sent), double grey tick (delivered/online), double blue tick (read)
function MessageTicks({ readAt, isOnline }: { readAt?: string; isOnline: boolean }) {
  if (readAt) {
    // Double blue ticks — read
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="text-[#53bdeb]">
        <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.44-2.862-2.745a.473.473 0 0 0-.653.027.473.473 0 0 0 .027.653l3.19 3.068a.477.477 0 0 0 .653-.027l6.548-7.862a.436.436 0 0 0-.028-.63Z" fill="currentColor"/>
        <path d="M14.757.653a.457.457 0 0 0-.305-.102.493.493 0 0 0-.38.178L7.882 8.17 7.07 7.39l-.413.497.963.924a.477.477 0 0 0 .653-.027l6.548-7.862a.436.436 0 0 0-.064-.269Z" fill="currentColor"/>
      </svg>
    );
  }
  if (isOnline) {
    // Double grey ticks — delivered (receiver online)
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="text-[#8696a0]">
        <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.44-2.862-2.745a.473.473 0 0 0-.653.027.473.473 0 0 0 .027.653l3.19 3.068a.477.477 0 0 0 .653-.027l6.548-7.862a.436.436 0 0 0-.028-.63Z" fill="currentColor"/>
        <path d="M14.757.653a.457.457 0 0 0-.305-.102.493.493 0 0 0-.38.178L7.882 8.17 7.07 7.39l-.413.497.963.924a.477.477 0 0 0 .653-.027l6.548-7.862a.436.436 0 0 0-.064-.269Z" fill="currentColor"/>
      </svg>
    );
  }
  // Single grey tick — sent (receiver offline)
  return (
    <svg width="12" height="11" viewBox="0 0 12 11" fill="none" className="text-[#8696a0]">
      <path d="M9.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.44-2.862-2.745a.473.473 0 0 0-.653.027.473.473 0 0 0 .027.653l3.19 3.068a.477.477 0 0 0 .653-.027l6.548-7.862a.436.436 0 0 0-.028-.63Z" fill="currentColor"/>
    </svg>
  );
}

export const ChatPanel: React.FC<ChatPanelProps> = React.memo(({
  currentUserId,
  targetUser,
  onlineUsers,
  onMessagesRead,
  onBack
}) => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(state => (state as any).user.currentUser);
  const currentOrg = useAppSelector(state => (state as any).organization.currentOrg);
  const socket = useSocket();
  const { error: showError } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isScreenMonitoringOpen, setIsScreenMonitoringOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showFormatting, setShowFormatting] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioTimer, setAudioTimer] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [confirmDeleteSelectedOpen, setConfirmDeleteSelectedOpen] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSentRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Pending file staging (send only on Enter/Send)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drag-and-drop on input area
  const [inputDragging, setInputDragging] = useState(false);
  const inputDragCounter = useRef(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  /* ── Mention State ── */
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionMembers, setMentionMembers] = useState<any[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionRef = useRef<HTMLDivElement>(null);

  const initials = targetUser?.name
    ? targetUser.name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase() || 'U'
    : 'U';

  const avatarColors = [
    '#f31260', '#0070f3', '#17c964',
    '#9333ea', '#f5a623', '#eb00ff'
  ];
  const avatarColor = avatarColors[(targetUser?.colorIdx || 0) % avatarColors.length];

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  /* ── Load members for @mention ── */
  useEffect(() => {
    const loadMentionMembers = async () => {
      if (!currentOrg?.id) return;
      try {
        const res = await api.get<{ success: boolean; data: any[] }>('/users/all', { params: { orgId: currentOrg.id } });
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

  const insertMention = (user: any) => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const lastAtIdx = text.lastIndexOf('@');
    const before = text.slice(0, lastAtIdx);
    const afterAtQuery = text.slice(lastAtIdx);
    const spaceIdx = afterAtQuery.indexOf(' ', 1);
    const after = spaceIdx === -1 ? '' : afterAtQuery.slice(spaceIdx);
    const mentionName = `@${user.firstName}${user.lastName}`;
    const insertedText = mentionName + ' ';
    editorRef.current.innerText = before + insertedText + after;
    setInputValue(editorRef.current.innerText.trim());
    setShowMentions(false);
    editorRef.current.focus();
    // Move cursor to right after the inserted mention, not the end of any trailing text
    const cursorPos = before.length + insertedText.length;
    const textNode = editorRef.current.firstChild;
    const sel = window.getSelection();
    const range = document.createRange();
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const offset = Math.min(cursorPos, textNode.textContent?.length ?? 0);
      range.setStart(textNode, offset);
      range.collapse(true);
    } else {
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const fetchMessages = useCallback(async () => {
    if (!targetUser.id) return;
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Message[] }>(`/messages/${targetUser.id}`);
      if (res.data.success) {
        setMessages(res.data.data);
        setTimeout(() => scrollToBottom('auto'), 100);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUser.id]);

  const onMessagesReadRef = useRef(onMessagesRead);
  onMessagesReadRef.current = onMessagesRead;

  const markConversationAsRead = useCallback(async () => {
    if (!targetUser.id) return;
    dispatch(markAsRead(targetUser.id));
    if (onMessagesReadRef.current) onMessagesReadRef.current(targetUser.id);
  }, [targetUser.id, dispatch]);

  useEffect(() => {
    fetchMessages();
    markConversationAsRead();
    dispatch(setActiveChat(targetUser.id));
    return () => {
      dispatch(setActiveChat(null));
    };
  }, [targetUser.id, fetchMessages, markConversationAsRead, dispatch]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (!targetUser?.id) return;
      if (msg.senderId === targetUser.id || msg.senderId === currentUserId) {
        setMessages(prev => {
          // Prevent duplicates (especially for sender who already added via API/Optimistic)
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...(prev || []), msg];
        });
        setTimeout(() => scrollToBottom('smooth'), 100);
        if (msg.senderId === targetUser.id) {
          markConversationAsRead();
        }
      }
    };

    const handleMessagesRead = (data: { readBy: string }) => {
      if (targetUser?.id && data.readBy === targetUser.id) {
        setMessages(prev => (prev || []).map(m =>
          m.senderId === currentUserId ? { ...m, readAt: new Date().toISOString() } : m
        ));
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('messages:read-receipt', handleMessagesRead);

    const handleTypingStart = (data: { userId: string }) => {
      if (data.userId === targetUser.id) setIsTyping(true);
    };
    const handleTypingStop = (data: { userId: string }) => {
      if (data.userId === targetUser.id) setIsTyping(false);
    };
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('messages:read-receipt', handleMessagesRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, targetUser.id, currentUserId, markConversationAsRead]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() && !pendingFile) return;
    if (isSending) return;
    const text = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // Upload pending file first if any
    if (pendingFile) {
      await uploadFile(pendingFile);
      clearPendingFile();
      if (!text) { setIsSending(false); return; }
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      text,
      senderId: currentUserId,
      receiverId: targetUser.id,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 100);

    try {
      const res = await api.post<{ success: boolean; data: Message }>('/messages', {
        receiverId: targetUser.id,
        text
      });
      if (res.data.success) {
        // Replace optimistic message with real message from server
        setMessages(prev => prev.map(m => m.id === tempId ? res.data.data : m));
        playNotificationSent();
      } else {
        showError('Could not send message. Please try again.');
        setMessages(prev => prev.filter(m => m.id !== tempId));
        console.error('Send failed:', res.data);
      }
    } catch (err: any) {
      console.error('Send failed:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Connection to server failed.';
      showError(`Chat Error: ${errorMessage}`);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (socket && e.target.value.trim()) {
      if (!isTypingSentRef.current) {
        socket.emit('typing:start', { targetUserId: targetUser.id });
        isTypingSentRef.current = true;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { targetUserId: targetUser.id });
        isTypingSentRef.current = false;
      }, 2000);
    } else if (socket && !e.target.value.trim() && isTypingSentRef.current) {
      socket.emit('typing:stop', { targetUserId: targetUser.id });
      isTypingSentRef.current = false;
    }
  };

  const uploadFile = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const res = await api.post<{
        success: boolean;
        fileUrl: string;
        fileName: string;
        fileType: string;
        fileSize: number;
      }>('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        const isImage = res.data.fileType.startsWith('image/');
        const payload: Record<string, unknown> = {
          receiverId: targetUser.id,
          fileUrl: res.data.fileUrl,
          fileName: res.data.fileName,
          fileType: res.data.fileType,
          fileSize: res.data.fileSize,
        };
        if (isImage) payload.imageUrl = res.data.fileUrl;
        const msgRes = await api.post<{ success: boolean; data: Message }>('/messages', payload);

        if (msgRes.data.success) {
          setMessages(prev => [...prev, msgRes.data.data]);
          setTimeout(() => scrollToBottom('smooth'), 100);
        }
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 413) {
        showError('File is too large. Maximum upload size is 500MB.');
        return;
      }
      const msg = err?.response?.data?.message || err?.message || 'File upload failed';
      showError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
    if (e.target) e.target.value = '';
  };

  const stageFile = (file: File) => {
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPendingFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPendingFilePreview(null);
    }
  };

  const clearPendingFile = () => {
    setPendingFile(null);
    setPendingFilePreview(null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          stageFile(file);
        }
      }
    }
  };

  const handleStartCall = () => {
    setIsVideoCallOpen(true);
    if (socket) {
      socket.emit('video:call:initiate', {
        targetUserId: targetUser.id,
        callerName: `${localStorage.getItem('firstName') || 'Team Member'} ${localStorage.getItem('lastName') || ''}`
      });
    }
  };

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const getEditorText = () => editorRef.current?.innerText?.trim() || '';

  const handleEditorInput = () => {
    const text = getEditorText();
    setInputValue(text);

    // @mention detection
    const fullText = editorRef.current?.innerText || '';
    const lastAtIdx = fullText.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || fullText[lastAtIdx - 1] === ' ' || fullText[lastAtIdx - 1] === '\n')) {
      const query = fullText.slice(lastAtIdx + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setShowMentions(true);
        setMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    // typing indicator
    if (socket && text) {
      if (!isTypingSentRef.current) {
        socket.emit('typing:start', { targetUserId: targetUser.id });
        isTypingSentRef.current = true;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { targetUserId: targetUser.id });
        isTypingSentRef.current = false;
      }, 2000);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
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
      const html = editorRef.current?.innerHTML || '';
      const text = getEditorText();
      if ((!text && !pendingFile) || isSending) return;
      // Use the HTML content for rich messages
      setInputValue(text);
      handleSendMessage();
      if (editorRef.current) editorRef.current.innerHTML = '';
      setInputValue('');
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) stageFile(file);
          return;
        }
      }
    }
    // Paste as plain text
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // ═══ Emoji Picker ═══
  const EMOJI_LIST = [
    ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋'],
    ['😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪'],
    ['🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟'],
    ['👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✌️','🤟','🤘','👌','🤌','🤏','👈','👉'],
    ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️'],
    ['🔥','⭐','🌟','✨','💫','🎉','🎊','🎈','🎁','🏆','🥇','🏅','🎯','🚀','💪','👀','🧠','💡','📌','✅'],
  ];

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, emoji);
    setShowEmojiPicker(false);
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // ═══ Audio Recording ═══
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        // Upload via existing file upload logic
        const formData = new FormData();
        formData.append('file', file);
        try {
          setIsUploading(true);
          const res = await api.post('/messages/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (res.data?.url) {
            await api.post('/messages', {
              receiverId: targetUser.id,
              content: '🎤 Voice message',
              fileUrl: res.data.url,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
            });
          }
        } catch (err) {
          console.error('Audio upload failed:', err);
          showError('Failed to send voice message');
        } finally {
          setIsUploading(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setAudioTimer(0);
      audioTimerRef.current = setInterval(() => setAudioTimer(t => t + 1), 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
      showError('Microphone access denied');
    }
  };

  const stopAudioRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecordingAudio(false);
    if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
    setAudioTimer(0);
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecordingAudio(false);
    if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
    setAudioTimer(0);
  };

  const formatAudioTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ═══ Clear Chat ═══
  const handleClearChat = async () => {
    try {
      setIsClearingChat(true);
      const res = await api.delete<{ success: boolean }>(`/messages/conversation/${targetUser.id}`);
      if (res.data.success) {
        setMessages([]);
        setShowClearConfirm(false);
        setShowMoreMenu(false);
      }
    } catch (err) {
      console.error('Clear chat failed:', err);
      showError('Failed to clear chat');
    } finally {
      setIsClearingChat(false);
    }
  };

  // ═══ Delete Selected Messages ═══
  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) return;
    try {
      setIsDeletingSelected(true);
      const res = await api.delete<{ success: boolean }>('/messages/batch', { data: { messageIds: Array.from(selectedMessages) } });
      if (res.data.success) {
        setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));
        setSelectedMessages(new Set());
        setIsSelectMode(false);
        setConfirmDeleteSelectedOpen(false);
      }
    } catch (err) {
      console.error('Delete messages failed:', err);
      showError('Failed to delete messages');
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const toggleMessageSelect = (msgId: string) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // Close more menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // ═══ Video Upload ═══
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stageFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full w-full text-gray-900 dark:text-gray-100 relative overflow-hidden transition-colors duration-300" style={{ fontFamily: 'Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, Ubuntu, Cantarell, Fira Sans, sans-serif' }}>
      {/* ═══ Header ═══ */}
      <header className="flex items-center justify-between px-3 sm:px-10 py-[10px] min-h-[60px] sm:min-h-[100px] bg-[#f0f2f5] dark:bg-[#202c33] shrink-0 z-20 border-b border-[#d1d7db] dark:border-[#313d45]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button onClick={onBack} className="sm:hidden w-8 h-8 flex items-center justify-center text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9ebee] dark:hover:bg-[#374045] rounded-full transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <div className="relative cursor-pointer shrink-0">
            <ChatAvatar colorIdx={targetUser.colorIdx || 0} initials={initials} avatarUrl={targetUser.avatarUrl} />
            {onlineUsers?.has(targetUser.id) && (
              <div className="absolute bottom-0 right-0 w-[12px] h-[12px] rounded-full border-[2px] border-[#f0f2f5] dark:border-[#202c33] bg-[#25d366]" />
            )}
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-[16px] font-normal text-[#111b21] dark:text-[#e9edef] truncate leading-tight">{targetUser?.name || 'User'}</span>
            <span className="text-[13px] text-[#667781] dark:text-[#8696a0] leading-tight">
              {isTyping ? (
                <span className="text-[#25d366]">typing...</span>
              ) : onlineUsers?.has(targetUser.id) ? 'online' : 'offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0 shrink-0">
          <button onClick={handleStartCall} title="Video call" className="w-10 h-10 flex items-center justify-center text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9ebee] dark:hover:bg-[#374045] rounded-full transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor">
              <path d="M15.9 3.29c-.27-.12-.56-.19-.86-.19H3.96c-.83 0-1.5.67-1.5 1.5v7.8c0 .83.67 1.5 1.5 1.5h11.08c.3 0 .59-.07.86-.19l4.56-2.08c.6-.27.98-.86.98-1.52V6.89c0-.66-.39-1.25-.98-1.52L15.9 3.29z"/>
            </svg>
          </button>
          <button onClick={() => setIsScreenMonitoringOpen(true)} title="Screen share" className="hidden sm:flex w-10 h-10 items-center justify-center text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9ebee] dark:hover:bg-[#374045] rounded-full transition-colors">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M20 3H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h7v2H8v2h8v-2h-3v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H4V5h16v10z"/>
            </svg>
          </button>
          <div className="relative" ref={moreMenuRef}>
            <button onClick={() => setShowMoreMenu(p => !p)} className="w-10 h-10 flex items-center justify-center text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9ebee] dark:hover:bg-[#374045] rounded-full transition-colors" title="More options">
              <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-[200px] bg-white dark:bg-[#233138] rounded-md shadow-lg border border-[#d1d7db] dark:border-[#313d45] z-30 py-1 overflow-hidden">
                <button
                  onClick={() => { setIsSelectMode(p => !p); setSelectedMessages(new Set()); setShowMoreMenu(false); }}
                  className="w-full text-left px-4 py-[10px] text-[14.5px] text-[#111b21] dark:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] transition-colors flex items-center gap-3"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>
                  {isSelectMode ? 'Cancel Selection' : 'Select Messages'}
                </button>
                <button
                  onClick={() => { setShowClearConfirm(true); setShowMoreMenu(false); }}
                  className="w-full text-left px-4 py-[10px] text-[14.5px] text-[#e13b3b] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] transition-colors flex items-center gap-3"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  Clear Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══ Chat messages area ═══ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden wa-chat-bg">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="bg-[#fffeea] dark:bg-[#182229] rounded-[7.5px] px-[12px] py-[5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-w-[360px] text-center">
                <svg className="w-5 h-5 text-[#deb73b] mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <p className="text-[12.5px] text-[#54656f] dark:text-[#8696a0] leading-[18px]">
                  Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
                </p>
              </div>
            </div>
          ) : (
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-[3%] sm:px-[6%] lg:px-[9%] py-3 wa-scrollbar relative">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === currentUserId;
                const showDate = shouldShowDateSeparator(messages, idx);
                const nextMsg = messages[idx + 1];
                const prevMsg = messages[idx - 1];
                const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId || showDate;
                const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId || shouldShowDateSeparator(messages, idx + 1);

                return (
                  <React.Fragment key={msg.id}>
                    {/* Date pill */}
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="bg-white dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[12.5px] px-[12px] py-[5px] rounded-[7.5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
                          {formatDateSeparator(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* Bubble row */}
                    <div
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-[12px]' : 'mt-[2px]'} ${isSelectMode ? 'cursor-pointer' : ''}`}
                      onClick={isSelectMode ? () => toggleMessageSelect(msg.id) : undefined}
                    >
                      {/* Select checkbox */}
                      {isSelectMode && (
                        <div className="flex items-center pr-2 shrink-0">
                          <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center transition-colors ${selectedMessages.has(msg.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-[#8696a0]'}`}>
                            {selectedMessages.has(msg.id) && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            )}
                          </div>
                        </div>
                      )}
                      <div
                        className={`relative max-w-[65%] sm:max-w-[55%] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
                          isMe
                            ? `bg-[#d9fdd3] dark:bg-[#005c4b] ${isFirstInGroup ? 'rounded-[7.5px] rounded-tr-0' : 'rounded-[7.5px]'}`
                            : `bg-white dark:bg-[#202c33] ${isFirstInGroup ? 'rounded-[7.5px] rounded-tl-0' : 'rounded-[7.5px]'}`
                        }`}
                      >
                        {/* Tail */}
                        {isFirstInGroup && isMe && <span className="bubble-tail-right" />}
                        {isFirstInGroup && !isMe && <span className="bubble-tail-left" />}

                        {/* Sender name */}
                        {!isMe && isFirstInGroup && (
                          <p className="text-[12.5px] font-medium text-[#06cf9c] px-[9px] pt-[6px] pb-0 leading-none">{targetUser.name}</p>
                        )}

                        {/* Text message */}
                        {msg.text && !msg.fileUrl && (
                          <div className="px-[9px] pt-[6px] pb-[8px]">
                            <span className="text-[14.2px] leading-[19px] text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap break-words">
                              {msg.text.split(/(@\w+)/g).map((part, i) => 
                                part.startsWith('@') ? (
                                  <span key={i} className="text-blue-600 dark:text-blue-400 font-bold">{part}</span>
                                ) : part
                              )}
                            </span>
                            <span className="float-right relative top-[4px] ml-[8px] flex items-center gap-[3px] whitespace-nowrap">
                              <span className="text-[11px] leading-none text-[#667781] dark:text-[#ffffff99]">{formatTime(msg.createdAt)}</span>
                              {isMe && <MessageTicks readAt={msg.readAt} isOnline={!!onlineUsers?.has(targetUser.id)} />}
                            </span>
                          </div>
                        )}

                        {/* File / image */}
                        {msg.fileUrl && (
                          <div className="px-[4px] pt-[4px] pb-[8px]">
                            <FilePreview
                              name={msg.fileName || 'file'}
                              size={msg.fileSize}
                              type={msg.fileType}
                              url={msg.fileUrl}
                              onPreview={(url, name) => { setImagePreview({ url, name }); setPreviewZoom(1); }}
                            />
                            <div className="flex justify-end items-center gap-[3px] px-[5px] mt-1">
                              <span className="text-[11px] text-[#667781] dark:text-[#ffffff99]">{formatTime(msg.createdAt)}</span>
                              {isMe && <MessageTicks readAt={msg.readAt} isOnline={!!onlineUsers?.has(targetUser.id)} />}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start mt-3">
                  <div className="bg-white dark:bg-[#202c33] rounded-[7.5px] rounded-tl-0 px-4 py-[10px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative">
                    <span className="bubble-tail-left" />
                    <div className="flex gap-[5px]">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ═══ Rich Input Bar ═══ */}
      <div
        className="shrink-0 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#202c33] px-[3%] sm:px-[6%] lg:px-[9%] py-3 relative"
        onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); inputDragCounter.current++; setInputDragging(true); } }}
        onDragLeave={() => { inputDragCounter.current--; if (inputDragCounter.current === 0) setInputDragging(false); }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          inputDragCounter.current = 0;
          setInputDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) stageFile(file);
        }}
      >
        {/* Drag overlay */}
        {inputDragging && (
          <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center rounded-lg border-2 border-dashed border-[#00a884] bg-[#d9fdd3]/90 dark:bg-[#005c4b]/80 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 select-none">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#00a884]">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span className="text-sm font-bold text-[#008069] dark:text-[#00a884]">Drop to attach file</span>
            </div>
          </div>
        )}
        {/* Emoji picker popup — outside overflow container */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-full left-2 right-2 sm:left-[6%] sm:right-auto lg:left-[9%] mb-1 w-auto sm:w-[340px] max-w-[calc(100vw-1rem)] bg-white dark:bg-[#2a2d31] rounded-lg shadow-lg border border-[#e0e0e0] dark:border-[#4a4a4a] z-[100] p-2">
            <div className="text-[11px] font-semibold text-[#616061] dark:text-[#ababad] px-1 mb-1">Frequently used</div>
            {EMOJI_LIST.map((row, ri) => (
              <div key={ri} className="flex flex-wrap">
                {row.map((emoji, ei) => (
                  <button key={ei} onClick={() => insertEmoji(emoji)} className="w-[30px] h-[30px] flex items-center justify-center text-[20px] hover:bg-[#f0f0f0] dark:hover:bg-[#383a3e] rounded transition-colors cursor-pointer">
                    {emoji}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          {/* @Mention Dropdown */}
          {showMentions && filteredMentionMembers.length > 0 && (
            <div ref={mentionRef} className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-white dark:bg-[#1a1d21] border border-[#d0d0d0] dark:border-[#565856] rounded-lg shadow-xl max-h-[200px] overflow-y-auto">
              <div className="px-3 py-1.5 border-b border-[#e8e8e8] dark:border-[#383a3e] bg-[#f8f8f8] dark:bg-[#222529]">
                <span className="text-[10px] font-bold text-[#616061] dark:text-[#ababad] uppercase tracking-wider">People</span>
              </div>
              {filteredMentionMembers.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => insertMention(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f0f0f0] dark:hover:bg-[#2a2d31] transition-colors text-left ${idx === mentionIndex ? 'bg-[#e8f5e9] dark:bg-[#1b3a2d]' : ''}`}
                  title={`Mention ${m.firstName}`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {m.firstName?.[0]}{m.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#1d1c1d] dark:text-[#d1d2d3] truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-[11px] text-[#616061] dark:text-[#8b8b8d] truncate">{m.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        <div className="mx-auto rounded-[12px] border border-[#e9edef] dark:border-[#2a3942] overflow-hidden bg-white dark:bg-[#2a3942] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          {/* Pending file preview */}
          {pendingFile && (
            <div className="flex items-center gap-3 px-3 py-2 border-b border-[#e8e8e8] dark:border-[#383a3e] bg-[#f0f2f5] dark:bg-[#182229]">
              {pendingFilePreview ? (
                <img src={pendingFilePreview} alt="preview" className="w-12 h-12 rounded object-cover" />
              ) : (
                <div className="w-10 h-10 rounded bg-[#d9fdd3] dark:bg-[#005c4b] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#111b21] dark:text-[#e9edef]">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#111b21] dark:text-[#e9edef] truncate">{pendingFile.name}</p>
                <p className="text-[11px] text-[#667781] dark:text-[#8696a0]">{(pendingFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={clearPendingFile} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#d1d7db] dark:hover:bg-[#374045] text-[#54656f] dark:text-[#aebac1]" title="Remove file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          )}
          {showFormatting && (
            <div className="flex items-center gap-[2px] px-3 py-[6px] border-b border-[#f0f2f5] dark:border-[#222d34] bg-[#f7f8fa] dark:bg-[#222d34]">
            <button onClick={() => execFormat('bold')} className="chat-toolbar-btn" title="Bold"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg></button>
            <button onClick={() => execFormat('italic')} className="chat-toolbar-btn" title="Italic"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg></button>
            <button onClick={() => execFormat('underline')} className="chat-toolbar-btn" title="Underline"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg></button>
            <button onClick={() => execFormat('strikeThrough')} className="chat-toolbar-btn" title="Strikethrough"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg></button>
            <div className="w-px h-4 bg-[#d0d0d0] dark:bg-[#4a4a4a] mx-1" />
            <button onClick={() => { const url = prompt('Enter URL:'); if (url) execFormat('createLink', url); }} className="chat-toolbar-btn" title="Link"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg></button>
            <button onClick={() => execFormat('insertOrderedList')} className="chat-toolbar-btn" title="Ordered list"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg></button>
            <button onClick={() => execFormat('insertUnorderedList')} className="chat-toolbar-btn" title="Bulleted list"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg></button>
            <div className="w-px h-4 bg-[#d0d0d0] dark:bg-[#4a4a4a] mx-1" />
            <button onClick={() => execFormat('formatBlock', 'blockquote')} className="chat-toolbar-btn" title="Blockquote"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg></button>
            <button onClick={() => { execFormat('insertHTML', '<code style="background:#f1f1f1;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:13px">code</code>'); }} className="chat-toolbar-btn" title="Inline code"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg></button>
            <button onClick={() => { execFormat('insertHTML', '<pre style="background:#f1f1f1;padding:8px;border-radius:4px;font-family:monospace;font-size:13px;white-space:pre-wrap">code block</pre>'); }} className="chat-toolbar-btn" title="Code block"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/><rect x="10" y="11" width="4" height="2" rx="1"/></svg></button>
          </div>
        )}

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onKeyDown={handleEditorKeyDown}
          onPaste={handleEditorPaste}
          data-placeholder={`Message ${targetUser?.name || 'User'}`}
          className="chat-rich-editor min-h-[44px] max-h-[140px] overflow-y-auto px-4 py-[10px] text-[15px] leading-[22px] text-[#111b21] dark:text-[#e9edef] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[#8696a0] dark:empty:before:text-[#8696a0] empty:before:pointer-events-none"
        />
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} title="Upload a file" />
        <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} title="Upload video" />

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-3 py-[6px] border-t border-[#f0f2f5] dark:border-[#222d34] bg-white dark:bg-[#2a3942] relative">
          {/* Audio recording bar */}
          {isRecordingAudio ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <button onClick={cancelAudioRecording} className="chat-toolbar-btn !text-red-500" title="Cancel">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[13px] font-mono text-[#616061] dark:text-[#ababad]">{formatAudioTime(audioTimer)}</span>
                </div>
                <div className="flex-1 h-[3px] bg-[#e0e0e0] dark:bg-[#4a4a4a] rounded-full mx-2 overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full animate-pulse" style={{ width: `${Math.min((audioTimer / 120) * 100, 100)}%` }} />
                </div>
              </div>
              <button onClick={stopAudioRecording} className="chat-toolbar-btn !text-[#00a884] dark:!text-[#00a884]" title="Send voice message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-[2px]">
                {/* Plus / Add */}
                <button onClick={() => fileInputRef.current?.click()} className="chat-toolbar-btn" title="Add attachment">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                </button>
                {/* Aa - Toggle formatting */}
                <button onClick={() => setShowFormatting(p => !p)} className={`chat-toolbar-btn ${showFormatting ? 'chat-toolbar-btn-active' : ''}`} title="Text formatting">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9.93 13.5h4.14L12 7.98 9.93 13.5zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5l-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z"/></svg>
                </button>
                {/* Emoji */}
                <button onClick={() => setShowEmojiPicker(p => !p)} className={`chat-toolbar-btn ${showEmojiPicker ? 'chat-toolbar-btn-active' : ''}`} title="Emoji">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                </button>
                {/* Mention @ */}
                <button onClick={() => { editorRef.current?.focus(); document.execCommand('insertText', false, '@'); setShowMentions(true); setMentionQuery(''); }} className="chat-toolbar-btn" title="Mention someone">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>
                </button>
                {/* Video clip */}
                <button onClick={() => videoInputRef.current?.click()} className="chat-toolbar-btn" title="Upload video clip">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                </button>
                {/* Mic */}
                <button onClick={startAudioRecording} className="chat-toolbar-btn" title="Record voice message">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
                </button>
                <div className="w-px h-4 bg-[#d0d0d0] dark:bg-[#4a4a4a] mx-1" />
                {/* Shortcut / Task */}
                <button onClick={() => { editorRef.current?.focus(); document.execCommand('insertHTML', false, '<div><input type="checkbox" disabled /> Task item</div>'); }} className="chat-toolbar-btn" title="Add task checklist">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </button>
              </div>
              <div className="flex items-center gap-[2px]">
                {/* Send */}
                <button
                  onClick={() => {
                    const text = getEditorText();
                    if ((!text && !pendingFile) || isSending) return;
                    setInputValue(text);
                    handleSendMessage();
                    if (editorRef.current) editorRef.current.innerHTML = '';
                    setInputValue('');
                  }}
                  disabled={(!inputValue.trim() && !pendingFile) || isSending}
                  className="chat-toolbar-btn !text-[#00a884] hover:!bg-[#00a884]/10 disabled:!text-[#8696a0]/40 disabled:hover:!bg-transparent"
                  title="Send message"
                >
                  {isSending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  )}
                </button>
                {/* Schedule */}
                <button className="chat-toolbar-btn" title="Schedule message">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                </button>
              </div>
            </>
          )}
        </div>
        </div>
        </div>
      </div>
      {isVideoCallOpen && (
        <VideoCallModal
          onClose={() => setIsVideoCallOpen(false)}
          targetUser={{
            name: targetUser.name,
            initials,
            color: avatarColor
          }}
        />
      )}
      {isScreenMonitoringOpen && (
        <ScreenShareModal
          onClose={() => setIsScreenMonitoringOpen(false)}
          targetUser={{
            id: targetUser.id,
            name: targetUser.name,
            initials,
            color: avatarColor
          }}
        />
      )}

      <ConfirmDialog
        open={showClearConfirm}
        title="Are you sure?"
        description="All messages will be permanently deleted for both sides. This cannot be undone."
        confirmText="Clear Chat"
        cancelText="Cancel"
        tone="danger"
        isBusy={isClearingChat}
        busyLabel="Clearing..."
        onClose={() => { if (!isClearingChat) setShowClearConfirm(false); }}
        onConfirm={handleClearChat}
      />

      <ConfirmDialog
        open={confirmDeleteSelectedOpen}
        title="Are you sure?"
        description={`Do you want to delete ${selectedMessages.size} selected message${selectedMessages.size === 1 ? '' : 's'}?`}
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        isBusy={isDeletingSelected}
        busyLabel="Deleting..."
        onClose={() => { if (!isDeletingSelected) setConfirmDeleteSelectedOpen(false); }}
        onConfirm={handleDeleteSelected}
      />

      {/* ═══ Select Mode Floating Bar ═══ */}
      {isSelectMode && (
        <div className="absolute bottom-[70px] left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 bg-white dark:bg-[#233138] rounded-full shadow-lg border border-[#d1d7db] dark:border-[#313d45] px-5 py-2">
          <span className="text-[13px] text-[#667781] dark:text-[#8696a0] font-medium">{selectedMessages.size} selected</span>
          <button
            onClick={() => setConfirmDeleteSelectedOpen(true)}
            disabled={selectedMessages.size === 0}
            className="flex items-center gap-1.5 px-3 py-[5px] rounded-full text-[13px] font-medium text-white bg-[#e13b3b] hover:bg-[#c62828] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Delete
          </button>
          <button
            onClick={() => { setIsSelectMode(false); setSelectedMessages(new Set()); }}
            className="flex items-center gap-1.5 px-3 py-[5px] rounded-full text-[13px] font-medium text-[#667781] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      {/* ═══ Image Lightbox ═══ */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md"
          onClick={() => setImagePreview(null)}
        >
          {/* Toolbar */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-10"
            onClick={e => e.stopPropagation()}
          >
            {/* Zoom in */}
            <button
              onClick={() => setPreviewZoom(z => Math.min(z + 0.25, 4))}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 transition-colors"
              title="Zoom in"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            {/* Zoom out */}
            <button
              onClick={() => setPreviewZoom(z => Math.max(z - 0.25, 0.5))}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 transition-colors"
              title="Zoom out"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            {/* Download */}
            <button
              onClick={async e => {
                e.stopPropagation();
                try {
                  const res = await fetch(imagePreview.url);
                  const blob = await res.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = blobUrl;
                  a.download = imagePreview.name || 'image';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                } catch {
                  const a = document.createElement('a');
                  a.href = imagePreview.url;
                  a.download = imagePreview.name || 'image';
                  a.click();
                }
              }}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 transition-colors"
              title="Download"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={() => setImagePreview(null)}
              className="w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center border border-red-400 transition-colors"
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* File name */}
          <div className="absolute top-4 left-4 z-10">
            <p className="text-white/70 text-[13px] font-medium">{imagePreview.name}</p>
          </div>
          {/* Image */}
          <img
            src={imagePreview.url}
            alt={imagePreview.name}
            style={{ transform: `scale(${previewZoom})`, transition: 'transform 0.2s ease' }}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});
