export interface RatingStarsProps {
  /** Average rating 0-5. Pass `null`/`undefined` when there are no reviews yet. */
  rating: number | null | undefined;
  /** Total number of reviews behind the average, shown in parentheses. */
  count?: number;
  size?: "sm" | "md";
}

const STAR_SIZE: Record<NonNullable<RatingStarsProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
};

export function RatingStars({ rating, count, size = "md" }: RatingStarsProps) {
  if (rating == null) {
    return (
      <span className={`text-muted-foreground ${STAR_SIZE[size]}`}>
        Belum ada ulasan
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(5, rating));
  const fullStars = Math.round(clamped);

  return (
    <span
      className={`inline-flex items-center gap-1 ${STAR_SIZE[size]}`}
      aria-label={`Rating ${clamped.toFixed(1)} dari 5`}
    >
      <span className="text-warning-500" aria-hidden="true">
        {"★".repeat(fullStars)}
        {"☆".repeat(5 - fullStars)}
      </span>
      <span className="font-medium text-foreground">{clamped.toFixed(1)}</span>
      {typeof count === "number" && (
        <span className="text-muted-foreground">({count})</span>
      )}
    </span>
  );
}
