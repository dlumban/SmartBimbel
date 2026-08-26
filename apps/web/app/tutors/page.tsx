import { TutorSearch } from "../../src/components/TutorSearch";

export default function TutorsPage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-neutral-200 bg-white px-6 py-6 text-center">
        <h1 className="text-2xl font-bold">Temukan tutor privat terbaik</h1>
      </div>
      <TutorSearch />
    </main>
  );
}
