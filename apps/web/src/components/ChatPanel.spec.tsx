import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChatPanel } from "./ChatPanel";

const getChatToken = vi.fn();
vi.mock("../lib/chat", async () => {
  const actual = await vi.importActual<typeof import("../lib/chat")>("../lib/chat");
  return { ...actual, getChatToken: (...args: unknown[]) => getChatToken(...args) };
});

let sessionUser: { id: string; name: string | null } | null = { id: "u1", name: "Andi" };
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser }),
}));

const connectUser = vi.fn().mockResolvedValue(undefined);
const disconnectUser = vi.fn().mockResolvedValue(undefined);
const watch = vi.fn().mockResolvedValue(undefined);
const channelFn = vi.fn().mockReturnValue({ watch });

vi.mock("stream-chat", () => ({
  StreamChat: vi.fn().mockImplementation(() => ({
    connectUser,
    disconnectUser,
    channel: channelFn,
  })),
}));

vi.mock("stream-chat-react", () => ({
  Chat: ({ children }: { children: React.ReactNode }) => <div data-testid="stream-chat">{children}</div>,
  Channel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Window: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageList: () => <div data-testid="message-list" />,
  MessageComposerUI: () => <div data-testid="message-input" />,
  Thread: () => null,
}));

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "u1", name: "Andi" };
  });

  it("renders nothing when Stream isn't configured", async () => {
    const { ChatUnavailableError } = await import("../lib/chat");
    getChatToken.mockRejectedValue(new ChatUnavailableError());

    render(<ChatPanel bookingId="b1" />);

    await waitFor(() => {
      expect(screen.queryByText("Memuat obrolan...")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Obrolan belum tersedia")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stream-chat")).not.toBeInTheDocument();
  });

  it("shows a generic error state for an unexpected failure", async () => {
    getChatToken.mockRejectedValue(new Error("network down"));

    render(<ChatPanel bookingId="b1" />);

    expect(await screen.findByText("Gagal memuat obrolan.")).toBeInTheDocument();
  });

  it("renders nothing when the token response has no apiKey/channelId", async () => {
    getChatToken.mockResolvedValue({ token: "t", apiKey: null, channelId: null });

    render(<ChatPanel bookingId="b1" />);

    await waitFor(() => {
      expect(screen.queryByText("Memuat obrolan...")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Obrolan belum tersedia")).not.toBeInTheDocument();
    expect(connectUser).not.toHaveBeenCalled();
  });

  it("connects and renders the Stream thread when a real token is returned", async () => {
    getChatToken.mockResolvedValue({
      token: "fake-token",
      apiKey: "fake-key",
      channelId: "messaging:booking-b1",
    });

    render(<ChatPanel bookingId="b1" />);

    expect(await screen.findByTestId("stream-chat")).toBeInTheDocument();
    expect(connectUser).toHaveBeenCalledWith({ id: "u1", name: "Andi" }, "fake-token");
    expect(channelFn).toHaveBeenCalledWith("messaging", "booking-b1");
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("message-input")).toBeInTheDocument();
  });
});
