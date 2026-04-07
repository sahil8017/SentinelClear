import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../src/components/ui/Button';

describe('Button Component', () => {
  it('renders successfully with children label', () => {
    // Basic verification spec requirement for SentinelClear
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeDefined();
  });

  it('renders a spinner when isLoading is true', () => {
    const { container } = render(<Button isLoading>Submit</Button>);
    expect(container.querySelector('.animate-spin')).toBeDefined();
  });
});
