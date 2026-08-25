import { useState, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useAppSelector } from '../../store';
import { Avatar } from '../../components/ui/Avatar';
import { ProfileSettings } from '../../components/settings/ProfileSettings';
import { PreferencesSettings } from '../../components/settings/PreferencesSettings';
import { AccountSettings } from '../../components/settings/AccountSettings';
import { WorkspaceSettings } from '../../components/settings/WorkspaceSettings';
import { TrackerSettings } from '../../components/settings/TrackerSettings';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';

type SettingsTab = 'profile' | 'preferences' | 'account' | 'team' | 'workspace' | 'tracker';

interface TeamMember {
   id: string;
   firstName: string;
   lastName: string;
   email: string;
   avatarUrl: string | null;
   mobileNo: string | null;
   technology: string | null;
   createdAt: string;
}

const TABS: { key: SettingsTab; label: string; icon: ReactNode }[] = [
   {
      key: 'profile',
      label: 'Profile',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
         </svg>
      ),
   },
   {
      key: 'preferences',
      label: 'Preferences',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
         </svg>
      ),
   },
   {
      key: 'account',
      label: 'Account',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
         </svg>
      ),
   },
   {
      key: 'team',
      label: 'Team',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
         </svg>
      ),
   },
   {
      key: 'workspace',
      label: 'Workspace',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
         </svg>
      ),
   },
   {
      key: 'tracker',
      label: 'Tracker Auto-Break',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
         </svg>
      ),
   },
];

