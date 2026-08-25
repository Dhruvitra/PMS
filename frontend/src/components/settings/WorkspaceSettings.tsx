import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAppSelector } from '../../store';
import { useOrgRole } from '../../hooks/useOrgRole';
import { useToast } from '../ui/Toast';
import api from '../../services/api';
import { useAppDispatch } from '../../store';
import { updateCurrentOrg } from '../../store/slices/organizationSlice';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';

export function WorkspaceSettings() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const { isOwner, isSuperAdmin } = useOrgRole();
  const { success: showSuccess, error: showError } = useToast();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [name, setName] = useState(currentOrg?.name || '');
  const [logoPreview, setLogoPreview] = useState<string | null>(currentOrg?.settings?.logoUrl || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const canManage = isOwner || isSuperAdmin;
  const canDelete = isOwner || isSuperAdmin;

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setLogoPreview(currentOrg.settings?.logoUrl || null);
    }
  }, [currentOrg]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showError('Logo must be under 2MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!currentOrg) return;
    setSaving(true);
    try {
      let logoUrl = currentOrg.settings?.logoUrl || null;
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const uploadRes = await api.post<{ success: boolean; data: any }>(`/organizations/${currentOrg.id}/logo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logoUrl = uploadRes.data.data.settings?.logoUrl;
        setLogoFile(null);
      }

      const res = await api.patch(`/organizations/${currentOrg.id}`, {
        name: name.trim(),
        settings: { ...currentOrg.settings, logoUrl }
      });

      if (res.data.success) {
        dispatch(updateCurrentOrg(res.data.data));
        setSaved(true);
        showSuccess('Workspace updated successfully');
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      showError('Failed to update workspace');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrg) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Workspace Profile</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Information about your current workspace</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div 
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-3xl font-black shadow-lg overflow-hidden border-2 border-transparent group-hover:border-indigo-400 transition-all cursor-pointer"
                onClick={() => canManage && fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentOrg.name.charAt(0).toUpperCase()
                )}
                {canManage && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} title="Upload Workspace Logo" aria-label="Upload Workspace Logo" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Workspace Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-4 py-2.5 text-sm font-bold bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-60"
                  placeholder="Enter workspace name..."
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Workspace ID</span>
              <code className="text-[11px] font-mono font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg mt-1 block">
                {currentOrg.id}
              </code>
            </div>
            {canManage && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </section>

      {canDelete && (
        <section className="bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 overflow-hidden">
          <div className="p-6 border-b border-red-100 dark:border-red-900/20">
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Danger Zone</h3>
            <p className="text-xs text-red-500/80 dark:text-red-400/60 mt-1">Irreversible actions for this workspace</p>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Delete Workspace</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Once you delete a workspace, there is no going back. All data will be permanently removed.
                </p>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 whitespace-nowrap"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        </section>
      )}

      {isDeleteModalOpen && (
        <DeleteConfirmModal
          type="Organization"
          id={currentOrg.id}
          title={currentOrg.name}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={() => {
            navigate('/app');
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
