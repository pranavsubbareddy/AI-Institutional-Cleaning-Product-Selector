import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmailJSConfigWarning from '../EmailJSConfigWarning';

// ---------------------------------------------------------------------------
// Mock the emailService module
// ---------------------------------------------------------------------------
const mockIsEmailJSConfigured = jest.fn();

jest.mock('../../services/emailService', () => ({
  isEmailJSConfigured: () => mockIsEmailJSConfigured(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setEnvVars(config) {
  process.env.VITE_EMAILJS_PUBLIC_KEY = config.publicKey || '';
  process.env.VITE_EMAILJS_SERVICE_ID = config.serviceId || '';
  process.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID = config.templateId || '';
}

function clearEnvVars() {
  delete process.env.VITE_EMAILJS_PUBLIC_KEY;
  delete process.env.VITE_EMAILJS_SERVICE_ID;
  delete process.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID;
}

beforeEach(() => {
  localStorage.clear();
  clearEnvVars();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. RENDERING WHEN NOT CONFIGURED
// ---------------------------------------------------------------------------
describe('When EmailJS is NOT configured', () => {
  beforeEach(() => {
    mockIsEmailJSConfigured.mockReturnValue(false);
    setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
  });

  test('renders the warning banner with heading', () => {
    render(<EmailJSConfigWarning />);
    expect(screen.getByText('EmailJS Not Configured')).toBeInTheDocument();
  });

  test('shows description text', () => {
    render(<EmailJSConfigWarning />);
    expect(
      screen.getByText(/The email report feature requires EmailJS setup/)
    ).toBeInTheDocument();
  });

  test('shows all three env vars as missing with labels', () => {
    render(<EmailJSConfigWarning />);
    expect(screen.getByText('VITE_EMAILJS_PUBLIC_KEY')).toBeInTheDocument();
    expect(screen.getByText('VITE_EMAILJS_SERVICE_ID')).toBeInTheDocument();
    expect(screen.getByText('VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID')).toBeInTheDocument();

    expect(screen.getByText(/Public Key required/)).toBeInTheDocument();
    expect(screen.getByText(/Service ID required/)).toBeInTheDocument();
    expect(screen.getByText(/Template ID required/)).toBeInTheDocument();
  });

  test('shows dismiss button (when not inline)', () => {
    render(<EmailJSConfigWarning />);
    expect(screen.getByTitle('Dismiss')).toBeInTheDocument();
  });

  test('shows env file hint', () => {
    render(<EmailJSConfigWarning />);
    expect(screen.getByText(/Add these to your/)).toBeInTheDocument();
  });

  test('partially configured: shows some vars as configured, some as missing', () => {
    clearEnvVars();
    setEnvVars({ publicKey: 'test-key', serviceId: '', templateId: '' });

    render(<EmailJSConfigWarning />);

    expect(screen.queryByText(/Public Key required/)).not.toBeInTheDocument();
    expect(screen.getByText(/Service ID required/)).toBeInTheDocument();
    expect(screen.getByText(/Template ID required/)).toBeInTheDocument();
    expect(screen.getByText('✓ Configured')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. RENDERING WHEN CONFIGURED
// ---------------------------------------------------------------------------
describe('When EmailJS IS configured', () => {
  beforeEach(() => {
    mockIsEmailJSConfigured.mockReturnValue(true);
    setEnvVars({
      publicKey: 'test-pub-key',
      serviceId: 'test-service',
      templateId: 'test-template',
    });
  });

  test('does not render anything', () => {
    const { container } = render(<EmailJSConfigWarning />);
    expect(container.firstChild).toBeNull();
  });

  test('does not show warning heading', () => {
    render(<EmailJSConfigWarning />);
    expect(screen.queryByText('EmailJS Not Configured')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. INLINE MODE
// ---------------------------------------------------------------------------
describe('Inline mode', () => {
  beforeEach(() => {
    mockIsEmailJSConfigured.mockReturnValue(false);
    setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
  });

  test('renders warning without dismiss button', () => {
    render(<EmailJSConfigWarning inline={true} />);
    expect(screen.getByText('EmailJS Not Configured')).toBeInTheDocument();
    expect(screen.queryByTitle('Dismiss')).not.toBeInTheDocument();
  });

  test('uses compact padding class', () => {
    const { container } = render(<EmailJSConfigWarning inline={true} />);
    const outerDiv = container.firstChild;
    expect(outerDiv.className).toContain('p-4');
  });

  test('uses larger padding class when not inline', () => {
    const { container } = render(<EmailJSConfigWarning />);
    const outerDiv = container.firstChild;
    expect(outerDiv.className).toContain('p-5');
  });
});

// ---------------------------------------------------------------------------
// 4. DISMISS BEHAVIOR
// ---------------------------------------------------------------------------
describe('Dismiss behavior', () => {
  beforeEach(() => {
    mockIsEmailJSConfigured.mockReturnValue(false);
    setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
  });

  test('clicking dismiss hides the banner', () => {
    render(<EmailJSConfigWarning />);
    expect(screen.getByText('EmailJS Not Configured')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Dismiss'));

    expect(screen.queryByText('EmailJS Not Configured')).not.toBeInTheDocument();
  });

  test('sets localStorage key on dismiss', () => {
    render(<EmailJSConfigWarning />);
    fireEvent.click(screen.getByTitle('Dismiss'));
    expect(localStorage.getItem('gangamaxx_emailjs_warning_dismissed')).toBe('true');
  });

  test('banner does not render if previously dismissed', () => {
    localStorage.setItem('gangamaxx_emailjs_warning_dismissed', 'true');
    const { container } = render(<EmailJSConfigWarning />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. STORAGE KEY CONSISTENCY
// ---------------------------------------------------------------------------
describe('Storage key consistency', () => {
  beforeEach(() => {
    mockIsEmailJSConfigured.mockReturnValue(false);
    setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
  });

  test('uses the same storage key as Layout.jsx', () => {
    render(<EmailJSConfigWarning />);
    fireEvent.click(screen.getByTitle('Dismiss'));
    expect(localStorage.getItem('gangamaxx_emailjs_warning_dismissed')).toBe('true');
  });
});
