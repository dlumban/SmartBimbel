"use client";

import { Card, CardContent } from "./Card";
import { Badge } from "./Badge";
import { RatingStars } from "./RatingStars";

/**
 * Deliberately self-contained props rather than importing a Tutor DTO -
 * the discovery API contract doesn't exist yet (Sprint 2). Sprint 2 maps
 * its real response onto this shape rather than this component reaching
 * into API types.
 */
export interface TutorCardProps {
  photoUrl?: string | null;
  name: string;
  subjects: string[];
  hourlyRateLabel: string;
  rating: number | null;
  reviewCount?: number;
  city?: string | null;
  modes: readonly ("online" | "offline")[];
  onClick?: () => void;
}

export function TutorCard({
  photoUrl,
  name,
  subjects,
  hourlyRateLabel,
  rating,
  reviewCount,
  city,
  modes,
  onClick,
}: TutorCardProps) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      className={onClick ? "cursor-pointer hover:shadow-md" : undefined}
    >
      <CardContent className="flex gap-3 pt-6">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-foreground">{name}</p>
            {modes.map((mode) => (
              <Badge key={mode} variant={mode === "online" ? "online" : "neutral"}>
                {mode === "online" ? "Online" : "Tatap muka"}
              </Badge>
            ))}
          </div>
          <p className="truncate text-sm text-muted-foreground">{subjects.join(", ")}</p>
          <div className="mt-1 flex items-center justify-between">
            <RatingStars rating={rating} count={reviewCount} size="sm" />
            <span className="text-sm font-medium text-foreground">
              {hourlyRateLabel}
              <span className="text-muted-foreground">/jam</span>
            </span>
          </div>
          {city && <p className="mt-1 text-xs text-muted-foreground">{city}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
