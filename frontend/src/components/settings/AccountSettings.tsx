import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAppDispatch } from '../../store';
import { clearCredentials } from '../../store/slices/authSlice';
import { clearUser } from '../../store/slices/userSlice';
import { useToast } from '../ui/Toast';
import api from '../../services/api';

export function AccountSettings() {
  const navigate = useNavigate();
  const toast = useToast();
  const dispatch = useAppDispatch();

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setPwSaving(true);
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      setPwSuccess('Password changed successfully');
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to change password';
      setPwError(msg);
      toast.error(msg);
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Please enter your password');
      return;
    }
    setDeleting(true);
    try {
      await api.delete('/users/me', { data: { password: deletePassword } });
      dispatch(clearCredentials());
      dispatch(clearUser());
      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete account';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const EyeIcon = ({ show, onClick }: { show: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
      {show ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="space-y-12">
      {/* Change Password Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3c0-.265.105-.52.293-.707l5.957-5.957A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Security Credentials</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manage your password and authentication methods</p>
          </div>
        </div>

        {pwSuccess && (
          <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl text-sm text-green-600 dark:text-green-400 flex items-center gap-2 animate-slide-down">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {pwSuccess}
          </div>
        )}
        
        {pwError && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-sm text-red-600 dark:text-red-400 animate-slide-down">
            {pwError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-5 max-w-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Verify current password"
                title="Verify current password"
                className="w-full px-4 py-3 pr-12 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                required
              />
              <EyeIcon show={showCurrentPw} onClick={() => setShowCurrentPw(!showCurrentPw)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 pr-12 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                required
                minLength={8}
              />
              <EyeIcon show={showNewPw} onClick={() => setShowNewPw(!showNewPw)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              title="Confirm new password"
              className={`w-full px-4 py-3 text-sm bg-white dark:bg-gray-800/50 border rounded-xl text-gray-900 dark:text-white focus:ring-4 outline-none transition-all ${
                confirmPassword && confirmPassword !== newPassword
                  ? 'border-red-400 focus:ring-red-500/10 focus:border-red-500'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-indigo-500/10 focus:border-indigo-500'
              }`}
              required
            />
          </div>

          <button
            type="submit"
            disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="w-full sm:w-auto px-8 py-3 text-sm font-bold rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50 active:scale-95"
          >
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* Danger Zone Section */}
      <section className="pt-10 border-t border-gray-100 dark:border-gray-800/60">
        <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-[2rem] p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-2xl text-red-600 dark:text-red-400 shadow-sm transition-transform active:rotate-12">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="max-w-md">
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Account Deletion</h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/60 mt-1 leading-relaxed">
                  Permanently remove all your workspaces, tasks, and personal data. This action is irreversible.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-6 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-all shadow-xl shadow-red-500/20 whitespace-nowrap active:scale-95"
            >
              Close Account
            </button>
          </div>
        </div>
      </section>

      {/* Modern Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-gray-800 max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-8 sm:p-10">
              <div className="w-16 h-16 rounded-3xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 dark:text-white text-center tracking-tight mb-2">Are you sure?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed mb-6">
                To confirm deletion, please enter your account password. This action cannot be undone.
              </p>

              {deleteError && (
                <div className="mb-6 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 animate-slide-down">
                  {deleteError}
                </div>
              )}

              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Verify password"
                className="w-full px-4 py-4 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all mb-8"
                autoFocus
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
                  disabled={deleting}
                  className="order-2 sm:order-1 flex-1 px-6 py-4 text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || !deletePassword}
                  className="order-1 sm:order-2 flex-1 px-6 py-4 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {deleting ? 'Processing...' : 'Delete Everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
