import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MeetingInfoSection } from "./MeetingInfoSection";

const setMeeting = vi.fn();
vi.mock("../lib/bookings", async () => {
  const actual = await vi.importActual<typeof import("../lib/bookings")>("../lib/bookings");
  return { ...actual, setMeeting: (...args: unknown[]) => setMeeting(...args) };
});

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    mode: "ONLINE",
    meetingLink: null,
    meetingAddress: null,
    ...overrides,
  };
}

describe("MeetingInfoSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state and lets the user set a Zoom link for an ONLINE booking", async () => {
    const onUpdated = vi.fn();
    setMeeting.mockResolvedValue(makeBooking({ meetingLink: "https://zoom.us/j/123456789" }));

    render(
      <MeetingInfoSection booking={makeBooking() as never} onUpdated={onUpdated} />,
    );

    expect(screen.getByText("Belum ada link pertemuan.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atur" }));

    fireEvent.change(screen.getByPlaceholderText("https://zoom.us/j/..."), {
      target: { value: "https://zoom.us/j/123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(setMeeting).toHaveBeenCalledWith("b1", { meetingLink: "https://zoom.us/j/123456789" }),
    );
    expect(onUpdated).toHaveBeenCalled();
  });

  it("rejects an invalid link before ever calling the API", async () => {
    render(<MeetingInfoSection booking={makeBooking() as never} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Atur" }));
    fireEvent.change(screen.getByPlaceholderText("https://zoom.us/j/..."), {
      target: { value: "https://evil.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(
      await screen.findByText("Link harus berupa URL Zoom atau Google Meet yang valid."),
    ).toBeInTheDocument();
    expect(setMeeting).not.toHaveBeenCalled();
  });

  it("renders the existing link and lets it be updated", async () => {
    const onUpdated = vi.fn();
    setMeeting.mockResolvedValue(makeBooking({ meetingLink: "https://meet.google.com/new-code" }));

    render(
      <MeetingInfoSection
        booking={makeBooking({ meetingLink: "https://zoom.us/j/old" }) as never}
        onUpdated={onUpdated}
      />,
    );

    expect(screen.getByRole("link", { name: "https://zoom.us/j/old" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ubah" }));
    fireEvent.change(screen.getByDisplayValue("https://zoom.us/j/old"), {
      target: { value: "https://meet.google.com/new-code" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });

  it("shows an empty state and address input for an OFFLINE booking", async () => {
    const onUpdated = vi.fn();
    setMeeting.mockResolvedValue(makeBooking({ mode: "OFFLINE", meetingAddress: "Jl. Contoh" }));

    render(
      <MeetingInfoSection booking={makeBooking({ mode: "OFFLINE" }) as never} onUpdated={onUpdated} />,
    );

    expect(screen.getByText("Belum ada alamat pertemuan.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atur" }));
    fireEvent.change(screen.getByPlaceholderText("Jl. Contoh No. 1, Jakarta"), {
      target: { value: "Jl. Contoh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(setMeeting).toHaveBeenCalledWith("b1", { meetingAddress: "Jl. Contoh" }),
    );
  });

  it("rejects an empty address before ever calling the API", async () => {
    render(
      <MeetingInfoSection booking={makeBooking({ mode: "OFFLINE" }) as never} onUpdated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Atur" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Alamat pertemuan tidak boleh kosong.")).toBeInTheDocument();
    expect(setMeeting).not.toHaveBeenCalled();
  });
});
