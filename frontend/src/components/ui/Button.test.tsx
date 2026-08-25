/**
 * Day 39: Frontend Tests - Button Component Tests
 * Uses Vitest + React Testing Library
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with default primary variant', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    render(<Button>Save Changes</Button>);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Submit</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies disabled attribute when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders danger variant', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('red');
  });

  it('applies custom className', () => {
    render(<Button className="my-custom-class">Click</Button>);
    expect(screen.getByRole('button').className).toContain('my-custom-class');
  });

  it('renders size sm correctly', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-xs');
  });

  it('renders size lg correctly', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-sm');
    expect(btn.className).toContain('py-3');
  });

  it('forwards ref to the button element', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<Button ref={ref}>Ref button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('passes additional HTML attributes', () => {
    render(<Button id="my-btn" type="submit">Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('id', 'my-btn');
    expect(btn).toHaveAttribute('type', 'submit');
  });
});
