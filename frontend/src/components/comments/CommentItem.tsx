import React from 'react';
import { cn } from '../../utils/cn';
import { useAppSelector } from '../../store';
import { Avatar } from '../ui/Avatar';

interface CommentItemProps {
  comment: {
    id: string;
    text: string;
    createdAt: string;
    userId: string;
    user: {
      firstName: string;
      lastName: string;
      avatarUrl?: string | null;
    };
    fileUrl?: string | null;
    fileName?: string | null;
    fileType?: string | null;
    fileSize?: number | null;
    imageUrl?: string | null;
  };
  onDelete?: (id: string) => void;
  onPreviewImage?: (url: string, name: string) => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({ comment, onDelete, onPreviewImage }) => {
  const currentUser = useAppSelector(state => state.user.currentUser);
  const isMine = currentUser?.id === comment.userId;

  const renderFile = () => {
    const url = comment.fileUrl || comment.imageUrl;
    const name = comment.fileName || 'Attachment';
    const isImage = comment.fileType?.startsWith('image/') || !!comment.imageUrl;

    if (!url) return null;

    if (isImage) {
      return (
        <div className="mt-2 relative group-img max-w-sm rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
          <img 
            src={url} 
            alt={name} 
            className="w-full h-auto cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => onPreviewImage?.(url, name)}
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a 
              href={url} 
              download={name}
              className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-md shadow-sm hover:text-indigo-500"
              onClick={e => e.stopPropagation()}
              title={`Download ${name}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </a>
          </div>
        </div>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:border-indigo-200 transition-colors w-fit group-file"
      >
        <div className="p-1.5 bg-white dark:bg-gray-800 rounded shadow-sm text-indigo-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        </div>
        <div className="min-w-0 pr-2">
          <div className="text-[12px] font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{name}</div>
          {comment.fileSize && (
            <div className="text-[10px] text-gray-400">{(comment.fileSize / 1024).toFixed(1)} KB</div>
          )}
        </div>
      </a>
    );
  };

  return (
    <div className={cn("flex gap-3 px-4 py-2 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group/comment", isMine && "flex-row-reverse")}>
      <div className="shrink-0 pt-1">
        <Avatar firstName={comment.user.firstName} lastName={comment.user.lastName} avatarUrl={comment.user.avatarUrl} size="sm" />
      </div>

      <div className={cn("flex flex-col min-w-0 max-w-[80%]", isMine && "items-end")}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100">
            {isMine ? 'You' : `${comment.user.firstName} ${comment.user.lastName}`}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className={cn(
          "px-3 py-2 rounded-2xl text-[14px] leading-relaxed shadow-sm",
          isMine 
            ? "bg-indigo-600 text-white rounded-tr-none" 
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none"
        )}>
          {comment.text}
          {renderFile()}
        </div>

        {onDelete && isMine && (
          <button 
            onClick={() => onDelete(comment.id)}
            className="mt-1 text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover/comment:opacity-100 transition-opacity"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
