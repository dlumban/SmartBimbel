"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DailyIframe from "@daily-co/daily-js";
import { Tldraw, Editor } from "tldraw";
import "tldraw/tldraw.css";
import { Button, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { getSessionToken, getWhiteboard, saveWhiteboard } from "../../../../src/lib/sessionRoom";

export default function SessionRoomPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const callRef = useRef<ReturnType<typeof DailyIframe.createFrame> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSnapshot = useRef<unknown>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getSessionToken(bookingId);
        if (cancelled) return;
        setCanEdit(session.canEditWhiteboard);
        setRoomUrl(session.roomUrl);

        const board = await getWhiteboard(bookingId);
        if (cancelled) return;
        initialSnapshot.current = board.snapshot;
        setReady(true);

        requestAnimationFrame(() => {
          if (!containerRef.current || cancelled) return;
          const call = DailyIframe.createFrame(containerRef.current, {
            showLeaveButton: true,
            iframeStyle: {
              width: "100%",
              height: "100%",
              border: "0",
              borderRadius: "8px",
            },
          });
          callRef.current = call;
          void call.join({ url: session.roomUrl, token: session.token });
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal membuka ruang sesi.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void callRef.current?.destroy();
      callRef.current = null;
    };
  }, [bookingId]);

  const scheduleSave = useCallback(
    (editor: Editor) => {
      if (!canEdit) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const snapshot = editor.getSnapshot();
        void saveWhiteboard(bookingId, snapshot).catch(() => {
          /* best-effort */
        });
      }, 1500);
    },
    [bookingId, canEdit],
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-10">
        <ErrorState description={error} />
        <Link href={`/bookings/${bookingId}`} className="text-primary hover:underline">
          Kembali ke detail sesi
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Ruang Sesi</h1>
        <div className="flex gap-2">
          {roomUrl && (
            <a
              href={roomUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Buka di tab baru
            </a>
          )}
          <Link href={`/bookings/${bookingId}`}>
            <Button size="sm" variant="secondary">
              Tutup
            </Button>
          </Link>
        </div>
      </div>
      <div className="grid min-h-[70vh] flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <div
          ref={containerRef}
          className="min-h-[320px] overflow-hidden rounded-lg border border-border bg-black"
        />
        <div className="min-h-[320px] overflow-hidden rounded-lg border border-border">
          {ready && (
            <Tldraw
              onMount={(editor) => {
                if (initialSnapshot.current) {
                  try {
                    editor.loadSnapshot(initialSnapshot.current as never);
                  } catch {
                    /* ignore bad snapshot */
                  }
                }
                if (!canEdit) {
                  editor.updateInstanceState({ isReadonly: true });
                }
                editor.store.listen(() => scheduleSave(editor), {
                  source: "user",
                  scope: "document",
                });
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
