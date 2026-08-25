import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useOrgRole } from '../../hooks/useOrgRole';
import { useAppSelector } from '../../store';
import { STATUS_CONFIG } from '../../pages/lists/ListPage';

interface SearchTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  updatedAt: string;
  project?: { id: string; name: string };
}

interface SearchProject {
  id: string;
  name: string;
  status: string;
  description: string | null;
  updatedAt: string;
  _count: { tasks: number };
}

interface SearchOrganization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface SearchFolder {
  id: string;
  name: string;
  color: string | null;
  spaceId: string;
  updatedAt: string;
  space: { id: string; name: string };
}

interface SearchList {
  id: string;
  name: string;
  color: string | null;
  spaceId: string;
  updatedAt: string;
  space: { id: string; name: string };
}

interface SearchAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  taskId: string;
  createdAt: string;
  task: { id: string; title: string };
}


interface SearchResults {
  tasks: SearchTask[];
  projects: SearchProject[];
  organizations: SearchOrganization[];
  folders: SearchFolder[];
  lists: SearchList[];
  attachments: SearchAttachment[];
}

type FilterTab = 'all' | 'tasks' | 'projects' | 'organizations' | 'pages' | 'folders' | 'lists' | 'attachments';

interface PageItem {
  name: string;
  path: string;
  icon: string;
  description: string;
}

const PAGES: PageItem[] = [
  { name: 'Home', path: '/', icon: 'home', description: 'Dashboard overview' },
  { name: 'Inbox', path: '/organizations', icon: 'inbox', description: 'Messages & notifications' },
  { name: 'Assigned to me', path: '/tasks/assigned', icon: 'user', description: 'Tasks assigned to you' },
  { name: 'Today & Overdue', path: '/tasks/overdue', icon: 'calendar', description: 'Overdue and due today' },
  { name: 'All Projects', path: '/projects', icon: 'folder', description: 'View all projects' },
  { name: 'Organizations', path: '/organizations', icon: 'building', description: 'Manage organizations' },
  { name: 'Settings', path: '/settings', icon: 'settings', description: 'Account settings' },
];

// Pages visible to limited-access roles (no admin-level pages)
const PERSONAL_PAGES: PageItem[] = [
  { name: 'Home', path: '/', icon: 'home', description: 'Dashboard overview' },
  { name: 'Inbox', path: '/organizations', icon: 'inbox', description: 'Messages & notifications' },
  { name: 'Assigned to me', path: '/tasks/assigned', icon: 'user', description: 'Tasks assigned to you' },
  { name: 'Today & Overdue', path: '/tasks/overdue', icon: 'calendar', description: 'Overdue and due today' },
  { name: 'Settings', path: '/settings', icon: 'settings', description: 'Account settings' },
];

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-400',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/50 text-inherit bg-opacity-70 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ListIcon({ color }: { color: string | null }) {
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iconRef.current) {
      iconRef.current.style.backgroundColor = color || 'transparent';
    }
  }, [color]);

  return (
    <div
      ref={iconRef}
      className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-600 transition-colors"
    >
      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </div>
  );
}

// Trigger button for the header
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors group w-full max-w-xs sm:max-w-sm"
    >
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="text-sm text-gray-400 flex-1 text-left truncate">Search</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-sm">
        Ctrl K
      </kbd>
    </button>
  );
}

