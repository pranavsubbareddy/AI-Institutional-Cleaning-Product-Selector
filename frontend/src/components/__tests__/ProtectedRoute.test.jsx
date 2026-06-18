import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseLocation = jest.fn();
const mockUseNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }) => <a href={to} {...rest}>{children}</a>,
  Navigate: ({ to, state }) => <div data-testid="navigate" data-to={to} data-state={JSON.stringify(state)} />,
  Outlet: () => <div data-testid="outlet" />,
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate,
}));

jest.mock("framer-motion", () => {
  const Div = ({ children, initial, animate, exit, transition, variants, custom, layout, whileHover, whileTap, ...props }) =>
    <div {...props}>{children}</div>;
  const P = ({ children, initial, animate, exit, transition, variants, custom, ...props }) =>
    <p {...props}>{children}</p>;
  return { motion: { div: Div, p: P } };
});

const mockUseAuth = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

let ProtectedRoute;

function setAuthState(overrides) {
  const defaults = {
    user: null,
    isAuthenticated: false,
    loading: false,
  };
  mockUseAuth.mockReturnValue({ ...defaults, ...overrides });
}

function makeUser(overrides = {}) {
  return { uid: "test-123", email: "test@example.com", displayName: "Test User", role: "field_staff", ...overrides };
}

const ADMIN_ROUTES = [
  "/admin-portal", "/admin",
];

const PUBLIC_ROUTES = [
  "/", "/form", "/dashboard", "/profile", "/detail", "/edit",
  "/recommendations",
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocation.mockReturnValue({ pathname: "/dashboard", search: "", hash: "", state: null });
  ProtectedRoute = require("../ProtectedRoute").default;
});

describe("Loading state", () => {
  test("shows loading indicator when loading is true", () => {
    setAuthState({ loading: true });
    render(<ProtectedRoute />);
    expect(screen.getByText("Verifying your session...")).toBeInTheDocument();
  });

  test("does NOT redirect when loading", () => {
    setAuthState({ loading: true });
    render(<ProtectedRoute />);
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });
});

describe("Not authenticated", () => {
  test("redirects to /login with current path in state", () => {
    mockUseLocation.mockReturnValue({ pathname: "/crm" });
    setAuthState({});
    render(<ProtectedRoute />);
    const nav = screen.getByTestId("navigate");
    expect(nav).toHaveAttribute("data-to", "/login");
    expect(JSON.parse(nav.getAttribute("data-state"))).toEqual({ from: "/crm" });
  });
});

describe("Non-admin on public routes", () => {
  PUBLIC_ROUTES.forEach(path => {
    test(`allows access to '${path}'`, () => {
      mockUseLocation.mockReturnValue({ pathname: path });
      setAuthState({ user: makeUser({ role: "field_staff" }), isAuthenticated: true });
      render(<ProtectedRoute />);
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });
  });
});

describe("Non-admin on admin routes", () => {
  ADMIN_ROUTES.forEach(path => {
    test(`blocks access to '${path}' and redirects to /dashboard`, () => {
      mockUseLocation.mockReturnValue({ pathname: path });
      setAuthState({ user: makeUser({ role: "field_staff" }), isAuthenticated: true });
      render(<ProtectedRoute />);
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/dashboard");
    });
  });

  test("blocks /admin/users (matched by /admin prefix)", () => {
    mockUseLocation.mockReturnValue({ pathname: "/admin/users" });
    setAuthState({ user: makeUser({ role: "field_staff" }), isAuthenticated: true });
    render(<ProtectedRoute />);
    const nav = screen.getByTestId("navigate");
    expect(nav).toHaveAttribute("data-to", "/dashboard");
  });
});

describe("Admin on public routes", () => {
  PUBLIC_ROUTES.forEach(path => {
    test(`allows access to '${path}'`, () => {
      mockUseLocation.mockReturnValue({ pathname: path });
      setAuthState({ user: makeUser({ role: "admin" }), isAuthenticated: true });
      render(<ProtectedRoute />);
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });
  });
});

describe("Admin on admin routes", () => {
  ADMIN_ROUTES.forEach(path => {
    test(`allows access to '${path}'`, () => {
      mockUseLocation.mockReturnValue({ pathname: path });
      setAuthState({ user: makeUser({ role: "admin" }), isAuthenticated: true });
      render(<ProtectedRoute />);
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });
  });
});

describe("Unknown routes (fallback)", () => {
  const unknownRoutes = ["/some-random-page", "/api/test", "/unknown/path"];

  unknownRoutes.forEach(path => {
    test(`allows non-admin access to '${path}'`, () => {
      mockUseLocation.mockReturnValue({ pathname: path });
      setAuthState({ user: makeUser({ role: "field_staff" }), isAuthenticated: true });
      render(<ProtectedRoute />);
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    test(`allows admin access to '${path}'`, () => {
      mockUseLocation.mockReturnValue({ pathname: path });
      setAuthState({ user: makeUser({ role: "admin" }), isAuthenticated: true });
      render(<ProtectedRoute />);
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });
  });
});
