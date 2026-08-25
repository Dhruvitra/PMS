import { useState } from 'react'
import { login, setAuthTokens } from '../services/api'

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { accessToken, refreshToken } = await login(email, password)
      setAuthTokens({ accessToken, refreshToken })
      await window.trackerApi.setTokens({ accessToken, refreshToken })
      // Register as a Windows startup item so tracking is available without the employee
      // needing to manually reopen the app after every reboot. Best-effort -- a failure here
      // shouldn't block sign-in.
      window.trackerApi.setAutoLaunch(true).catch((err) => console.error('Failed to enable auto-launch:', err))
      onLoggedIn()
    } catch (err: any) {
      if (err?.response) {
        // The server actually responded (e.g. real 401) — safe to show its message.
        setError(err.response.data?.message || 'Invalid email or password')
      } else {
        // No response reached us at all — a network/CSP/connectivity problem,
        // NOT a wrong password. Say so explicitly instead of guessing.
        console.error('Login request failed with no server response:', err)
        setError(`Could not reach the server (${err?.message || 'network error'}). This is not a password problem.`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.logoWrap}>
        <div style={styles.logoCircle}>P</div>
        <div style={styles.title}>Producteev Tracker</div>
        <div style={styles.subtitle}>Sign in with your Producteev Pro account</div>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          style={styles.input}
          placeholder="you@company.com"
        />

        <label style={styles.label}>Password</label>
        <div style={styles.passwordWrap}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...styles.input, flex: 1, border: 'none' }}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={styles.showPasswordButton}
            tabIndex={-1}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={loading} style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: '32px 28px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff'
  },
  logoWrap: { textAlign: 'center', marginTop: 24, marginBottom: 32 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    fontWeight: 900,
    margin: '0 auto 16px'
  },
  title: { fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' },
  subtitle: { fontSize: 12.5, opacity: 0.85, marginTop: 6 },
  form: {
    background: '#fff',
    borderRadius: 16,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#111827'
  },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', marginTop: 10 },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    fontSize: 14,
    outline: 'none'
  },
  passwordWrap: {
    display: 'flex',
    alignItems: 'stretch',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  },
  showPasswordButton: {
    padding: '0 12px',
    border: 'none',
    borderLeft: '1px solid #e5e7eb',
    background: '#f9fafb',
    color: '#6366f1',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  error: { color: '#dc2626', fontSize: 12.5, fontWeight: 600, marginTop: 8 },
  button: {
    marginTop: 18,
    padding: '11px 0',
    borderRadius: 10,
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer'
  }
}
