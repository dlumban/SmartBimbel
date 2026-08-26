import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TutorSearch } from "./TutorSearch";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const getSubjects = vi.fn();
const getGradeLevels = vi.fn();
vi.mock("../lib/masterData", () => ({
  getSubjects: () => getSubjects(),
  getGradeLevels: () => getGradeLevels(),
}));

const searchTutors = vi.fn();
vi.mock("../lib/discovery", () => ({
  searchTutors: (...args: unknown[]) => searchTutors(...args),
}));

function makeTutor(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    name: "Budi Santoso",
    photoUrl: null,
    bio: "hi",
    subjects: ["Matematika"],
    gradeLevels: ["SMA 10-12"],
    hourlyRate: 150000,
    rating: null,
    reviewCount: 0,
    city: "Jakarta Selatan",
    teachingModes: ["ONLINE"],
    ...overrides,
  };
}

describe("TutorSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSubjects.mockResolvedValue([{ id: "s1", name: "Matematika" }]);
    getGradeLevels.mockResolvedValue([{ id: "g1", name: "SMA 10-12" }]);
  });

  it("renders tutor cards from the search result", async () => {
    searchTutors.mockResolvedValue({ data: [makeTutor()], page: 1, limit: 12, total: 1 });
    render(<TutorSearch />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
  });

  it("shows an empty state when no tutors match", async () => {
    searchTutors.mockResolvedValue({ data: [], page: 1, limit: 12, total: 0 });
    render(<TutorSearch />);

    expect(await screen.findByText("Tidak ada tutor yang cocok")).toBeInTheDocument();
  });

  it("re-fetches with the new filter when a subject is selected", async () => {
    searchTutors.mockResolvedValue({ data: [makeTutor()], page: 1, limit: 12, total: 1 });
    render(<TutorSearch />);
    await screen.findByText("Budi Santoso");

    fireEvent.change(screen.getByLabelText("Mata pelajaran"), { target: { value: "s1" } });

    await waitFor(() =>
      expect(searchTutors).toHaveBeenLastCalledWith(
        expect.objectContaining({ subjectId: "s1", page: 1 }),
      ),
    );
  });

  it("navigates to the tutor detail page when a card is clicked", async () => {
    searchTutors.mockResolvedValue({ data: [makeTutor()], page: 1, limit: 12, total: 1 });
    render(<TutorSearch />);

    fireEvent.click(await screen.findByText("Budi Santoso"));

    expect(push).toHaveBeenCalledWith("/tutors/t1");
  });

  it("disables the previous button on the first page and next button on the last", async () => {
    searchTutors.mockResolvedValue({ data: [makeTutor()], page: 1, limit: 12, total: 1 });
    render(<TutorSearch />);
    await screen.findByText("Budi Santoso");

    expect(screen.getByRole("button", { name: "Sebelumnya" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Berikutnya" })).toBeDisabled();
  });
});
