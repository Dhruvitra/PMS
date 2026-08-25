import { Link, Navigate } from 'react-router';
import { motion } from 'framer-motion';
import { useAppSelector } from '../store';
import { Button } from '../components/ui/Button';
import { APP_NAME } from '../utils/constants';

const ALL_PLAN_FEATURES = [
  'Unlimited tasks, lists & spaces',
  'Kanban board, Gantt & calendar views',
  'Real-time team chat',
  'Comments & @mentions',
  'File attachments',
  'Time tracking & reports',
  'Employee screen tracking & payroll',
  'Smart notifications',
  'Role-based permissions',
];

const PLANS = [
  {
    name: 'Basic',
    price: 500,
    storage: '10 GB',
    highlighted: false,
    features: ALL_PLAN_FEATURES,
  },
  {
    name: 'Silver',
    price: 1000,
    storage: '30 GB',
    highlighted: true,
    features: ALL_PLAN_FEATURES,
  },
  {
    name: 'Gold',
    price: 1500,
    storage: '50 GB',
    highlighted: false,
    features: ALL_PLAN_FEATURES,
  },
];

const FEATURES = [
  {
    title: 'Tasks, Lists & Spaces',
    description: 'Organize work into spaces, lists, and tasks with subtasks, due dates, and time estimates. Track progress through 8 statuses — from Open to Closed — and 4 priority levels from Low to Urgent.',
    gradient: 'from-indigo-500 to-blue-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    ),
  },
  {
    title: 'Kanban, Gantt & Calendar Views',
    description: 'Switch between a drag-and-drop Kanban board, a Gantt timeline, and a calendar view — the same tasks, seen the way that fits the moment: what to do next, what’s coming up, or what’s overdue.',
    gradient: 'from-purple-500 to-fuchsia-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v18M3 9h18M3 15h18" />
    ),
  },
  {
    title: 'Real-time Team Chat',
    description: 'Message your team without leaving the app. Chats sync instantly across every open tab and device, so conversations never fall out of sync with the work they’re about.',
    gradient: 'from-emerald-500 to-teal-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
  },
  {
    title: 'Comments & @Mentions',
    description: 'Discuss tasks in threaded comments, pull teammates in with @mentions, attach files directly to a comment, and mark sensitive notes as private so only the right people see them.',
    gradient: 'from-sky-500 to-indigo-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    ),
  },
  {
    title: 'File Attachments',
    description: 'Attach images and documents directly to tasks and comments — multiple files per comment, with inline previews for images so your team doesn’t have to download a file just to check it.',
    gradient: 'from-amber-500 to-orange-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    ),
  },
  {
    title: 'Time Tracking',
    description: 'Log time manually per task, or automatically via the companion desktop tracker. Mark entries billable or not, and roll everything up into per-person, per-task reports.',
    gradient: 'from-rose-500 to-pink-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: 'Employee Tracking & Payroll',
    description: 'Optional screen activity tracking and reports for teams that need them, plus a full payroll module: salary master, attendance-based pay runs, and per-organization work-calendar rules.',
    gradient: 'from-cyan-500 to-blue-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7a4 4 0 108 0 4 4 0 00-8 0zM3 21v-2a4 4 0 014-4h1m10-1v-1a4 4 0 00-3-3.87M17 21v-2a4 4 0 00-3-3.87M13 21H3v-2a4 4 0 014-4h4a4 4 0 014 4v2h-2" />
    ),
  },
  {
    title: 'Smart Notifications',
    description: 'Get pinged for assignments, @mentions, task activity, and due dates — routed to the people who need them, not broadcast to everyone in the workspace.',
    gradient: 'from-violet-500 to-purple-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    ),
  },
  {
    title: 'Role-based Permissions',
    description: 'Seven built-in roles — Owner, Super Admin, Admin, HR, Member, Limited Member, and Guest — so every person in your workspace sees exactly what they’re supposed to, nothing more.',
    gradient: 'from-slate-600 to-gray-800',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    ),
  },
];

function LandingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="auth-orb" style={{ width: 480, height: 480, background: 'rgba(99, 102, 241, 0.3)', top: -140, left: '10%', borderRadius: '50%', filter: 'blur(100px)', animation: 'floatingOrb 24s ease-in-out infinite', position: 'absolute' }} />
      <div className="auth-orb" style={{ width: 400, height: 400, background: 'rgba(139, 92, 246, 0.22)', bottom: -120, right: '8%', borderRadius: '50%', filter: 'blur(100px)', animation: 'floatingOrb 24s ease-in-out infinite', animationDelay: '-9s', position: 'absolute' }} />
      <div className="auth-orb" style={{ width: 300, height: 300, background: 'rgba(236, 72, 153, 0.16)', top: '30%', left: '55%', borderRadius: '50%', filter: 'blur(90px)', animation: 'floatingOrb 24s ease-in-out infinite', animationDelay: '-16s', position: 'absolute' }} />
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}

function FeatureVisual({ gradient, icon }: { gradient: string; icon: React.ReactNode }) {
  return (
    <div className={`relative h-36 rounded-xl overflow-hidden bg-gradient-to-br ${gradient} mb-5`}>
      <div className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-lg">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon}
          </svg>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-white dark:bg-gray-950 font-inter">
      {/* Header */}
      <header className="sticky top-0 z-50 header-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/tab-icon.png" alt={APP_NAME} className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">{APP_NAME}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm" className="btn-premium">Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0520 0%, #0f0c29 20%, #302b63 55%, #24243e 100%)' }}>
        <LandingOrbs />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-full px-4 py-1.5 text-xs font-medium text-indigo-200/70 mb-8"
          >
            The all-in-one workspace for teams who ship
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, type: 'spring', stiffness: 100 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight"
          >
            Manage projects<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              like a pro.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-indigo-200/50 max-w-2xl mx-auto leading-relaxed"
          >
            Plan, track, and deliver projects faster — tasks, real-time chat, time tracking, and more, all in one workspace built for teams who ship.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/signup">
              <Button size="lg" className="btn-premium px-8">
                Get Started
              </Button>
            </Link>
            <a href="#pricing">
              <Button size="lg" variant="outline" className="bg-white/[0.06] border-white/[0.12] text-white hover:bg-white/[0.12] hover:border-white/20">
                See Pricing
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Everything your team needs
            </h2>
            <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
              Built from the ground up for teams that need to plan, collaborate, and ship — without juggling five different tools.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                className="glass-card rounded-2xl p-5 hover:-translate-y-1 transition-transform duration-300"
              >
                <FeatureVisual gradient={feature.gradient} icon={feature.icon} />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900/40 relative">
        <div className="absolute inset-0 pattern-dots pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Simple, storage-based pricing
            </h2>
            <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
              Pick a plan based on how much storage your team needs. Upgrade anytime as you grow.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4 }}
                className={`rounded-2xl p-7 relative ${plan.highlighted
                  ? 'bg-gray-900 dark:bg-gray-950 text-white shadow-2xl shadow-indigo-500/20 md:-translate-y-3 border border-indigo-500/30'
                  : 'glass-card'
                  }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg">
                    MOST POPULAR
                  </div>
                )}
                <h3 className={`text-sm font-bold uppercase tracking-wide ${plan.highlighted ? 'text-indigo-300' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-4xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>₹{plan.price}</span>
                  <span className={`text-sm ${plan.highlighted ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>/month</span>
                </div>
                <p className={`mt-1.5 text-sm ${plan.highlighted ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{plan.storage} storage</p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <svg className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? 'text-indigo-400' : 'text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlighted ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/signup" className="block mt-7">
                  <Button
                    className={`w-full ${plan.highlighted ? 'btn-premium' : ''}`}
                    variant={plan.highlighted ? 'primary' : 'outline'}
                  >
                    Get Started
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0520 0%, #0f0c29 20%, #302b63 55%, #24243e 100%)' }}>
        <LandingOrbs />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to get your team organized?
          </h2>
          <p className="mt-4 text-base text-indigo-200/50">
            Sign up and have your workspace running in minutes.
          </p>
          <Link to="/signup" className="inline-block mt-8">
            <Button size="lg" className="btn-premium px-10">Get Started</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/tab-icon.png" alt={APP_NAME} className="w-6 h-6 rounded-md" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">{APP_NAME}</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
