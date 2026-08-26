import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SessionNotesSection } from "./SessionNotesSection";

vi.mock("./RichTextEditor", () => ({
  RichTextEditor: ({
    id,
    value,
    onChange,
    placeholder,
  }: {
    id: string;
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      id={id}
      aria-label="Catatan sesi"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const addSessionNotes = vi.fn();
const listSessionAttachments = vi.fn();
const uploadSessionDocument = vi.fn();
const deleteSessionAttachment = vi.fn();
const fetchAttachmentBlob = vi.fn();
vi.mock("../lib/bookings", async () => {
  const actual = await vi.importActual<typeof import("../lib/bookings")>("../lib/bookings");
  return {
    ...actual,
    addSessionNotes: (...args: unknown[]) => addSessionNotes(...args),
    listSessionAttachments: (...args: unknown[]) => listSessionAttachments(...args),
    uploadSessionDocument: (...args: unknown[]) => uploadSessionDocument(...args),
    deleteSessionAttachment: (...args: unknown[]) => deleteSessionAttachment(...args),
    fetchAttachmentBlob: (...args: unknown[]) => fetchAttachmentBlob(...args),
  };
});

function makeBooking(overrides: Record<string, unknown> = {}) {
  return { id: "b1", sessionNotes: null, ...overrides };
}

describe("SessionNotesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSessionAttachments.mockResolvedValue([]);
  });

  it("shows an empty state for a student with no edit button", () => {
    render(
      <SessionNotesSection booking={makeBooking() as never} isTutor={false} onUpdated={vi.fn()} />,
    );
    expect(screen.getByText("Belum ada catatan.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah Catatan" })).not.toBeInTheDocument();
  });

  it("lets the tutor add notes", async () => {
    const onUpdated = vi.fn();
    addSessionNotes.mockResolvedValue({ id: "b1", sessionNotes: "Membahas aljabar" });
    render(
      <SessionNotesSection booking={makeBooking() as never} isTutor={true} onUpdated={onUpdated} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tambah Catatan" }));
    fireEvent.change(screen.getByLabelText("Catatan sesi"), {
      target: { value: "Membahas aljabar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(addSessionNotes).toHaveBeenCalledWith("b1", "Membahas aljabar"));
    expect(onUpdated).toHaveBeenCalledWith({ id: "b1", sessionNotes: "Membahas aljabar" });
  });

  it("shows existing notes read-only to a student", () => {
    render(
      <SessionNotesSection
        booking={makeBooking({ sessionNotes: "Sudah dibahas minggu lalu" }) as never}
        isTutor={false}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByText("Sudah dibahas minggu lalu")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets the tutor edit existing notes", () => {
    render(
      <SessionNotesSection
        booking={makeBooking({ sessionNotes: "Catatan lama" }) as never}
        isTutor={true}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Ubah Catatan" })).toBeInTheDocument();
  });

  it("shows an error message when saving fails", async () => {
    addSessionNotes.mockRejectedValue(
      new Error("Session notes can only be added after the session has ended."),
    );
    render(
      <SessionNotesSection booking={makeBooking() as never} isTutor={true} onUpdated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tambah Catatan" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(
      await screen.findByText("Session notes can only be added after the session has ended."),
    ).toBeInTheDocument();
  });

  it("shows a tutor-only upload button and lets the tutor upload a document", async () => {
    listSessionAttachments.mockResolvedValue([]);
    uploadSessionDocument.mockResolvedValue({
      id: "att1",
      filename: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      createdAt: new Date().toISOString(),
    });
    render(
      <SessionNotesSection booking={makeBooking() as never} isTutor={true} onUpdated={vi.fn()} />,
    );

    expect(await screen.findByText("Belum ada lampiran.")).toBeInTheDocument();
    const uploadButton = screen.getByRole("button", { name: "Unggah Dokumen" });
    const file = new File(["data"], "report.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"][accept*="pdf"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/report\.pdf/)).toBeInTheDocument();
    expect(uploadSessionDocument).toHaveBeenCalledWith("b1", file);
    expect(uploadButton).toBeInTheDocument();
  });

  it("lists attachments for a student without upload/delete controls", async () => {
    listSessionAttachments.mockResolvedValue([
      {
        id: "att1",
        filename: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        createdAt: new Date().toISOString(),
      },
    ]);
    render(
      <SessionNotesSection booking={makeBooking() as never} isTutor={false} onUpdated={vi.fn()} />,
    );

    expect(await screen.findByText(/report\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unduh" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unggah Dokumen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hapus" })).not.toBeInTheDocument();
  });

  it("lets the tutor delete an attachment", async () => {
    listSessionAttachments.mockResolvedValue([
      {
        id: "att1",
        filename: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        createdAt: new Date().toISOString(),
      },
    ]);
    deleteSessionAttachment.mockResolvedValue(undefined);
    render(
      <SessionNotesSection booking={makeBooking() as never} isTutor={true} onUpdated={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Hapus" }));

    await waitFor(() => expect(deleteSessionAttachment).toHaveBeenCalledWith("b1", "att1"));
    await waitFor(() => expect(screen.queryByText(/report\.pdf/)).not.toBeInTheDocument());
  });
});
