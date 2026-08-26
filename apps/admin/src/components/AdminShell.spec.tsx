import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AdminShell } from "./AdminShell";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/",
}));

let sessionUser: { name: string | null; email: string | null; adminRole: string | null } | null = null;
let loading = true;
let isAdmin = false;
const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser, loading, isAdmin, signOut }),
}));

describe("AdminShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = null;
    loading = true;
    isAdmin = false;
  });

  it("shows a loading state while the session is resolving", () => {
    loading = true;
    render(
      <AdminShell>
        <p>Konten</p>
      </AdminShell>,
    );
    expect(screen.queryByText("Konten")).not.toBeInTheDocument();
  });

  it("redirects to /login when there's no session", async () => {
    loading = false;
    sessionUser = null;
    render(
      <AdminShell>
        <p>Konten</p>
      </AdminShell>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("redirects to /login when the session isn't an admin", async () => {
    loading = false;
    sessionUser = { name: "Budi", email: "budi@example.com", adminRole: null };
    isAdmin = false;
    render(
      <AdminShell>
        <p>Konten</p>
      </AdminShell>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("renders the shell and children for a signed-in admin", async () => {
    loading = false;
    sessionUser = { name: "Budi Admin", email: "admin@example.com", adminRole: "SUPER_ADMIN" };
    isAdmin = true;
    render(
      <AdminShell>
        <p>Konten</p>
      </AdminShell>,
    );
    expect(await screen.findByText("Konten")).toBeInTheDocument();
    expect(screen.getByText(/Budi Admin/)).toBeInTheDocument();
    expect(screen.getByText(/Super Admin/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows Support (not Super Admin) for a SUPPORT admin", async () => {
    loading = false;
    sessionUser = { name: "Support Staff", email: "support@example.com", adminRole: "SUPPORT" };
    isAdmin = true;
    render(
      <AdminShell>
        <p>Konten</p>
      </AdminShell>,
    );
    expect(await screen.findByText(/Support/)).toBeInTheDocument();
  });
});