// Full command palette modal
export function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLimitedMember, isGuest, isMember } = useOrgRole();
  const currentOrgId = useAppSelector((state: any) => state.organization.currentOrg?.id as string | undefined);

  // Role flags for scoping
  const isRestrictedRole = isLimitedMember || isGuest; // sees only personal pages + assigned tasks
  const isMemberRole = isMember;                        // sees personal pages + assigned lists/tasks

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<FilterTab>('tasks');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input and load recent items when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Load recent items immediately
      loadResults('');
    } else {
      setQuery('');
      setResults(null);
      setActiveIndex(-1);
      setActiveTab('tasks');
    }
  }, [isOpen]);

  const loadResults = async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: SearchResults }>('/search', {
        params: { q, ...(currentOrgId ? { orgId: currentOrgId } : {}) },
      });
      setResults(res.data.data);
      setActiveIndex(-1);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadResults(value), 300);
  };

  // Choose page list based on role
  const pageSource = isRestrictedRole || isMemberRole ? PERSONAL_PAGES : PAGES;

  // Filter pages by query
  const matchedPages = query.trim()
    ? pageSource.filter(
        (p: PageItem) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase())
      )
    : pageSource;

  // Tasks are already role-filtered by the backend
  const scopedTasks = results?.tasks || [];

  const scopedLists   = isRestrictedRole ? [] : (results?.lists || []);
  const scopedProjects = (isRestrictedRole || isMemberRole) ? [] : (results?.projects || []);
  const scopedOrgs    = (isRestrictedRole || isMemberRole) ? [] : (results?.organizations || []);
  const scopedAttachments = isRestrictedRole ? [] : (results?.attachments || []);
  const scopedFolders = results?.folders || [];

  // Build flat navigable list based on active tab
  const allItems: { type: string; path: string }[] = [];
  if (activeTab === 'all' || activeTab === 'pages') {
    matchedPages.forEach((p) => allItems.push({ type: 'page', path: p.path }));
  }
  if (activeTab === 'all' || activeTab === 'projects') {
    scopedProjects.forEach((p: SearchProject) => allItems.push({ type: 'project', path: `/projects/${p.id}` }));
  }
  if (activeTab === 'all' || activeTab === 'folders') {
    scopedFolders.forEach((f: SearchFolder) => allItems.push({ type: 'folder', path: `/spaces/${f.spaceId}/dashboard` }));
  }
  if (activeTab === 'all' || activeTab === 'lists') {
    scopedLists.forEach((l: SearchList) => allItems.push({ type: 'list', path: `/lists/${l.id}` }));
  }
  if (activeTab === 'all' || activeTab === 'tasks') {
    scopedTasks.forEach((t: SearchTask) => allItems.push({ type: 'task', path: `/tasks/${t.id}` }));
  }
  if (activeTab === 'all' || activeTab === 'attachments') {
    scopedAttachments.forEach((a: SearchAttachment) => allItems.push({ type: 'attachment', path: `/tasks/${a.taskId}` }));
  }
  if (activeTab === 'all' || activeTab === 'organizations') {
    scopedOrgs.forEach((org: SearchOrganization) => allItems.push({ type: 'org', path: '/organizations' }));
  }

  const goTo = (path: string) => {
    onClose();
    // Open task paths as modal overlay (box type)
    if (path.startsWith('/tasks/')) {
      navigate(path, { state: { backgroundLocation: location } });
    } else {
      navigate(path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (allItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i: number) => (i < allItems.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i: number) => (i > 0 ? i - 1 : allItems.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      goTo(allItems[activeIndex].path);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && resultsRef.current) {
      const el = resultsRef.current.querySelector(`[data-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const filteredPages       = (activeTab === 'all' || activeTab === 'pages')         ? matchedPages       : [];
  const filteredTasks       = (activeTab === 'all' || activeTab === 'tasks')         ? scopedTasks        : [];
  const filteredProjects    = (activeTab === 'all' || activeTab === 'projects')      ? scopedProjects     : [];
  const filteredFolders     = (activeTab === 'all' || activeTab === 'folders')       ? scopedFolders      : [];
  const filteredLists       = (activeTab === 'all' || activeTab === 'lists')         ? scopedLists        : [];
  const filteredAttachments = (activeTab === 'all' || activeTab === 'attachments')   ? scopedAttachments  : [];
  const filteredOrgs        = (activeTab === 'all' || activeTab === 'organizations') ? scopedOrgs         : [];
  const totalFiltered = filteredPages.length + filteredTasks.length + filteredProjects.length + filteredFolders.length + filteredLists.length + filteredAttachments.length + filteredOrgs.length;

  let itemIndex = -1;

  // Build tab list — hide tabs that are always empty for the current role
  const allTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'tasks',         label: 'Tasks',    count: scopedTasks.length },
    { key: 'pages',         label: 'Pages',    count: matchedPages.length },
    ...(!isRestrictedRole ? [{ key: 'lists' as FilterTab, label: 'Lists', count: scopedLists.length }] : []),
    ...(!isRestrictedRole ? [{ key: 'attachments' as FilterTab, label: 'Files', count: scopedAttachments.length }] : []),
    ...((!isRestrictedRole && !isMemberRole) ? [{ key: 'projects' as FilterTab, label: 'Projects', count: scopedProjects.length }] : []),
    ...((!isRestrictedRole && !isMemberRole) ? [{ key: 'organizations' as FilterTab, label: 'Orgs', count: scopedOrgs.length }] : []),
    { key: 'all',           label: 'All',      count: matchedPages.length + scopedTasks.length + scopedProjects.length + scopedFolders.length + scopedLists.length + scopedAttachments.length + scopedOrgs.length },
  ];
  const tabs = allTabs;

  const isRecent = query.trim() === '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-x-4 top-[8vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl z-[61] flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh] w-full pointer-events-auto"
            >
          {/* Search Input */}
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search, run a command, or ask a question..."
                className="w-full pl-11 pr-4 py-3 text-base bg-transparent border-0 focus:outline-none placeholder:text-gray-400 text-gray-900 dark:text-white"
                autoComplete="off"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          {results && (
            <div className="px-4 sm:px-5 py-2 border-b border-gray-200 dark:border-gray-700 flex gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setActiveIndex(-1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? 'bg-gray-900 dark:bg-gray-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] px-1.5 rounded-full ${
                      activeTab === tab.key ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div ref={resultsRef} className="flex-1 overflow-y-auto min-h-0">
            {!results && loading && (
              <div className="px-5 py-8 text-center">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin mx-auto" />
              </div>
            )}

            {results && totalFiltered === 0 && query.trim() !== '' && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No results found for "{query}"
              </div>
            )}

            {totalFiltered > 0 && (
              <div>
                {/* Sort info */}
                <div className="px-4 sm:px-5 py-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-500">
                    {isRecent ? 'Recent' : 'Results'}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    Sort by: Relevance
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>

                {/* Pages */}
                {filteredPages.length > 0 && (
                  <div className="px-4 sm:px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pages</span>
                  </div>
                )}
                {filteredPages.map((page: PageItem) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={`page-${page.path}`}
                      data-index={idx}
                      onClick={() => goTo(page.path)}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-2.5 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                        activeIndex === idx ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                        {page.icon === 'home' && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        )}
                        {page.icon === 'inbox' && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        )}
                        {page.icon === 'user' && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                        {page.icon === 'calendar' && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        {page.icon === 'folder' && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        )}
                        {page.icon === 'building' && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        )}
                        {page.icon === 'settings' && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-900 dark:text-white font-medium">
                          <HighlightText text={page.name} query={query} />
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          <HighlightText text={page.description} query={query} />
                        </span>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}

                {/* Projects — hidden for Member / Guest / Limited */}
                {filteredProjects.length > 0 && (
                  <div className="px-4 sm:px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Projects</span>
                  </div>
                )}
                {filteredProjects.map((project: SearchProject) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={`p-${project.id}`}
                      data-index={idx}
                      onClick={() => goTo(`/projects/${project.id}`)}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                        activeIndex === idx ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <svg className="w-[18px] h-[18px] text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                            <HighlightText text={project.name} query={query} />
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {timeAgo(project.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Folders */}
                {filteredFolders.length > 0 && (
                  <div className="px-4 sm:px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Folders</span>
                  </div>
                )}
                {filteredFolders.map((folder: SearchFolder) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={`f-${folder.id}`}
                      data-index={idx}
                      onClick={() => goTo(`/spaces/${folder.spaceId}/dashboard`)}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                        activeIndex === idx ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <svg className="w-[18px] h-[18px] text-orange-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                            <HighlightText text={folder.name} query={query} />
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            in {folder.space.name}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Lists */}
                {filteredLists.length > 0 && (
                  <div className="px-4 sm:px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Lists</span>
                  </div>
                )}
                {filteredLists.map((list: SearchList) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={`l-${list.id}`}
                      data-index={idx}
                      onClick={() => goTo(`/lists/${list.id}`)}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                        activeIndex === idx ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <ListIcon color={list.color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                            <HighlightText text={list.name} query={query} />
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            in {list.space.name}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Tasks */}
                {filteredTasks.length > 0 && (
                  <div className="px-4 sm:px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tasks</span>
                  </div>
                )}
                {filteredTasks.map((task: SearchTask) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={`t-${task.id}`}
                      data-index={idx}
                      onClick={() => goTo(`/tasks/${task.id}`)}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                        activeIndex === idx ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className={`w-[18px] h-[18px] rounded-full shrink-0 ${STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.dot || 'bg-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} />
                          <span className="text-sm text-gray-900 dark:text-white truncate">
                            <HighlightText text={task.title} query={query} />
                          </span>
                          {task.project && (
                            <span className="text-xs text-gray-400 shrink-0">
                              in {task.project.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-300 shrink-0">·</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {timeAgo(task.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Attachments */}
                {filteredAttachments.length > 0 && (
                  <div className="px-4 sm:px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Attachments</span>
                  </div>
                )}
                {filteredAttachments.map((file: SearchAttachment) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={`a-${file.id}`}
                      data-index={idx}
                      onClick={() => goTo(`/tasks/${file.taskId}`)}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                        activeIndex === idx ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <svg className="w-[18px] h-[18px] text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                            <HighlightText text={file.originalName} query={query} />
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            on {file.task.title}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Organizations */}
                {filteredOrgs.length > 0 && (
                  <div className="px-4 sm:px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Organizations</span>
                  </div>
                )}
                {filteredOrgs.map((org: SearchOrganization) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={`o-${org.id}`}
                      data-index={idx}
                      onClick={() => goTo('/organizations')}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                        activeIndex === idx ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="w-[18px] h-[18px] rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                            <HighlightText text={org.name} query={query} />
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {timeAgo(org.createdAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 sm:px-5 py-2.5 flex items-center justify-between bg-gray-50 dark:bg-gray-800/80">
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[10px] shadow-sm">↑</kbd>
                <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[10px] shadow-sm">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[10px] shadow-sm">↵</kbd>
                to open
              </span>
              <span className="flex items-center gap-1 hidden sm:flex">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[10px] shadow-sm">esc</kbd>
                to close
              </span>
            </div>
            <span className="text-xs text-gray-400 hidden sm:inline">Type / to view commands</span>
          </div>
        </motion.div>
      </div>
    </>
      )}
    </AnimatePresence>
  );
}
