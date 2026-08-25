import { FormEvent, useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { APP_NAME } from '../../utils/constants';
import api from '../../services/api';

type Step = 'email' | 'register' | 'reset-password';

/* ── Animated background ── */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="auth-orb" style={{ width: 420, height: 420, background: 'rgba(16, 185, 129, 0.3)', top: -100, left: -100, borderRadius: '50%', filter: 'blur(90px)', animation: 'floatingOrb 22s ease-in-out infinite', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 350, height: 350, background: 'rgba(6, 182, 212, 0.22)', bottom: -80, right: -80, borderRadius: '50%', filter: 'blur(90px)', animation: 'floatingOrb 22s ease-in-out infinite', animationDelay: '-8s', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 260, height: 260, background: 'rgba(52, 211, 153, 0.18)', top: '35%', left: '50%', borderRadius: '50%', filter: 'blur(90px)', animation: 'floatingOrb 22s ease-in-out infinite', animationDelay: '-15s', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 180, height: 180, background: 'rgba(20, 184, 166, 0.12)', top: '70%', left: '20%', borderRadius: '50%', filter: 'blur(60px)', animation: 'floatingOrb 18s ease-in-out infinite', animationDelay: '-4s', position: 'absolute' as const }} />

      {/* Animated mesh grid */}
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
            top: `${15 + i * 14}%`,
            left: `${10 + i * 15}%`,
            animation: `floatingDot ${6 + i * 2}s ease-in-out infinite`,
            animationDelay: `${-i * 1.5}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Feature card with shine hover ── */
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
        <p className="text-xs text-emerald-200/50 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

/* ── Password strength meter ── */
function PasswordStrength({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    if (s <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (s <= 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' };
    if (s <= 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' };
    if (s <= 4) return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { score: 5, label: 'Excellent', color: 'bg-emerald-400' };
  }, [password]);

  if (!password) return null;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5 pt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <motion.div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength.score ? strength.color : 'bg-gray-200 dark:bg-gray-700'}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
          />
        ))}
      </div>
      <div className="flex justify-between items-center">
        <p className={`text-[10px] font-semibold ${strength.score <= 1 ? 'text-red-500' : strength.score <= 2 ? 'text-orange-500' : strength.score <= 3 ? 'text-yellow-600' : 'text-emerald-500'}`}>
          {strength.label}
        </p>
        <p className="text-[10px] text-gray-400">Use uppercase, numbers & symbols</p>
      </div>
    </motion.div>
  );
}

/* ── Animation variants ── */
const pageTransition = {
  enter: { x: 30, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { x: -30, opacity: 0, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
};

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

export function RegisterPage({ role }: { role?: 'ADMIN' | 'SUPER_ADMIN' }) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorRetryCount, setErrorRetryCount] = useState(0);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [mounted, setMounted] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const [invitationOrg, setInvitationOrg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // Validate invite token if present
    if (inviteToken) {
      setLoading(true);
      api.get<{ success: boolean; data: { email: string; organization: { name: string } } }>(`/invitations/validate?token=${inviteToken}`)
        .then(res => {
          setEmail(res.data.data.email);
          setInvitationOrg(res.data.data.organization.name);
          setStep('register');
        })
        .catch(err => {
          setError(err.response?.data?.message || 'Invalid or expired invitation link');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [inviteToken]);

  const handleEmailCheck = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: { exists: boolean } }>('/auth/check-email', { email });
      if (res.data.data.exists) {
        const resetRes = await api.post<{ success: boolean; data: { message: string; resetToken?: string } }>('/auth/forgot-password', { email });
        if (resetRes.data.data.resetToken) setResetToken(resetRes.data.data.resetToken);
        setStep('reset-password');
      } else {
        setStep('register');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ email, password, firstName, lastName, inviteToken: inviteToken || undefined, role });
      navigate('/app');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Registration failed. Please try again.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post<{ success: boolean; data: { message: string } }>('/auth/reset-password', { token: resetToken, password });
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Password reset failed. Please try again.');
      } else {
        setError('Password reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const PasswordToggle = () => (
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
  );

  const ErrorAlert = () =>
    error ? (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3.5 rounded-xl border border-red-100 dark:border-red-800/50 flex flex-col gap-2.5 animate-fade-in mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-medium flex-1">{error}</span>
          <button
            type="button"
            onClick={() => { setError(''); setErrorRetryCount(c => c + 1); }}
            className="text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 px-2 py-1 rounded font-bold transition-colors"
            title="Clear error"
          >
            Clear
          </button>
        </div>

        {errorRetryCount > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-red-100 dark:border-red-800/30">
            <p className="text-[10px] opacity-70">Having trouble?</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[10px] font-bold underline hover:no-underline"
            >
              Reload Page
            </button>
          </div>
        )}
      </div>
    ) : null;

  const SuccessAlert = () =>
    success ? (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-2.5 animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="font-medium">{success}</span>
      </div>
    ) : null;

  const stepTitles = {
    email: role === 'SUPER_ADMIN' ? 'Super Admin Setup' : role === 'ADMIN' ? 'Admin Registration' : 'Get started',
    register: role === 'SUPER_ADMIN' ? 'Create Super Admin' : role === 'ADMIN' ? 'Create Admin Account' : 'Create your account',
    'reset-password': 'Reset password',
  };

  const stepSubtitles = {
    email: role ? `Step 1: Enter your ${role.toLowerCase().replace('_', ' ')} email` : 'Enter your email to begin',
    register: role ? `Step 2: Complete your ${role.toLowerCase().replace('_', ' ')} profile` : 'Fill in your details to join',
    'reset-password': 'This email is already registered',
  };

  const heroTitle = step === 'reset-password'
    ? (invitationOrg ? <>Join {invitationOrg},<br /><span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">welcome back.</span></> : <>Reset your<br /><span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">password.</span></>)
    : <>Join your team,<br /><span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">start building.</span></>;

  return (
    <div className="min-h-screen w-full flex bg-gray-50 dark:bg-gray-950 font-inter">
      {/* Left - Premium branding panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #022c22 0%, #064e3b 30%, #065f46 60%, #0f766e 100%)' }}
      >
        <FloatingParticles />

        {/* Animated accent line */}
        <div className="absolute top-0 left-0 w-full h-[2px] overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
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

          {/* Hero */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7, type: 'spring', stiffness: 100 }}
            >
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.08] tracking-tight">
                {heroTitle}
              </h1>
              <p className="mt-5 text-base text-emerald-200/45 max-w-md leading-relaxed">
                {step === 'reset-password'
                  ? 'Set a new password to regain access to your workspace.'
                  : 'Create your account and start collaborating with your team in seconds.'}
              </p>
            </motion.div>

            <div className="space-y-3 max-w-sm">
              <FeatureCard
                delay={0}
                icon={<svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                title="Instant setup"
                description="Get started in seconds — zero configuration needed"
              />
              <FeatureCard
                delay={0.1}
                icon={<svg className="w-5 h-5 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                title="Real-time collaboration"
                description="Work together with your team — changes sync instantly"
              />
              <FeatureCard
                delay={0.2}
                icon={<svg className="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                title="Enterprise-grade security"
                description="256-bit encryption protects all your data"
              />
            </div>
          </div>

          {/* Bottom trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="flex items-center gap-3 flex-wrap"
          >
            {[
              { icon: '✓', text: 'Free forever' },
              { icon: '⚡', text: 'No credit card' },
              { icon: '🔒', text: 'SOC 2 compliant' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 bg-white/[0.06] backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/[0.06] hover:bg-white/[0.1] transition-colors">
                <span className="text-sm">{item.icon}</span>
                <span className="text-xs text-emerald-100/70 font-medium">{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-gray-50 dark:bg-gray-950 relative overflow-y-auto">
        <div className="absolute inset-0 pattern-dots" />

        {/* Decorative corner accents */}
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-30">
          <div className="absolute top-4 right-4 w-20 h-20 border-t-2 border-r-2 border-emerald-200/30 dark:border-emerald-800/30 rounded-tr-3xl" />
        </div>
        <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none opacity-30">
          <div className="absolute bottom-4 left-4 w-20 h-20 border-b-2 border-l-2 border-emerald-200/30 dark:border-emerald-800/30 rounded-bl-3xl" />
        </div>

        <div className={`w-full max-w-md relative z-10 py-8 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="lg:hidden mb-5">
              <Link to="/">
                <motion.img
                  src="/tab-icon.png"
                  alt={APP_NAME}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-14 h-14 rounded-2xl mx-auto shadow-xl shadow-emerald-500/20"
                />
              </Link>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {invitationOrg ? `Join ${invitationOrg}` : stepTitles[step]}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {invitationOrg ? `You've been invited to join ${invitationOrg}` : stepSubtitles[step]}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Step indicator with animated progress */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-2">
              <motion.div
                layout
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${step === 'email' ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' : 'bg-emerald-500 text-white'}`}
              >
                <AnimatePresence mode="wait">
                  {step !== 'email' ? (
                    <motion.svg key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></motion.svg>
                  ) : (
                    <motion.span key="num" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>1</motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <span className={`text-xs font-semibold transition-colors ${step === 'email' ? 'text-gray-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>Email</span>
            </div>

            {/* Animated connecting line */}
            <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
              <motion.div
                className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: step !== 'email' ? '100%' : '0%' }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </div>

            <div className="flex items-center gap-2">
              <motion.div
                layout
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step !== 'email' ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}
              >
                2
              </motion.div>
              <span className={`text-xs font-semibold transition-colors ${step !== 'email' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{step === 'reset-password' ? 'Reset' : 'Details'}</span>
            </div>
          </div>

          {/* Animated step forms */}
          <AnimatePresence mode="wait">
            {/* Step 1: Email check */}
            {step === 'email' && (
              <motion.div key="email-step" variants={pageTransition} initial="enter" animate="center" exit="exit">
                <motion.form variants={formVariants} initial="hidden" animate="show" onSubmit={handleEmailCheck} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
                  <ErrorAlert />
                  <motion.div variants={itemVariants} className="flex items-center gap-3 p-3 bg-emerald-50/80 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                      We&apos;ll check if you already have an account to keep things smooth.
                    </p>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Input
                      id="email"
                      label="Email address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="input-premium"
                    />
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Button type="submit" className="w-full btn-premium" size="lg" disabled={loading}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Checking...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Continue
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
                      Already have an account?{' '}
                      <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all">
                        Sign in
                      </Link>
                    </p>
                  </motion.div>
                </motion.form>
              </motion.div>
            )}

            {/* Step 2a: New registration */}
            {step === 'register' && (
              <motion.div key="register-step" variants={pageTransition} initial="enter" animate="center" exit="exit">
                <motion.form variants={formVariants} initial="hidden" animate="show" onSubmit={handleRegister} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
                  <ErrorAlert />
                  <motion.div variants={itemVariants} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{email}</span>
                    {!inviteToken && (
                      <button
                        type="button"
                        onClick={() => { setStep('email'); setError(''); }}
                        className="ml-auto text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 shrink-0"
                      >
                        Change
                      </button>
                    )}
                  </motion.div>
                  <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="firstName" label="First name" value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(''); }} placeholder="John" required className="input-premium" />
                    <Input id="lastName" label="Last name" value={lastName} onChange={(e) => { setLastName(e.target.value); setError(''); }} placeholder="Doe" required className="input-premium" />
                  </motion.div>
                  <motion.div variants={itemVariants} className="relative">
                    <Input
                      id="password"
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      minLength={8}
                      required
                      className="input-premium"
                    />
                    <PasswordToggle />
                    <PasswordStrength password={password} />
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Button type="submit" className="w-full btn-premium group" size="lg" disabled={loading}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Creating account...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Create account
                          <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </span>
                      )}
                    </Button>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                      By creating an account, you agree to our{' '}
                      <span className="text-gray-500 dark:text-gray-400 hover:underline cursor-pointer">Terms</span>{' '}and{' '}
                      <span className="text-gray-500 dark:text-gray-400 hover:underline cursor-pointer">Privacy Policy</span>
                    </p>
                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white dark:bg-gray-800 px-3 text-gray-400 dark:text-gray-500">or</span>
                      </div>
                    </div>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                      Already have an account?{' '}
                      <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all">
                        Sign in
                      </Link>
                    </p>
                  </motion.div>
                </motion.form>
              </motion.div>
            )}

            {/* Step 2b: Reset password */}
            {step === 'reset-password' && (
              <motion.div key="reset-step" variants={pageTransition} initial="enter" animate="center" exit="exit">
                <motion.form variants={formVariants} initial="hidden" animate="show" onSubmit={handleResetPassword} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
                  <ErrorAlert />
                  <SuccessAlert />
                  <motion.div variants={itemVariants} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3.5 rounded-xl">
                    <div className="flex items-start gap-2.5">
                      <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                        {invitationOrg
                          ? `An account with ${email} already exists. Sign in to join ${invitationOrg} or reset your password.`
                          : `An account with ${email} already exists. Reset your password below.`}
                      </p>
                    </div>
                  </motion.div>
                  {invitationOrg && (
                    <motion.div variants={itemVariants}>
                      <Button
                        type="button"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                        size="lg"
                        onClick={() => navigate(`/login?email=${email}&token=${inviteToken}`)}
                      >
                        Sign in to join {invitationOrg}
                      </Button>
                    </motion.div>
                  )}
                  <motion.div variants={itemVariants} className="relative">
                    <Input
                      id="newPassword"
                      label="New Password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      minLength={8}
                      required
                      className="input-premium"
                    />
                    <PasswordToggle />
                    <PasswordStrength password={password} />
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Input
                      id="confirmPassword"
                      label="Confirm Password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      minLength={8}
                      required
                      className="input-premium"
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        Passwords don&apos;t match
                      </motion.p>
                    )}
                    {confirmPassword && password === confirmPassword && confirmPassword.length >= 8 && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Passwords match
                      </motion.p>
                    )}
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Button type="submit" className="w-full btn-premium" size="lg" disabled={loading || !!success}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Resetting...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Reset Password
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </Button>
                  </motion.div>
                  <motion.div variants={itemVariants} className="flex justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => { setStep('email'); setError(''); setSuccess(''); setPassword(''); setConfirmPassword(''); }}
                      className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all"
                    >
                      Use different email
                    </button>
                    <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all">
                      Sign in
                    </Link>
                  </motion.div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 mt-6">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
