import { FormEvent, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion, Variants } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { APP_NAME } from '../../utils/constants';
import api from '../../services/api';

type Step = 'email' | 'sent' | 'reset';

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="auth-orb" style={{ width: 400, height: 400, background: 'rgba(245, 158, 11, 0.25)', top: -100, left: -100, borderRadius: '50%', filter: 'blur(80px)', animation: 'floatingOrb 20s ease-in-out infinite', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 350, height: 350, background: 'rgba(239, 68, 68, 0.2)', bottom: -80, right: -80, borderRadius: '50%', filter: 'blur(80px)', animation: 'floatingOrb 20s ease-in-out infinite', animationDelay: '-7s', position: 'absolute' as const }} />
      <div className="auth-orb" style={{ width: 250, height: 250, background: 'rgba(249, 115, 22, 0.15)', top: '40%', left: '55%', borderRadius: '50%', filter: 'blur(80px)', animation: 'floatingOrb 20s ease-in-out infinite', animationDelay: '-14s', position: 'absolute' as const }} />
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 bg-white/[0.07] backdrop-blur-sm rounded-xl p-4 border border-white/[0.08] hover:bg-white/[0.12] transition-all duration-300 group">
      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-amber-200/60 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

const formVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setMounted(true);
    // Arriving here via the emailed reset link (?token=...) skips straight to step 2 —
    // clicking that link, sent only to the account's real inbox, IS the verification.
    const tokenFromLink = searchParams.get('token');
    if (tokenFromLink) {
      setResetToken(tokenFromLink);
      setStep('reset');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const checkRes = await api.post<{ success: boolean; data: { exists: boolean } }>('/auth/check-email', { email });
      if (!checkRes.data.data.exists) {
        setError('No account found with this email. Please sign up instead.');
        setLoading(false);
        return;
      }
      await api.post<{ success: boolean; data: { message: string } }>('/auth/forgot-password', { email });
      setStep('sent');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Something went wrong. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
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

  return (
    <div className="min-h-screen w-full flex bg-gray-50 dark:bg-gray-950 font-inter">
      {/* Left - Premium branding panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #78350f 0%, #92400e 30%, #b45309 60%, #d97706 100%)',
        }}
      >
        <FloatingParticles />

        <div className={`relative z-10 flex flex-col justify-between py-12 px-12 xl:px-16 w-full transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src="/logo-full-white.png" alt={APP_NAME} className="h-9 w-auto" />
            </Link>
          </div>

          {/* Hero content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                Reset your<br />
                <span className="bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 bg-clip-text text-transparent">
                  password.
                </span>
              </h1>
              <p className="mt-5 text-base text-amber-200/50 max-w-md leading-relaxed">
                No worries — it happens to everyone. Enter your email and set a new password to get back to your workspace.
              </p>
            </div>

            <div className="space-y-3 max-w-sm">
              <FeatureCard
                icon={<svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                title="Secure process"
                description="Your data is encrypted and safe throughout the reset"
              />
              <FeatureCard
                icon={<svg className="w-5 h-5 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                title="Instant reset"
                description="Set your new password in seconds and get back to work"
              />
              <FeatureCard
                icon={<svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                title="Strong protection"
                description="We never store or share your plain-text password"
              />
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-3">
            {[
              { icon: '🔒', text: 'Bank-grade encryption' },
              { icon: '⚡', text: 'Instant access' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/[0.08]">
                <span className="text-sm">{item.icon}</span>
                <span className="text-xs text-amber-100/80 font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-gray-50 dark:bg-gray-950 relative">
        <div className="absolute inset-0 pattern-dots" />
        <div className={`w-full max-w-md relative z-10 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="lg:hidden mb-5">
              <Link to="/">
                <img src="/tab-icon.png" alt={APP_NAME} className="w-14 h-14 rounded-2xl mx-auto shadow-xl shadow-amber-500/20" />
              </Link>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {step === 'email' ? 'Forgot password?' : step === 'sent' ? 'Check your email' : 'Set new password'}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {step === 'email' ? 'Enter your email to reset your password' : step === 'sent' ? "We've sent you a link to reset your password" : 'Choose a strong new password for your account'}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === 'email' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-emerald-500 text-white'}`}>
                {step !== 'email' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : '1'}
              </div>
              <span className={`text-xs font-semibold ${step === 'email' ? 'text-gray-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>Verify email</span>
            </div>
            <div className={`h-px flex-1 transition-all ${step === 'reset' ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === 'reset' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                2
              </div>
              <span className={`text-xs font-semibold ${step === 'reset' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>New password</span>
            </div>
          </div>

          {/* Step 1: Enter email */}
          {step === 'email' && (
            <motion.form variants={formVariants} initial="hidden" animate="show" onSubmit={handleEmailSubmit} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5">
              {error && (
                <motion.div variants={itemVariants} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3.5 rounded-xl border border-red-100 dark:border-red-800/50 flex items-center gap-2.5 animate-fade-in">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-medium">{error}</span>
                </motion.div>
              )}

              <motion.p variants={itemVariants} className="text-sm text-gray-500 dark:text-gray-400">
                Enter your email address and we&apos;ll let you set a new password.
              </motion.p>

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
                      Verifying...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Continue
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  Remember your password?{' '}
                  <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            </motion.form>
          )}

          {/* Step 1b: Confirmation that the reset email was sent */}
          {step === 'sent' && (
            <motion.div variants={formVariants} initial="hidden" animate="show" className="glass-card p-7 sm:p-8 rounded-2xl space-y-5 text-center">
              <motion.div variants={itemVariants} className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </motion.div>
              <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                If an account exists for <span className="font-semibold text-gray-900 dark:text-white">{email}</span>, we've sent a link to reset your password. Click the link in that email to choose a new password — it expires in 1 hour.
              </motion.p>
              <motion.div variants={itemVariants}>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all"
                >
                  Try a different email
                </button>
              </motion.div>
              <motion.div variants={itemVariants}>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all">
                    Back to Sign in
                  </Link>
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* Step 2: Set new password */}
          {step === 'reset' && (
            <motion.form variants={formVariants} initial="hidden" animate="show" onSubmit={handleResetPassword} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5">
              {error && (
                <motion.div variants={itemVariants} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3.5 rounded-xl border border-red-100 dark:border-red-800/50 flex items-center gap-2.5 animate-fade-in">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-medium">{error}</span>
                </motion.div>
              )}

              {success && (
                <motion.div variants={itemVariants} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-2.5 animate-fade-in">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-medium">{success}</span>
                </motion.div>
              )}

              <motion.div variants={itemVariants} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{email}</span>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); setSuccess(''); setPassword(''); setConfirmPassword(''); }}
                  className="ml-auto text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2"
                >
                  Change
                </button>
              </motion.div>

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

              <motion.div variants={itemVariants}>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2 transition-all">
                    Back to Sign in
                  </Link>
                </p>
              </motion.div>
            </motion.form>
          )}

          {/* Bottom attribution */}
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 mt-6">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
