import { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { setUser } from '../../store/slices/userSlice';
import { useToast } from '../ui/Toast';
import api from '../../services/api';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function ProfileSettings() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const { success: showSuccess, error: showError } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [technology, setTechnology] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setMobileNo(currentUser.mobileNo || '');
      setTechnology(currentUser.technology || '');
      setAvatarPreview(currentUser.avatarUrl || null);
      setImageError(false);
    }
  }, [currentUser]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      e.target.value = '';
      return;
    }
    setAvatarFile(file);
    setImageError(false);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Upload avatar if changed
      let avatarUrl = currentUser?.avatarUrl || null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const uploadRes = await api.post<{ success: boolean; data: typeof currentUser }>('/users/me/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        avatarUrl = uploadRes.data.data?.avatarUrl ?? null;
        setAvatarFile(null);
      }

      const res = await api.patch<{ success: boolean; data: typeof currentUser }>('/users/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl,
        mobileNo: mobileNo.trim() || null,
        technology: technology.trim() || null,
      });
      if (res.data.success && res.data.data) {
        dispatch(setUser(res.data.data));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showSuccess('Profile updated');
    } catch {
      setError('Failed to update profile');
      showError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-4 rounded-2xl border border-red-200 dark:border-red-800 animate-slide-down">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Avatar Section */}
      <div className="flex flex-col sm:flex-row items-center gap-8 pb-8 border-b border-gray-100 dark:border-gray-800/60">
        <div className="relative group shrink-0">
          <div className="w-28 h-28 rounded-[2rem] overflow-hidden ring-4 ring-white dark:ring-gray-800 shadow-xl transition-transform duration-300 group-hover:scale-[1.02]">
            {avatarPreview && !imageError ? (
              <img 
                src={avatarPreview} 
                alt="Profile" 
                className="w-full h-full object-cover" 
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-3xl font-black">
                {currentUser ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase() : 'U'}
              </div>
            )}
          </div>
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            title="Upload profile picture"
            className="absolute -bottom-2 -right-2 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg border-2 border-white dark:border-gray-800 transition-all hover:scale-110 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} title="Profile image upload" />
        </div>
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Profile Picture</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
            Show your personality with a high-quality avatar. Supports JPG, PNG. Max size 2MB.
          </p>
        </div>
      </div>

      {/* Basic Info Section */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Personal Details
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">First Name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. John"
              className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Last Name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Doe"
              className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
          <div className="relative">
            <input
              value={currentUser?.email || ''}
              disabled
              title="Email address (cannot be changed)"
              placeholder="Email address"
              className="w-full pl-4 pr-32 py-3 text-sm bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-400 dark:text-gray-500 cursor-not-allowed italic"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Locked
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Info Section */}
      <div className="space-y-6 pt-4">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Professional Tags
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Phone Number</label>
            <input
              value={mobileNo}
              onChange={(e) => setMobileNo(e.target.value)}
              placeholder="+91 00000 00000"
              className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Core Tech Stack</label>
            <input
              value={technology}
              onChange={(e) => setTechnology(e.target.value)}
              placeholder="e.g. React, Python, AWS"
              className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2 pr-0 sm:pr-40">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Preferred Timezone</label>
          <div className="relative">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              title="Select timezone"
              className="w-full appearance-none px-4 py-3 text-sm bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-8 border-t border-gray-100 dark:border-gray-800 mt-4">
        <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
          * Your information is securely stored and follows our data policy.
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold rounded-2xl transition-all min-w-[160px] shadow-lg shadow-indigo-500/20 active:scale-95 ${
            saved 
              ? 'bg-green-500 text-white' 
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
          } disabled:opacity-50`}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Updated
            </>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  );
}

