"use client";

/**
 * On-platform reminder PRD §6.1.D ("keep communication on-platform"
 * trust goal, §12's payment-friction risk). Report/block actions were
 * removed from this surface.
 */
export function ChatModerationBar() {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">
        Demi keamanan Anda, selalu lakukan pembayaran dan komunikasi utama melalui SmartBimbel.
        Jangan bagikan informasi pembayaran pribadi di luar platform.
      </p>
    </div>
  );
}
