import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { APP_NAME } from '../../utils/constants';

interface Plan {
  id: string;
  name: string;
  priceInPaise: number;
  storageLimitGB: number;
}

type Step = 'form' | 'pending-approval';

export function CompanySignupPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('form');

  useEffect(() => {
    api.get<{ success: boolean; data: Plan[] }>('/plans')
      .then(res => {
        const list = res.data.data;
        setPlans(list);
        if (list.length > 0) setPlanId(list[0].id);
      })
      .catch(() => setError('Could not load plans. Please refresh and try again.'));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!planId) {
      setError('Please select a plan.');
      return;
    }
    setLoading(true);
    try {
      // Online checkout is disabled for now (see auth.service.ts's registerCompany/login) --
      // signup just queues the request for manual approval instead of collecting payment here.
      await api.post('/auth/register-company', { companyName, firstName, lastName, email, password, planId });
      setStep('pending-approval');
      setLoading(false);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Signup failed. Please try again.');
      } else {
        setError('Signup failed. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-950 font-inter flex flex-col">
      <header className="header-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/tab-icon.png" alt={APP_NAME} className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">{APP_NAME}</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          {step === 'pending-approval' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Request received, {companyName}!</h2>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                Your workspace is set up and waiting on approval. We'll email <strong className="text-gray-700 dark:text-gray-300">{email}</strong> as soon as it's active — then you can log in with the password you just created.
              </p>
              <Link to="/" className="inline-block mt-7">
                <Button variant="outline">Back to home</Button>
              </Link>
            </motion.div>
          )}

          {step === 'form' && (
            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="glass-card rounded-2xl p-7 sm:p-9 space-y-7"
            >
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Create your company workspace</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Set up {APP_NAME} for your team in a couple of minutes.</p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3.5 rounded-xl border border-red-100 dark:border-red-800/50">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  id="companyName"
                  label="Company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="firstName"
                    label="Your first name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <Input
                    id="lastName"
                    label="Your last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <Input
                  id="email"
                  label="Work email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
                <Input
                  id="password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Choose a plan</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setPlanId(plan.id)}
                      className={`text-left rounded-xl p-4 border-2 transition-all ${planId === plan.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                    >
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{plan.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{plan.storageLimitGB} GB storage</p>
                      <p className="text-lg font-extrabold text-gray-900 dark:text-white mt-2">
                        ₹{plan.priceInPaise / 100}<span className="text-xs font-medium text-gray-400">/mo</span>
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full btn-premium" size="lg" disabled={loading || plans.length === 0}>
                {loading ? 'Submitting your request…' : 'Request access'}
              </Button>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2">
                  Log in
                </Link>
              </p>
            </motion.form>
          )}
        </div>
      </div>
    </div>
  );
}
