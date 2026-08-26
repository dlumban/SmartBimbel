import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

const getAnalyticsSummary = vi.fn();
const getCityBreakdown = vi.fn();
vi.mock("../lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("../lib/analytics")>("../lib/analytics");
  return {
    ...actual,
    getAnalyticsSummary: (...args: unknown[]) => getAnalyticsSummary(...args),
    getCityBreakdown: (...args: unknown[]) => getCityBreakdown(...args),
  };
});

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    registeredTutors: 10,
    registeredStudents: 25,
    completedBookings: 8,
    bookingConversionRate: 0.6,
    gmv: 5000000,
    platformTake: 750000,
    averageSessionRating: 4.7,
    ratingCount: 8,
    tutorActivationRate: 0.4,
    studentSecondBookingRate: 0.25,
    ...overrides,
  };
}

describe("AnalyticsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnalyticsSummary.mockResolvedValue(makeSummary());
    getCityBreakdown.mockResolvedValue([
      { city: "Jakarta", bookingCount: 5, gmv: 3000000, platformTake: 450000 },
    ]);
  });

  it("renders every PRD §3 metric", async () => {
    render(<AnalyticsDashboard />);

    expect(await screen.findByText("10")).toBeInTheDocument(); // registeredTutors
    expect(screen.getByText("25")).toBeInTheDocument(); // registeredStudents
    expect(screen.getByText("8")).toBeInTheDocument(); // completedBookings
    expect(screen.getByText("60.0%")).toBeInTheDocument(); // conversion
    expect(screen.getByText("Rp5.000.000")).toBeInTheDocument(); // GMV
    expect(screen.getByText("Rp750.000")).toBeInTheDocument(); // take
    expect(screen.getByText("4.7")).toBeInTheDocument(); // rating
    expect(screen.getByText("40.0%")).toBeInTheDocument(); // activation
    expect(screen.getByText("25.0%")).toBeInTheDocument(); // second booking
  });

  it("shows the city breakdown table", async () => {
    render(<AnalyticsDashboard />);
    expect(await screen.findByText("Jakarta")).toBeInTheDocument();
  });

  it("recomputes widgets when a preset date range is applied", async () => {
    render(<AnalyticsDashboard />);
    await screen.findByText("Jakarta");
    getAnalyticsSummary.mockClear();

    fireEvent.click(screen.getByText("30 hari"));

    await waitFor(() =>
      expect(getAnalyticsSummary).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(String) }),
      ),
    );
  });

  it("shows a - placeholder when there are no ratings yet", async () => {
    getAnalyticsSummary.mockResolvedValue(makeSummary({ averageSessionRating: null, ratingCount: 0 }));
    render(<AnalyticsDashboard />);
    expect(await screen.findByText("-")).toBeInTheDocument();
  });
});
