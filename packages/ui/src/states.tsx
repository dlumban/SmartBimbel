"use client";

import { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="text-lg font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description = "Silakan coba lagi.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-6 py-12 text-center">
      <p className="text-lg font-medium text-destructive">{title}</p>
      <p className="max-w-sm text-destructive">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-md bg-destructive px-4 text-destructive-foreground hover:bg-destructive/90"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function LoadingSpinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12" role="status" aria-live="polite">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
        aria-hidden="true"
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
