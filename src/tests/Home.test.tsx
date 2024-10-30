import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Home from '@/components/pages/Home';
import { getByTestId } from '@testing-library/dom';



// Mocking the worker and other dependencies
vi.mock('@/workers/worker.js?worker', () => {
  return {
    default: class {
      postMessage = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
  };
});

vi.mock('@/utils/db/db-helper', () => ({
  getDB: vi.fn().mockResolvedValue({}),
  initSchema: vi.fn().mockResolvedValue({}),
  countRows: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/utils/db/db-documents', () => ({
  search: vi.fn().mockResolvedValue([]),
  searchWithPage: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/utils/db/db-rules', () => ({
  getRootRules: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/utils/helpers', () => ({
  timeSince: vi.fn().mockReturnValue('just now'),
}));

describe('Home Component', () => {
  it('renders without crashing', () => {
    render(<Home />);
    expect(screen.getByText(/DocuGenie/i)).toBeDefined();
  });

  it('submits a prompt and updates the history', async () => {
    render(<Home />);
    
    const textarea = screen.getByPlaceholderText(/Enter your prompt here.../i);
    const submitButton = screen.getByText(/Submit/i);

    fireEvent.change(textarea, { target: { value: 'Test prompt' } });
    fireEvent.click(submitButton);
    fireEvent.change(textarea, { target: { value: '' } });
    
    await waitFor(() => {
        expect(
            screen.getByText(/Test prompt/i),
        ).toBeDefined();
    });
  });

  it('clears the prompt input when Clear button is clicked', () => {
    render(<Home />);
    
    const textarea = screen.getByPlaceholderText(/Enter your prompt here.../i);
    const clearButton = screen.getByText(/Clear/i);

    fireEvent.change(textarea, { target: { value: 'Test prompt' } });
    fireEvent.click(clearButton);

    expect(textarea).toHaveProperty('value', '');
  });

  it('disables the submit button when input is empty or loading', () => {
    render(<Home />);
    
    const submitButton = screen.getByText(/Submit/i);
    expect(submitButton).toHaveProperty('disabled', true);

    const textarea = screen.getByPlaceholderText(/Enter your prompt here.../i);
    fireEvent.change(textarea, { target: { value: 'Test prompt' } });

    expect(submitButton).toHaveProperty('disabled', false);
  });

  it('copies the answer result to clipboard', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(''),
      },
    });

    render(<Home />);
    
    const copyButton = screen.getByTestId('copy-button');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });
});