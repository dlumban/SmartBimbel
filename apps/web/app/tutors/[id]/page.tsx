import { TutorDetailView } from "../../../src/components/TutorDetailView";

// Next.js 14 passes route params synchronously (not a Promise, unlike 15+).
export default function TutorDetailPage({ params }: { params: { id: string } }) {
  return <TutorDetailView id={params.id} />;
}
