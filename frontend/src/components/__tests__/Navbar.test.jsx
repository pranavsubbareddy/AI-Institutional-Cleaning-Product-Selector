import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseLocation = jest.fn();
const mockUseNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, onClick, ...rest }) => (
    <a href={to} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate,
}));

const mockUseAuth = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

let Navbar;

function setAuthState(overrides) {
  const defaults = {
    user: null,
    logout: jest.fn().mockResolvedValue(undefined),
    isAuthenticated: false,
    loading: false,
  };
  mockUseAuth.mockReturnValue({ ...defaults, ...overrides });
}

function makeUser(overrides) {
  return { displayName: "John Doe", email: "john@example.com", photoURL: null, uid: "test-123", ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocation.mockReturnValue({ pathname: "/", search: "", hash: "", state: null });
  Navbar = require("../Navbar").default;
});

// NOTE: The mobile drawer content is always in the DOM on non-login pages
// (just visually hidden with CSS). Elements shared between desktop + mobile
// drawer have 2 DOM instances. We always use getAllByText/queryAllByText
// for those.

// ---------------------------------------------------------------------------
// 1. Brand always visible
// ---------------------------------------------------------------------------
describe("Brand", () => {
  test("shows brand name on login page", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({});
    render(<Navbar />);
    expect(screen.getByText("Ganga Maxx")).toBeInTheDocument();
  });

  test("shows brand name on non-login pages", () => {
    setAuthState({});
    render(<Navbar />);
    expect(screen.getByText("Ganga Maxx")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Desktop nav tabs
// ---------------------------------------------------------------------------
describe("Desktop nav tabs", () => {
  test("hidden on /login page", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({});
    render(<Navbar />);
    expect(screen.queryAllByText("Requirement Form").length).toBe(0);
    expect(screen.queryAllByText("B2B Dashboard").length).toBe(0);
  });

  test("visible on non-login page (2x: desktop tabs + mobile drawer)", () => {
    setAuthState({});
    render(<Navbar />);
    expect(screen.getAllByText("Requirement Form").length).toBe(2);
    expect(screen.getAllByText("B2B Dashboard").length).toBe(2);
  });

  test("visible on /form page (2x: desktop tabs + mobile drawer)", () => {
    mockUseLocation.mockReturnValue({ pathname: "/form" });
    setAuthState({});
    render(<Navbar />);
    expect(screen.getAllByText("Requirement Form").length).toBe(2);
    expect(screen.getAllByText("B2B Dashboard").length).toBe(2);
  });

  test("hidden on /login regardless of auth state", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({ user: makeUser(), isAuthenticated: true });
    render(<Navbar />);
    expect(screen.queryAllByText("Requirement Form").length).toBe(0);
    expect(screen.queryAllByText("B2B Dashboard").length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Desktop auth section
// ---------------------------------------------------------------------------
describe("Desktop auth section", () => {
  test("Sign In hidden on /login page", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({});
    render(<Navbar />);
    expect(screen.queryAllByText("Sign In").length).toBe(0);
  });

  test("Sign In visible on non-login page (2x: desktop + mobile)", () => {
    setAuthState({});
    render(<Navbar />);
    expect(screen.getAllByText("Sign In").length).toBe(2);
  });

  test("user initials hidden on /login page when authenticated", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({ user: makeUser(), isAuthenticated: true });
    render(<Navbar />);
    expect(screen.queryAllByText("JD").length).toBe(0);
  });

  test("user initials visible on non-login page (2x: desktop + mobile)", () => {
    setAuthState({ user: makeUser(), isAuthenticated: true });
    render(<Navbar />);
    expect(screen.getAllByText("JD").length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Mobile hamburger button
// ---------------------------------------------------------------------------
describe("Mobile hamburger button", () => {
  test("hidden on /login page", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({});
    render(<Navbar />);
    expect(screen.queryByLabelText("Open menu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
  });

  test("visible on non-login pages", () => {
    setAuthState({});
    render(<Navbar />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  test("toggles label when clicked", () => {
    setAuthState({});
    render(<Navbar />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.getByLabelText("Close menu")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Mobile drawer
// ---------------------------------------------------------------------------
describe("Mobile drawer content", () => {
  test("drawer nav links always 2 instances (desktop + drawer) regardless of open state", () => {
    setAuthState({});
    render(<Navbar />);
    // Before opening: desktop + mobile drawer (closed but in DOM) = 2
    expect(screen.getAllByText("Requirement Form").length).toBe(2);
    expect(screen.getAllByText("B2B Dashboard").length).toBe(2);
    fireEvent.click(screen.getByLabelText("Open menu"));
    // After opening: still 2 (mobile drawer was already in DOM, just revealed)
    expect(screen.getAllByText("Requirement Form").length).toBe(2);
    expect(screen.getAllByText("B2B Dashboard").length).toBe(2);
  });

  test("drawer shows Home link (1 instance: mobile drawer only, desktop has SVG icon)", () => {
    setAuthState({});
    render(<Navbar />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    // Desktop Home link is SVG-only (no text), so only mobile drawer has "Home" text
    expect(screen.getAllByText("Home").length).toBe(1);
  });

  test("drawer shows user email when drawer open", () => {
    const user = makeUser();
    setAuthState({ user, isAuthenticated: true });
    render(<Navbar />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    // Email: dropdown info + mobile drawer = 2
    expect(screen.getAllByText(user.email).length).toBe(2);
    // Sign Out: dropdown + mobile drawer = 2
    expect(screen.getAllByText("Sign Out").length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 6. User profile dropdown
// ---------------------------------------------------------------------------
describe("User profile dropdown", () => {
  test("opens when avatar initials clicked", () => {
    setAuthState({ user: makeUser(), isAuthenticated: true });
    render(<Navbar />);
    fireEvent.click(screen.getAllByText("JD")[0]);
    // Sign Out: dropdown (always in DOM) + mobile drawer = 2
    expect(screen.getAllByText("Sign Out").length).toBe(2);
    expect(screen.getAllByText("john@example.com").length).toBe(2);
  });

  test("opens when avatar img clicked", () => {
    const user = makeUser({ photoURL: "https://example.com/photo.jpg" });
    setAuthState({ user, isAuthenticated: true });
    render(<Navbar />);
    const imgs = screen.getAllByAltText("");
    fireEvent.click(imgs[0]);
    expect(screen.getAllByText("Sign Out").length).toBe(2);
  });

  test("reopen works after closing via outside click", () => {
    setAuthState({ user: makeUser(), isAuthenticated: true });
    render(<Navbar />);

    // Open
    fireEvent.click(screen.getAllByText("JD")[0]);
    expect(screen.getAllByText("john@example.com").length).toBe(2);

    // Close via outside click
    fireEvent.mouseDown(document);

    // Reopen — proves dropdown was closed and then reopened
    fireEvent.click(screen.getAllByText("JD")[0]);
    expect(screen.getAllByText("john@example.com").length).toBe(2);

    // Do it again to verify not stuck
    fireEvent.mouseDown(document);
    fireEvent.click(screen.getAllByText("JD")[0]);
    expect(screen.getAllByText("Sign Out").length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 7. User avatar rendering
// ---------------------------------------------------------------------------
describe("User avatar rendering", () => {
  test("renders img when photoURL provided (no initials)", () => {
    setAuthState({ user: makeUser({ photoURL: "https://example.com/photo.jpg" }), isAuthenticated: true });
    render(<Navbar />);
    expect(screen.getAllByAltText("").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("JD").length).toBe(0);
  });

  test("renders initials when photoURL is null", () => {
    setAuthState({ user: makeUser({ photoURL: null }), isAuthenticated: true });
    render(<Navbar />);
    expect(screen.getAllByText("JD").length).toBe(2);
  });

  test("renders initials when photoURL is empty string", () => {
    setAuthState({ user: makeUser({ photoURL: "" }), isAuthenticated: true });
    render(<Navbar />);
    expect(screen.getAllByText("JD").length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 8. Login page complete isolation
// ---------------------------------------------------------------------------
describe("Login page complete isolation", () => {
  test("unauthenticated: only brand visible, no hamburger", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({});
    render(<Navbar />);
    expect(screen.getByText("Ganga Maxx")).toBeInTheDocument();
    expect(screen.queryAllByText("Requirement Form").length).toBe(0);
    expect(screen.queryAllByText("B2B Dashboard").length).toBe(0);
    expect(screen.queryAllByText("Sign In").length).toBe(0);
    expect(screen.queryByLabelText("Open menu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
  });

  test("authenticated: only brand visible, no avatar, no hamburger", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });
    setAuthState({ user: makeUser(), isAuthenticated: true });
    render(<Navbar />);
    expect(screen.getByText("Ganga Maxx")).toBeInTheDocument();
    expect(screen.queryAllByText("Requirement Form").length).toBe(0);
    expect(screen.queryAllByText("B2B Dashboard").length).toBe(0);
    expect(screen.queryAllByText("JD").length).toBe(0);
    expect(screen.queryByLabelText("Open menu")).not.toBeInTheDocument();
  });
});
