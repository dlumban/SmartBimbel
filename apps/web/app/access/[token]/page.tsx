import { AccessLinkRedeemer } from "../../../src/components/AccessLinkRedeemer";

// Next.js 14 passes route params synchronously (not a Promise, unlike 15+).
export default function AccessLinkPage({ params }: { params: { token: string } }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <AccessLinkRedeemer token={params.token} />
    </main>
  );
}
