import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseLocation = jest.fn();
const mockUseNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate,
}));

const mockUseAuth = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

let Login;

function setAuthState(overrides) {
  const defaults = {
    user: null,
    signIn: jest.fn().mockResolvedValue(undefined),
    signUp: jest.fn().mockResolvedValue(undefined),
    signInWithGoogle: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    isAuthenticated: false,
    loading: false,
    firebaseAvailable: false,
  };
  mockUseAuth.mockReturnValue({ ...defaults, ...overrides });
}

function switchToSignup() {
  fireEvent.click(screen.getByText("Sign up"));
}

function getGenderSelect() {
  return screen.getByText("Gender").closest("div").querySelector("select");
}

function fillNamePhoneAge(name, phone, age) {
  fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText("+91-9876543210"), { target: { value: phone } });
  fireEvent.change(screen.getByPlaceholderText("25"), { target: { value: String(age) } });
}

function fillEmailPassword(email, password) {
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: email } });
  const pwInput = document.querySelector('input[type="password"]');
  fireEvent.change(pwInput, { target: { value: password } });
}

function clickCreateAccount() {
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocation.mockReturnValue({ pathname: "/login", search: "", hash: "", state: null });
  Login = require("../Login").default;
});

// ---------------------------------------------------------------------------
// 1. MODE SWITCHING
// ---------------------------------------------------------------------------
describe("Mode switching", () => {
  test("shows 'Welcome Back' heading and 'Sign In' button in login mode", () => {
    setAuthState({});
    render(<Login />);
    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  test("switching to signup shows 'Create Account' heading", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    expect(screen.getAllByText("Create Account").length).toBeGreaterThanOrEqual(1);
  });

  test("switching back to login shows 'Welcome Back' again", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    fireEvent.click(screen.getByText("Sign in"));
    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. SIGNUP FIELDS VISIBILITY
// ---------------------------------------------------------------------------
describe("Signup fields visibility", () => {
  test("Display Name is hidden in login, visible in signup", () => {
    setAuthState({});
    render(<Login />);
    expect(screen.queryByText("Display Name")).not.toBeInTheDocument();
    switchToSignup();
    expect(screen.getByText("Display Name")).toBeInTheDocument();
  });

  test("Phone Number is hidden in login, visible in signup", () => {
    setAuthState({});
    render(<Login />);
    expect(screen.queryByText("Phone Number")).not.toBeInTheDocument();
    switchToSignup();
    expect(screen.getByText("Phone Number")).toBeInTheDocument();
  });

  test("Age field is hidden in login, visible in signup", () => {
    setAuthState({});
    render(<Login />);
    expect(screen.queryByText("Age")).not.toBeInTheDocument();
    switchToSignup();
    expect(screen.getByText("Age")).toBeInTheDocument();
  });

  test("Gender field is hidden in login, visible in signup", () => {
    setAuthState({});
    render(<Login />);
    expect(screen.queryByText("Gender")).not.toBeInTheDocument();
    switchToSignup();
    expect(screen.getByText("Gender")).toBeInTheDocument();
  });

  test("Email and Password always visible in both modes", () => {
    setAuthState({});
    render(<Login />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    switchToSignup();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  test("switching back to login hides all signup fields", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    expect(screen.getByText("Phone Number")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sign in"));
    expect(screen.queryByText("Phone Number")).not.toBeInTheDocument();
    expect(screen.queryByText("Age")).not.toBeInTheDocument();
    expect(screen.queryByText("Gender")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. PHONE INPUT
// ---------------------------------------------------------------------------
describe("Phone input", () => {
  test("is a tel input type", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    expect(screen.getByPlaceholderText("+91-9876543210")).toHaveAttribute("type", "tel");
  });

  test("accepts user input", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    const input = screen.getByPlaceholderText("+91-9876543210");
    fireEvent.change(input, { target: { value: "+91-9999999999" } });
    expect(input).toHaveValue("+91-9999999999");
  });

  test("passes phone to signUp on submit", async () => {
    const signUpMock = jest.fn().mockResolvedValue(undefined);
    setAuthState({ signUp: signUpMock });
    render(<Login />);
    switchToSignup();

    fillNamePhoneAge("Test User", "+91-9999999999", 30);
    fireEvent.change(getGenderSelect(), { target: { value: "male" } });
    fillEmailPassword("test@test.com", "test123");
    clickCreateAccount();

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(
        "test@test.com",
        "test123",
        "Test User",
        expect.objectContaining({ phone: "+91-9999999999", age: 30, gender: "male" })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// 4. AGE INPUT
// ---------------------------------------------------------------------------
describe("Age input", () => {
  test("is a number input type with correct min/max", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    const input = screen.getByPlaceholderText("25");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("min", "10");
    expect(input).toHaveAttribute("max", "120");
  });

  test("accepts numeric input", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    const input = screen.getByPlaceholderText("25");
    fireEvent.change(input, { target: { value: "35" } });
    expect(input).toHaveValue(35);
  });

  test("passes age as number when provided", async () => {
    const signUpMock = jest.fn().mockResolvedValue(undefined);
    setAuthState({ signUp: signUpMock });
    render(<Login />);
    switchToSignup();

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByPlaceholderText("25"), { target: { value: "25" } });
    fillEmailPassword("test@test.com", "test123");
    clickCreateAccount();

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(
        "test@test.com",
        "test123",
        "Test User",
        expect.objectContaining({ age: 25 })
      );
    });
  });

  test("passes age as null when empty", async () => {
    const signUpMock = jest.fn().mockResolvedValue(undefined);
    setAuthState({ signUp: signUpMock });
    render(<Login />);
    switchToSignup();

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Test User" } });
    fillEmailPassword("test@test.com", "test123");
    clickCreateAccount();

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(
        "test@test.com",
        "test123",
        "Test User",
        expect.objectContaining({ age: null })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// 5. GENDER SELECT
// ---------------------------------------------------------------------------
describe("Gender select", () => {
  test("renders all gender options", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    expect(screen.getByText("Male")).toBeInTheDocument();
    expect(screen.getByText("Female")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText("Prefer not to say")).toBeInTheDocument();
  });

  test("allows selecting each gender option", () => {
    setAuthState({});
    render(<Login />);
    switchToSignup();
    const select = getGenderSelect();
    fireEvent.change(select, { target: { value: "male" } });
    expect(select.value).toBe("male");
    fireEvent.change(select, { target: { value: "female" } });
    expect(select.value).toBe("female");
    fireEvent.change(select, { target: { value: "prefer_not_to_say" } });
    expect(select.value).toBe("prefer_not_to_say");
  });

  test("passes gender to signUp", async () => {
    const signUpMock = jest.fn().mockResolvedValue(undefined);
    setAuthState({ signUp: signUpMock });
    render(<Login />);
    switchToSignup();

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Test User" } });
    fireEvent.change(getGenderSelect(), { target: { value: "female" } });
    fillEmailPassword("test@test.com", "test123");
    clickCreateAccount();

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(
        "test@test.com",
        "test123",
        "Test User",
        expect.objectContaining({ gender: "female" })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// 6. COMPLETE SIGNUP FLOW
// ---------------------------------------------------------------------------
describe("Complete signup flow", () => {
  test("calls signUp with all profile fields and navigates", async () => {
    const signUpMock = jest.fn().mockResolvedValue(undefined);
    setAuthState({ signUp: signUpMock });
    render(<Login />);
    switchToSignup();

    fillNamePhoneAge("Jane Doe", "+91-8888888888", 28);
    fireEvent.change(getGenderSelect(), { target: { value: "female" } });
    fillEmailPassword("jane@example.com", "password123");
    clickCreateAccount();

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(
        "jane@example.com",
        "password123",
        "Jane Doe",
        expect.objectContaining({ phone: "+91-8888888888", age: 28, gender: "female" })
      );
    });

    await waitFor(() => {
      expect(mockUseNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  test("validates display name is required", async () => {
    const signUpMock = jest.fn().mockResolvedValue(undefined);
    setAuthState({ signUp: signUpMock });
    render(<Login />);
    switchToSignup();

    fillEmailPassword("test@test.com", "test123");
    clickCreateAccount();

    await waitFor(() => {
      expect(screen.getByText(/Display name is required/i)).toBeInTheDocument();
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  test("no validation error when all required fields filled", async () => {
    const signUpMock = jest.fn().mockResolvedValue(undefined);
    setAuthState({ signUp: signUpMock });
    render(<Login />);
    switchToSignup();

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Test User" } });
    fillEmailPassword("t@t.com", "test123");
    clickCreateAccount();

    await waitFor(() => {
      expect(screen.queryByText(/Display name is required/i)).not.toBeInTheDocument();
    });
  });
});
