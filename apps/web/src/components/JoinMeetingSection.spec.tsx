import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JoinMeetingSection } from "./JoinMeetingSection";

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    mode: "ONLINE",
    meetingLink: null,
    meetingAddress: null,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    ...overrides,
  };
}

describe("JoinMeetingSection", () => {
  it("prompts to add a link via chat when nothing is set (ONLINE)", () => {
    render(<JoinMeetingSection booking={makeBooking() as never} bookingId="b1" />);
    expect(screen.getByText("Belum ada link pertemuan.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Atur melalui obrolan" })).toHaveAttribute(
      "href",
      "/bookings/b1/chat",
    );
  });

  it("shows a working 'Gabung Sesi' button opening the external link", () => {
    render(
      <JoinMeetingSection
        booking={makeBooking({ meetingLink: "https://zoom.us/j/123456789" }) as never}
        bookingId="b1"
      />,
    );
    const link = screen.getByRole("link", { name: "Gabung Sesi" });
    expect(link).toHaveAttribute("href", "https://zoom.us/j/123456789");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("highlights the join button as the session approaches", () => {
    render(
      <JoinMeetingSection
        booking={
          makeBooking({
            meetingLink: "https://zoom.us/j/123456789",
            scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }) as never
        }
        bookingId="b1"
      />,
    );
    expect(screen.getByText(/akan\/sedang berlangsung/)).toBeInTheDocument();
  });

  it("does not highlight the join button when the session is far away", () => {
    render(
      <JoinMeetingSection
        booking={makeBooking({ meetingLink: "https://zoom.us/j/123456789" }) as never}
        bookingId="b1"
      />,
    );
    expect(screen.queryByText(/akan\/sedang berlangsung/)).not.toBeInTheDocument();
  });

  it("prompts to add an address via chat when nothing is set (OFFLINE)", () => {
    render(
      <JoinMeetingSection booking={makeBooking({ mode: "OFFLINE" }) as never} bookingId="b1" />,
    );
    expect(screen.getByText("Belum ada alamat pertemuan.")).toBeInTheDocument();
  });

  it("shows a working 'Buka di Peta' button for an OFFLINE session with an address", () => {
    render(
      <JoinMeetingSection
        booking={makeBooking({ mode: "OFFLINE", meetingAddress: "Jl. Contoh No. 1" }) as never}
        bookingId="b1"
      />,
    );
    expect(screen.getByText("Jl. Contoh No. 1")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Buka di Peta" });
    expect(link.getAttribute("href")).toContain(
      "https://www.google.com/maps/search/?api=1&query=",
    );
    expect(link.getAttribute("href")).toContain(encodeURIComponent("Jl. Contoh No. 1"));
  });
});
