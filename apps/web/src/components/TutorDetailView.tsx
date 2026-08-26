"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, LoadingSpinner, RatingStars } from "@smartbimbel/ui";
import { formatIDR } from "@smartbimbel/shared";
import { getTutorDetail, getTutorReviews, TutorDetail, TutorReview } from "../lib/discovery";

export function TutorDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [tutor, setTutor] = useState<TutorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState<TutorReview[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);

  useEffect(() => {
    getTutorDetail(id)
      .then(setTutor)
      .catch((e) => {
        if (e instanceof Error && e.message === "NOT_FOUND") setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    getTutorReviews(id)
      .then((res) => {
        setReviews(res.data);
        setReviewsTotal(res.total);
      })
      .catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (notFound || !tutor) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-bold">Tutor tidak ditemukan</h1>
        <p className="mt-2 text-muted-foreground">
          Profil ini tidak ada atau belum terverifikasi.
        </p>
        <Button className="mt-4" onClick={() => router.push("/tutors")}>
          Kembali ke pencarian
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
          {tutor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tutor.photoUrl} alt={tutor.name ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {(tutor.name ?? "T").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{tutor.name ?? "Tutor SmartBimbel"}</h1>
          <RatingStars rating={tutor.rating} count={tutor.reviewCount} />
          <div className="mt-1 flex flex-wrap gap-1">
            {tutor.teachingModes.map((m) => (
              <Badge key={m} variant={m === "ONLINE" ? "online" : "neutral"}>
                {m === "ONLINE" ? "Online" : "Tatap muka"}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <p className="text-foreground">{tutor.bio}</p>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 text-sm sm:grid-cols-2">
          <dl className="contents">
            <div>
              <dt className="text-muted-foreground">Pendidikan</dt>
              <dd className="font-medium">{tutor.education ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kota</dt>
              <dd className="font-medium">{tutor.city ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tarif</dt>
              <dd className="font-medium">
                {tutor.hourlyRate ? `${formatIDR(tutor.hourlyRate)}/jam` : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mata pelajaran</dt>
              <dd className="font-medium">{tutor.subjects.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Jenjang</dt>
              <dd className="font-medium">{tutor.gradeLevels.join(", ")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ulasan ({reviewsTotal})</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada ulasan.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {review.studentName ?? "Siswa"}
                    </span>
                    <span className="text-warning-500" aria-label={`Rating ${review.rating} dari 5`}>
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </span>
                  </div>
                  {review.text && <p className="mt-1 text-sm text-foreground">{review.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Routes into the booking flow once Sprint 3 ships it - the entry
          point exists now so that sprint only implements the destination. */}
      <Button
        className="w-full"
        onClick={() => router.push(`/bookings/new?tutorId=${tutor.id}`)}
      >
        Pesan Sekarang
      </Button>
    </div>
  );
}