export function SettingsPage() {
   const socket = useSocket();
   const location = useLocation();
   const queryParams = new URLSearchParams(location.search);
   const tabParam = queryParams.get('tab') as SettingsTab;
   
   const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || 'profile');
   const currentUser = useAppSelector((state) => state.user.currentUser);
   const currentOrg = useAppSelector((state) => state.organization.currentOrg);

   // Team members
   const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
   const [teamLoading, setTeamLoading] = useState(true);
   const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

   useEffect(() => {
      async function loadTeamMembers() {
         if (!currentOrg?.id) { setTeamLoading(false); return; }
         try {
            const res = await api.get<{ success: boolean; data: TeamMember[] }>('/users/all', { params: { orgId: currentOrg.id } });
            if (res.data.success) setTeamMembers(res.data.data);
         } catch (err) {
            console.error('Failed to load team members:', err);
         } finally {
            setTeamLoading(false);
         }
      }
      loadTeamMembers();
   }, [currentOrg?.id]);

   useEffect(() => {
      if (!socket) return;

      const handleOnlineList = (ids: string[]) => setOnlineUsers(new Set(ids));
      const handleOnline = (d: { userId: string }) => setOnlineUsers((p) => new Set(p).add(d.userId));
      const handleOffline = (d: { userId: string }) => {
         setOnlineUsers((p) => { const n = new Set(p); n.delete(d.userId); return n; });
      };

      socket.on('users:online-list', handleOnlineList);
      socket.on('user:online', handleOnline);
      socket.on('user:offline', handleOffline);

      // The socket connection is shared/long-lived across the whole app, so the
      // server's one-time initial online-list push almost always fired before
      // this page ever mounted. Ask for a fresh snapshot now.
      socket.emit('users:get-online-list');

      return () => {
         socket.off('users:online-list', handleOnlineList);
         socket.off('user:online', handleOnline);
         socket.off('user:offline', handleOffline);
      };
   }, [socket]);

   return (
      <div className="w-full h-full overflow-y-auto bg-slate-50/50 dark:bg-gray-950/50 pattern-dots custom-scrollbar">
         {/* Premium Header */}
         <div className="sticky top-0 z-20 header-blur px-6 py-5 mt-4 border-b border-gray-200 dark:border-gray-800/60">
            <div className="flex items-center justify-between gap-4 max-w-6xl mx-auto">
               <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                     </svg>
                  </div>
                  <div>
                     <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">System Settings</h1>
                     <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Configure your personal platform experience
                     </p>
                  </div>
               </div>
               
               <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white/50 dark:bg-gray-800/40 rounded-full border border-gray-200 dark:border-gray-700/50">
                  <Avatar firstName={currentUser?.firstName} lastName={currentUser?.lastName} avatarUrl={currentUser?.avatarUrl} size="xs" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                     {currentUser?.firstName} {currentUser?.lastName}
                  </span>
               </div>
            </div>
         </div>

         <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-8 p-6 sm:p-8">
            {/* Nav Sidebar */}
            <aside className="sm:w-64 shrink-0">
               <nav className="flex sm:flex-col gap-1 overflow-x-auto no-scrollbar pb-4 sm:pb-0">
                  {TABS.map((tab) => {
                     const isActive = activeTab === tab.key;
                     return (
                        <button
                           key={tab.key}
                           onClick={() => setActiveTab(tab.key)}
                           className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-300 whitespace-nowrap shrink-0 sm:w-full ${
                              isActive
                                 ? 'bg-white dark:bg-gray-800 shadow-xl shadow-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30'
                                 : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-gray-800/50'
                           }`}
                        >
                           <span className={`p-1.5 rounded-lg transition-colors ${
                              isActive ? 'bg-indigo-50 dark:bg-indigo-900/40' : 'bg-gray-100 dark:bg-gray-800/60 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
                           }`}>
                              {tab.icon}
                           </span>
                           {tab.label}
                        </button>
                     );
                  })}
               </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 overflow-y-auto">
               <div className="glass-card rounded-[2.5rem] p-8 sm:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 min-h-[600px]">
                  {/* Section Title */}
                  <div className="mb-10 animate-fade-in">
                     <span className="inline-block px-3 py-1 mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                        Configurations
                     </span>
                     <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {TABS.find((t) => t.key === activeTab)?.label}
                     </h2>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-lg leading-relaxed">
                        {activeTab === 'profile' && 'Update your identity, contact details, and visual representation across the platform.'}
                        {activeTab === 'preferences' && 'Fine-tune how you interact with the interface, notifications, and language settings.'}
                        {activeTab === 'account' && 'Secure your account with two-factor authentication and manage high-level account actions.'}
                        {activeTab === 'team' && 'View your organizational network and monitor real-time presence of your collaborators.'}
                        {activeTab === 'workspace' && 'Administer global workspace identities, URLs, and member access roles.'}
                        {activeTab === 'tracker' && 'Customize employee desktop tracker inactivity auto-break thresholds for this workspace.'}
                     </p>
                  </div>

                  {/* Tab Components */}
                  <div className="animate-fade-in-up">
                     {activeTab === 'profile' && <ProfileSettings />}
                     {activeTab === 'preferences' && <PreferencesSettings />}
                     {activeTab === 'account' && <AccountSettings />}
                     {activeTab === 'workspace' && <WorkspaceSettings />}
                     {activeTab === 'tracker' && <TrackerSettings />}
                     {activeTab === 'team' && (
                  <div>
                     {teamLoading ? (
                        <div className="flex justify-center py-12">
                           <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                     ) : (
                        <>
                           {/* Desktop table */}
                           <div className="hidden sm:block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                              <table className="w-full text-sm">
                                 <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                       <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member</th>
                                       <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                       <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mobile</th>
                                       <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Technology</th>
                                       <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {teamMembers.map((member) => {
                                       const isOnline = onlineUsers.has(member.id);
                                       return (
                                          <tr key={member.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                             <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                   <div className="relative shrink-0">
                                                      <Avatar firstName={member.firstName} lastName={member.lastName} avatarUrl={member.avatarUrl} size="sm" />
                                                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                                   </div>
                                                   <span className="font-medium text-gray-900 dark:text-white">{member.firstName} {member.lastName}</span>
                                                </div>
                                             </td>
                                             <td className="px-4 py-3 text-gray-500 dark:text-gray-400 break-all">{member.email}</td>
                                             <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{member.mobileNo || '-'}</td>
                                             <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{member.technology || '-'}</td>
                                             <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${isOnline
                                                   ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                                   : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                                   }`}>
                                                   <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                   {isOnline ? 'Online' : 'Offline'}
                                                </span>
                                             </td>
                                          </tr>
                                       );
                                    })}
                                 </tbody>
                              </table>
                           </div>
                           {/* Mobile cards */}
                           <div className="sm:hidden space-y-3">
                              {teamMembers.map((member) => {
                                 const isOnline = onlineUsers.has(member.id);
                                 return (
                                    <div key={member.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                       <div className="flex items-center gap-3 mb-3">
                                          <div className="relative shrink-0">
                                             <Avatar firstName={member.firstName} lastName={member.lastName} avatarUrl={member.avatarUrl} size="md" />
                                             <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <p className="font-semibold text-gray-900 dark:text-white text-sm">{member.firstName} {member.lastName}</p>
                                             <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
                                          </div>
                                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full shrink-0 ${isOnline ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                             <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                             {isOnline ? 'Online' : 'Offline'}
                                          </span>
                                       </div>
                                       {(member.mobileNo || member.technology) && (
                                          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                                             {member.mobileNo && <span>📞 {member.mobileNo}</span>}
                                             {member.technology && <span>💻 {member.technology}</span>}
                                          </div>
                                       )}
                                    </div>
                                 );
                              })}
                           </div>
                        </>
                     )}
                  </div>
               )}
               </div>
            </div>
         </main>
      </div>
   </div>
);
}
