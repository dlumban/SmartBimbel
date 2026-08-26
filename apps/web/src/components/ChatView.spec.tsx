import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChatView } from "./ChatView";

const getBooking = vi.fn();
vi.mock("../lib/bookings", async () => {
  const actual = await vi.importActual<typeof import("../lib/bookings")>("../lib/bookings");
  return { ...actual, getBooking: (...args: unknown[]) => getBooking(...args) };
});

vi.mock("./ChatPanel", () => ({ ChatPanel: () => <div data-testid="chat-panel" /> }));
vi.mock("./MeetingInfoSection", () => ({
  MeetingInfoSection: () => <div data-testid="meeting-info" />,
}));
vi.mock("./ChatModerationBar", () => ({
  ChatModerationBar: () => <div data-testid="moderation-bar" />,
}));

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    subject: { id: "s1", name: "Matematika" },
    mode: "ONLINE",
    meetingLink: null,
    meetingAddress: null,
    ...overrides,
  };
}

describe("ChatView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the meeting info, chat panel, and moderation bar once the booking loads", async () => {
    getBooking.mockResolvedValue(makeBooking());
    render(<ChatView bookingId="b1" />);

    expect(await screen.findByText("Matematika")).toBeInTheDocument();
    expect(screen.getByTestId("meeting-info")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-bar")).toBeInTheDocument();
  });

  it("shows an error state when the booking fails to load", async () => {
    getBooking.mockRejectedValue(new Error("boom"));
    render(<ChatView bookingId="b1" />);

    expect(await screen.findByText("Gagal memuat booking.")).toBeInTheDocument();
  });
});
