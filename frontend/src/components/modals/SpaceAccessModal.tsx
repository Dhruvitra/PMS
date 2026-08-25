import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../ui/Toast';
import { User } from '../../types/user.types';
import { Space } from '../../types';

interface SpaceAccessModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  organizationId: string;
}

const SpaceAccessModal: React.FC<SpaceAccessModalProps> = ({
  open,
  onClose,
  user,
  organizationId,
}) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open && organizationId && user) {
      loadData();
    }
  }, [open, organizationId, user]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load all spaces in org (now includes folders and lists)
      const spacesRes = await api.get(`/spaces/org/${organizationId}`);
      const allSpaces: (Space & { folders?: any[], lists?: any[] })[] = spacesRes.data.data;

      // 2. Load granular memberships for this user
      if (user?.id) {
        const membershipsRes = await api.get(`/spaces/org/${organizationId}/granular-memberships/${user.id}`);
        const { spaceIds, folderIds, listIds } = membershipsRes.data.data;
        setSelectedSpaces(spaceIds || []);
        setSelectedFolders(folderIds || []);
        setSelectedLists(listIds || []);
      }

      // 3. The hierarchy is already included in allSpaces from the backend
      setSpaces(allSpaces);
    } catch (err: any) {
      console.error('[SpaceAccessModal] loadData failed:', err);
      setError(`Failed to load: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSpace = (spaceId: string) => {
    setSelectedSpaces((prev) =>
      prev.includes(spaceId)
        ? prev.filter((id) => id !== spaceId)
        : [...prev, spaceId]
    );
  };

  const handleToggleFolder = (folderId: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const handleToggleList = (listId: string) => {
    setSelectedLists((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    );
  };

  const handleSave = async () => {
    if (!user || !organizationId) return;
    setSaving(true);
    try {
      await api.post(`/spaces/org/${organizationId}/granular-memberships/${user.id}`, {
        spaceIds: selectedSpaces,
        folderIds: selectedFolders,
        listIds: selectedLists,
      });
      success('Access permissions updated successfully');
      onClose();
    } catch (err) {
      toastError('Failed to update access permissions');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Manage Access</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide">Loading access permissions...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] block">Assign Hierarchy</label>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 rounded">
                    {selectedSpaces.length} Spaces
                  </span>
                  <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-[10px] font-bold text-purple-600 dark:text-purple-400 rounded">
                    {selectedFolders.length} Folders
                  </span>
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 rounded">
                    {selectedLists.length} Lists
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {spaces.map((space: any) => {
                  const isSpaceSelected = selectedSpaces.includes(space.id);
                  return (
                    <div key={space.id} className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                      <div
                        className={`flex items-center gap-3 p-4 transition-colors ${isSpaceSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : 'bg-white dark:bg-transparent'
                          }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-sm"
                          {...{ style: { backgroundColor: space.color || '#4F46E5' } }}
                        >
                          {space.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{space.name}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Space</p>
                        </div>
                        <button
                          onClick={() => handleToggleSpace(space.id)}
                          title="Toggle Access"
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isSpaceSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-transparent hover:text-gray-300'
                            }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      </div>

                      {isSpaceSelected && (
                        <div className="px-4 py-3 bg-gray-50/50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-800 space-y-4">
                          {/* Lists directly in space */}
                          {space.lists && space.lists.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pl-2">Space Lists</label>
                              <div className="grid grid-cols-1 gap-1.5">
                                {space.lists.map((list: any) => {
                                  const isSelected = selectedLists.includes(list.id);
                                  return (
                                    <button
                                      key={list.id}
                                      onClick={() => handleToggleList(list.id)}
                                      className={`flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-100'
                                        }`}
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full shrink-0" {...{ style: { backgroundColor: space.color } }} />
                                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{list.name}</span>
                                      <div className={`w-4 h-4 rounded-md flex items-center justify-center ${isSelected ? 'text-blue-600' : 'text-transparent'}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Folders and their lists */}
                          {space.folders && space.folders.length > 0 && (
                            <div className="space-y-3">
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pl-2">Folders & Lists</label>
                              {space.folders.map((folder: any) => {
                                const isFolderSelected = selectedFolders.includes(folder.id);
                                return (
                                  <div key={folder.id} className="space-y-2">
                                    <button
                                      onClick={() => handleToggleFolder(folder.id)}
                                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${isFolderSelected ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-purple-100'
                                        }`}
                                    >
                                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex-1 truncate">{folder.name}</span>
                                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${isFolderSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-transparent'}`}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                      </div>
                                    </button>

                                    {isFolderSelected && folder.lists && folder.lists.length > 0 && (
                                      <div className="ml-4 pl-4 border-l border-purple-100 dark:border-purple-900/50 space-y-1">
                                        {folder.lists.map((list: any) => {
                                          const isSelected = selectedLists.includes(list.id);
                                          return (
                                            <button
                                              key={list.id}
                                              onClick={() => handleToggleList(list.id)}
                                              className={`w-full flex items-center gap-3 p-1.5 rounded-lg transition-all text-left ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                }`}
                                            >
                                              <div className="w-1 h-1 rounded-full bg-current opacity-40 shrink-0" />
                                              <span className="text-[11px] font-medium flex-1 truncate">{list.name}</span>
                                              {isSelected && <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Updating Access...
              </>
            ) : 'Update Access'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpaceAccessModal;
