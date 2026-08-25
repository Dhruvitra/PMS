import { useEffect, useState } from 'react'
import { LoginPage } from './pages/LoginPage'
import { TrackerPage } from './pages/TrackerPage'
import { setAuthTokens } from './services/api'

function App(): React.JSX.Element {
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    ;(async () => {
      const tokens = await window.trackerApi.getTokens()
      if (tokens) {
        setAuthTokens(tokens)
        setIsLoggedIn(true)
        // Tokens (and therefore login state) persist across reinstalls/updates, so most
        // returning employees never hit LoginPage's setAutoLaunch call -- do it here too so
        // updating to a new build still gets them registered as a Windows startup item.
        window.trackerApi.setAutoLaunch(true).catch((err) => console.error('Failed to enable auto-launch:', err))
      }
      setCheckingAuth(false)
    })()
  }, [])

  if (checkingAuth) {
    return <div style={{ height: '100vh', background: '#f8f9fb' }} />
  }

  return isLoggedIn ? (
    <TrackerPage onLogout={() => setIsLoggedIn(false)} />
  ) : (
    <LoginPage onLoggedIn={() => setIsLoggedIn(true)} />
  )
}

export default App
