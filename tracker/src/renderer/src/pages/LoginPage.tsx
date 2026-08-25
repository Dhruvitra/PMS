import { useState } from 'react'
import { login, setAuthTokens } from '../services/api'
import { sounds } from '../utils/audio'

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
      sounds.playSuccess()
      window.trackerApi.setAutoLaunch(true).catch((err) => console.error('Failed to enable auto-launch:', err))
      onLoggedIn()
    } catch (err: any) {
      if (err?.response) {
        setError(err.response.data?.message || 'Invalid email or password')
      } else {
        console.error('Login request failed with no server response:', err)
        setError(`Could not reach the server (${err?.message || 'network error'}). Check connection.`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-viewport" style={{ padding: '24px', justifyContent: 'space-between', background: '#F8FAFC' }}>
      {/* Header / Brand */}
      <div style={{ textAlign: 'center', paddingTop: '18px', zIndex: 10 }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)'
          }}
        >
          <span style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF' }}>P</span>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Producteev Tracker
        </h1>
        <p style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
          Sign in to your workplace tracker
        </p>
      </div>

      {/* White Card Form */}
      <form onSubmit={handleSubmit} className="white-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', zIndex: 10 }}>
        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: '6px', color: '#475569' }}>
            Work Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="input-light"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label className="label-caps" style={{ display: 'block', marginBottom: '6px', color: '#475569' }}>
            Password
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-light"
              style={{ paddingRight: '60px' }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                color: '#4F46E5',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                padding: '4px 6px'
              }}
              tabIndex={-1}
            >
              {showPassword ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-login-submit shimmer-btn"
          style={{ marginTop: '6px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'SIGNING IN…' : 'SIGN IN'}
        </button>
      </form>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#94A3B8', zIndex: 10 }}>
        Enterprise Time & Activity Tracker • v1.1.3
      </div>
    </div>
  )
}
