import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import { ThemeProvider } from './components/ThemeProvider';
import App from './App';
import './index.css';

// Apply saved theme BEFORE React renders to prevent flash
try {
  const storedUser = sessionStorage.getItem('currentUser');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    const savedTheme = localStorage.getItem(`theme_${user.id}`);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      }
    }
    // 'light' — no class needed (default)
  }
} catch {}

// Handle legacy /clickup/ paths by redirecting to root
if (window.location.pathname.startsWith('/clickup')) {
  window.location.href = window.location.origin + '/';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Provider>
  </StrictMode>
);
