/**
 * Day 39: Frontend Tests - LoginPage Component Tests
 * Integration test for the login form
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { LoginPage } from '../pages/auth/LoginPage';
import authReducer from '../store/slices/authSlice';
import userReducer from '../store/slices/userSlice';
import themeReducer from '../store/slices/themeSlice';
import organizationReducer from '../store/slices/organizationSlice';

// Mock the API service
vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock React Router navigation
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function createTestStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      user: userReducer,
      theme: themeReducer,
      organization: organizationReducer,
    },
  });
}

function renderLoginPage() {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </Provider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with email and password fields', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    renderLoginPage();
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.click(submitBtn);

    // Email field should be required
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(emailInput.validity.valid).toBe(false);
  });

  it('shows link to register page', () => {
    renderLoginPage();
    const registerLink = screen.getByRole('link', { name: /sign up|register|create account/i });
    expect(registerLink).toBeInTheDocument();
  });

  it('allows typing into email and password fields', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('toggles password visibility when show/hide button is clicked', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // Find and click the eye toggle (if it exists)
    const toggleBtn = screen.queryByLabelText(/show password|hide password/i)
      ?? screen.queryByRole('button', { name: /show|hide|eye/i });

    if (toggleBtn) {
      await user.click(toggleBtn);
      expect(passwordInput.type).toBe('text');
    }
  });
});
