import { FormEvent, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { APP_NAME } from '../../utils/constants';

/* ── Animated background ── */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="auth-orb" style={{ width: 440, height: 440, background: 'rgba(99, 102, 241, 0.3)', top: -110, left: -110, borderRadius: '50%', filter: 'blur(90px)', animation: 'floatingOrb 22s ease-in-out infinite', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 370, height: 370, background: 'rgba(139, 92, 246, 0.22)', bottom: -90, right: -90, borderRadius: '50%', filter: 'blur(90px)', animation: 'floatingOrb 22s ease-in-out infinite', animationDelay: '-8s', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 280, height: 280, background: 'rgba(236, 72, 153, 0.16)', top: '35%', left: '50%', borderRadius: '50%', filter: 'blur(90px)', animation: 'floatingOrb 22s ease-in-out infinite', animationDelay: '-15s', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 180, height: 180, background: 'rgba(167, 139, 250, 0.12)', top: '65%', left: '15%', borderRadius: '50%', filter: 'blur(60px)', animation: 'floatingOrb 18s ease-in-out infinite', animationDelay: '-4s', position: 'absolute' as const }} />

      {/* Mesh grid */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Floating micro-dots */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/20"
          style={{
            width: 3 + (i % 3) * 2,
            height: 3 + (i % 3) * 2,
            top: `${12 + i * 14}%`,
            left: `${8 + i * 16}%`,
            animation: `floatingDot ${6 + i * 2}s ease-in-out infinite`,
            animationDelay: `${-i * 1.5}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Feature card with shine ── */
function FeatureCard({ icon, title, description, delay = 0 }: { icon: React.ReactNode; title: string; description: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 + delay, duration: 0.5, type: 'spring', stiffness: 200 }}
      className="flex items-start gap-3.5 bg-white/[0.06] backdrop-blur-sm rounded-xl p-4 border border-white/[0.08] hover:bg-white/[0.12] transition-all duration-300 group relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 55%, transparent 60%)' }}
      />
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border border-white/10">
        {icon}
      </div>
      <div className="relative z-10">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-indigo-200/50 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

/* ── Animation variants ── */
const formVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } }
};

export function LoginPage({ role }: { role?: 'ADMIN' | 'SUPER_ADMIN' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');
  const [invitationOrg, setInvitationOrg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (emailParam) setEmail(emailParam);

    if (token) {
      setLoading(true);
      api.get<{ success: boolean; data: { organization: { name: string } } }>(`/invitations/validate?token=${token}`)
        .then(res => {
          setInvitationOrg(res.data.data.organization.name);
        })
        .catch(err => {
          setError(err.response?.data?.message || 'Invalid or expired invitation link');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [token, emailParam]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password, inviteToken: token || undefined });
      navigate('/app');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Login failed. Please try again.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-50 dark:bg-gray-950 font-inter">
      {/* Left - Premium branding panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a0520 0%, #0f0c29 20%, #302b63 55%, #24243e 100%)' }}
      >
        <FloatingParticles />

        {/* Animated accent line */}
        <div className="absolute top-0 left-0 w-full h-[2px] overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
          />
        </div>

        <div className={`relative z-10 flex flex-col justify-between py-12 px-12 xl:px-16 w-full transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Logo with pulse ring */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <Link to="/">
              <img src="/logo-full-white.png" alt={APP_NAME} className="h-9 w-auto" />
            </Link>
          </motion.div>

          {/* Hero content */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7, type: 'spring', stiffness: 100 }}
            >
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.08] tracking-tight">
                Manage projects<br />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  like a pro.
                </span>
              </h1>
              <p className="mt-5 text-base text-indigo-200/45 max-w-md leading-relaxed">
                The all-in-one workspace for teams who ship. Plan, track, and deliver projects faster than ever.
              </p>
            </motion.div>

            <div className="space-y-3 max-w-sm">
              <FeatureCard
                delay={0}
                icon={<svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                title="Lightning fast"
                description="Real-time collaboration with instant sync"
              />
              <FeatureCard
                delay={0.1}
                icon={<svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                title="Enterprise security"
                description="256-bit encryption for all your data"
              />
              <FeatureCard
                delay={0.2}
                icon={<svg className="w-5 h-5 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                title="Team-first design"
                description="Built for collaboration at every level"
              />
            </div>
          </div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="flex items-center gap-4"
          >
            <div className="flex -space-x-2.5">
              {[
                'bg-gradient-to-br from-pink-400 to-rose-500',
                'bg-gradient-to-br from-amber-400 to-orange-500',
                'bg-gradient-to-br from-emerald-400 to-green-500',
                'bg-gradient-to-br from-blue-400 to-indigo-500',
                'bg-gradient-to-br from-purple-400 to-violet-500',
              ].map((gradient, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.3 + i * 0.08, type: 'spring', stiffness: 300 }}
                  className={`w-8 h-8 rounded-full ${gradient} border-2 border-[#1a1540] flex items-center justify-center text-[10px] font-bold text-white shadow-lg`}
                >
                  {['A', 'B', 'C', 'D', 'E'][i]}
                </motion.div>
              ))}
            </div>
            <div>
              <p className="text-xs text-indigo-200/40">Trusted by <span className="text-indigo-200/70 font-semibold">2,000+</span> teams</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right - Login form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-gray-50 dark:bg-gray-950 relative">
        <div className="absolute inset-0 pattern-dots" />

        {/* Decorative corner accents */}
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-30">
          <div className="absolute top-4 right-4 w-20 h-20 border-t-2 border-r-2 border-indigo-200/30 dark:border-indigo-800/30 rounded-tr-3xl" />
        </div>
        <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none opacity-30">
          <div className="absolute bottom-4 left-4 w-20 h-20 border-b-2 border-l-2 border-indigo-200/30 dark:border-indigo-800/30 rounded-bl-3xl" />
        </div>

        <div className={`w-full max-w-md relative z-10 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="lg:hidden mb-5">
              <Link to="/">
                <motion.img
                  src="/tab-icon.png"
                  alt={APP_NAME}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-14 h-14 rounded-2xl mx-auto shadow-xl shadow-indigo-500/20"
                />
              </Link>
            </div>
            <motion.h2
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight"
            >
              {invitationOrg ? `Join ${invitationOrg}` : (role === 'SUPER_ADMIN' ? 'Super Admin Login' : role === 'ADMIN' ? 'Admin Login' : 'Welcome back')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mt-2 text-sm text-gray-500 dark:text-gray-400"
            >
              {invitationOrg ? `Log in to join ${invitationOrg}` : (role ? `Access your ${role.toLowerCase().replace('_', ' ')} dashboard` : 'Sign in to your workspace')}
            </motion.p>
          </div>

          <motion.form variants={formVariants} initial="hidden" animate="show" onSubmit={handleSubmit} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3.5 rounded-xl border border-red-100 dark:border-red-800/50 flex items-center gap-2.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-medium flex-1">{error}</span>
                  <button
                    type="button"
                    onClick={() => setError('')}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 rounded transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div variants={itemVariants}>
              <Input
                id="login-email"
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input-premium"
              />
            </motion.div>

            <motion.div variants={itemVariants} className="relative">
              <Input
                id="login-password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="input-premium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[36px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </motion.div>

            <motion.div variants={itemVariants} className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-semibold hover:underline underline-offset-2 transition-all">
                Forgot password?
              </Link>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Button type="submit" className="w-full btn-premium group" size="lg" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </Button>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-gray-800 px-3 text-gray-400 dark:text-gray-500">or</span>
                </div>
              </div>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-5">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all">
                  Create account
                </Link>
              </p>
            </motion.div>
          </motion.form>

          {/* Bottom attribution */}
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 mt-6">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
