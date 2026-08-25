import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePreview } from './ImagePreview';
import { useAppSelector } from '../../store';
import { useOrgRole } from '../../hooks/useOrgRole';
import api from '../../services/api';

export interface AttachmentData {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
}

interface Props {
  attachment: AttachmentData;
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  canEdit?: boolean;
  baseUrl: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') {
    return (
      <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M10 13l4 4M14 13l-4 4" strokeWidth="2" />
        </svg>
      </div>
    );
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      </div>
    );
  }
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return (
      <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h2v2H8zM12 13h2v2h-2zM8 17h2v2H8z" />
        </svg>
      </div>
    );
  }
  if (mimeType.includes('zip') || mimeType.includes('rar')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
          <path d="M14 2v6h6" />
          <path d="M10 12h4M10 15h4M10 18h4" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-400 dark:text-white">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
        <path d="M14 2v6h6" />
      </svg>
    </div>
  );
}

export function AttachmentItem({ attachment, onDelete, onPreview, onRename, canEdit = true, baseUrl }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(attachment.originalName);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const { isOwner, isReadOnly } = useOrgRole();

  const canDelete = !isReadOnly && canEdit && (isOwner || (currentUser && attachment.uploadedBy && currentUser.id === attachment.uploadedBy.id));
  const canRename = !isReadOnly && canEdit && (isOwner || (currentUser && attachment.uploadedBy && currentUser.id === attachment.uploadedBy.id));

  const imageUrl = `/uploads/${attachment.filename}`;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // Large attachments can exceed the default 30s API timeout — give downloads more room.
      const res = await api.get(`/attachments/${attachment.id}/download`, {
        responseType: 'blob',
        timeout: 120000,
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const triggerDownload = () => {
    handleDownload({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (menuButtonRef.current && menuButtonRef.current.contains(target)) return;
      setMenuOpen(false);
    };
    const onScrollOrResize = () => setMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menuOpen]);

  const openMenu = () => {
    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const menuWidth = 176; // w-44
      const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
      setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setMenuOpen(true);
  };

  // Auto-focus rename input
  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      // Select name without extension
      const dot = attachment.originalName.lastIndexOf('.');
      const end = dot > 0 ? dot : attachment.originalName.length;
      try { inputRef.current.setSelectionRange(0, end); } catch { /* noop */ }
    }
  }, [renaming, attachment.originalName]);

  const handleCopyUrl = async () => {
    setMenuOpen(false);
    // Use the public /uploads/<filename> URL because the /api/v1/attachments/:id/download
    // route requires an Authorization header. The public URL works when pasted in any tab.
    const absoluteUrl = `${window.location.origin}/uploads/${attachment.filename}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = absoluteUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  const startRename = () => {
    setMenuOpen(false);
    setNameDraft(attachment.originalName);
    setRenaming(true);
  };

  const submitRename = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === attachment.originalName) {
      setRenaming(false);
      setNameDraft(attachment.originalName);
      return;
    }
    try {
      if (onRename) {
        await onRename(attachment.id, trimmed);
      } else {
        await api.patch(`/attachments/${attachment.id}`, { originalName: trimmed });
      }
    } catch (err) {
      console.error('Rename failed:', err);
    } finally {
      setRenaming(false);
    }
  };

  return (
    <>
      <div className="group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200">
        
        {/* Thumbnail or Icon */}
        <div 
          className="relative aspect-video w-full overflow-hidden bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-center cursor-pointer"
          onClick={() => attachment.isImage ? onPreview(attachment.id) : triggerDownload()}
        >
          {/* Icon is ALWAYS in the background */}
          <FileTypeIcon mimeType={attachment.mimeType} />
          
          {/* Image sits on top for image attachments */}
          {attachment.isImage && (
            <img
              src={attachment.thumbnailUrl || imageUrl}
              alt={attachment.originalName}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const target = e.currentTarget;
                if (attachment.thumbnailUrl && target.src.includes('thumbnail')) {
                  target.src = imageUrl;
                } else {
                  target.style.display = 'none';
                }
              }}
            />
          )}
          
          {/* Overlay Actions removed - use the kebab menu in top-right instead */}

          {/* Kebab menu (Rename / Copy URL / Download / Delete) */}
          <div className="absolute top-2 right-2 z-20">
            <button
              ref={menuButtonRef}
              onClick={(e) => { e.stopPropagation(); if (menuOpen) setMenuOpen(false); else openMenu(); }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 transition-opacity"
              title="More actions"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
              </svg>
            </button>
          </div>
          {menuOpen && menuPos && createPortal(
            <AnimatePresence>
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                role="menu"
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 1000 }}
                className="w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 text-sm overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {canRename && (
                  <button
                    role="menuitem"
                    onClick={startRename}
                    className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Rename
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={handleCopyUrl}
                  className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5"/></svg>
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>
                <button
                  role="menuitem"
                  onClick={(e) => { setMenuOpen(false); handleDownload(e); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  Download
                </button>
                {canDelete && (
                  <>
                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      Delete
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>,
            document.body
          )}
        </div>

        {/* Info Area */}
        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-center justify-between gap-2">
            {renaming ? (
              <input
                ref={inputRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); submitRename(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setRenaming(false); setNameDraft(attachment.originalName); }
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 text-sm font-semibold bg-white dark:bg-gray-900 border border-indigo-300 dark:border-indigo-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600"
              />
            ) : (
              <button
                onClick={() => attachment.isImage ? onPreview(attachment.id) : triggerDownload()}
                className="text-sm text-gray-700 dark:text-gray-200 font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 truncate block text-left"
              >
                {attachment.originalName}
              </button>
            )}
            
            {/* Inline delete button removed (use menu instead) */}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mt-1">
            <span>{formatSize(attachment.size)}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>{formatDate(attachment.createdAt)}</span>
          </div>

          {/* Confirm Delete Overlay */}
          <AnimatePresence>
            {confirmDelete && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-50 bg-rose-600/95 flex flex-col items-center justify-center p-4 text-center backdrop-blur-md rounded-xl"
              >
                 <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                 </div>
                 <p className="text-sm font-black text-white uppercase tracking-widest mb-4">Execute Deletion?</p>
                 <div className="flex items-center gap-2 w-full">
                   <button
                     onClick={() => { onDelete(attachment.id); setConfirmDelete(false); }}
                     className="flex-1 py-1.5 bg-white text-rose-600 text-sm font-black uppercase tracking-widest rounded-lg hover:bg-gray-100 transition-all shadow-lg shadow-black/20"
                   >
                     KILL
                   </button>
                   <button
                     onClick={() => setConfirmDelete(false)}
                     className="flex-1 py-1.5 bg-black/20 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black/30 transition-all"
                   >
                     HALT
                   </button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* List mode actions removed (Download icon removed) */}
      </div>
    </>
  );
}
