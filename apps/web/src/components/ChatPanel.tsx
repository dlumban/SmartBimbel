"use client";

import { useEffect, useState } from "react";
import { StreamChat, Channel as StreamChannel } from "stream-chat";
import { Chat, Channel, Window, MessageList, MessageComposerUI, Thread } from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import { ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import { ChatUnavailableError, getChatToken } from "../lib/chat";

type PanelState = "loading" | "unavailable" | "error" | "ready";

/**
 * Renders the real-time thread via Stream's prebuilt UI components (Task
 * 4.2, per the sprints README's architectural decision) - the whole
 * point of using a managed provider is to wire these, not rebuild a
 * message list/composer ourselves. STREAM_API_KEY/SECRET aren't
 * provisioned in this environment (see StreamChatService), so this
 * always resolves to the "unavailable" state here - the code path itself
 * is real and ready for when credentials land, not a stub.
 */
export function ChatPanel({ bookingId }: { bookingId: string }) {
  const { sessionUser } = useAuth();
  const [state, setState] = useState<PanelState>("loading");
  const [client, setClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;
    let streamClient: StreamChat | null = null;

    async function init() {
      try {
        const { token, apiKey, channelId } = await getChatToken(bookingId);
        if (!apiKey || !channelId) {
          if (!cancelled) setState("unavailable");
          return;
        }

        streamClient = new StreamChat(apiKey);
        await streamClient.connectUser(
          { id: sessionUser!.id, name: sessionUser!.name ?? undefined },
          token,
        );
        if (cancelled) {
          await streamClient.disconnectUser();
          return;
        }

        const activeChannel = streamClient.channel("messaging", channelId.split(":")[1]);
        await activeChannel.watch();
        if (cancelled) {
          await streamClient.disconnectUser();
          return;
        }

        setClient(streamClient);
        setChannel(activeChannel);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        setState(e instanceof ChatUnavailableError ? "unavailable" : "error");
      }
    }

    init();
    return () => {
      cancelled = true;
      streamClient?.disconnectUser();
    };
  }, [bookingId, sessionUser]);

  if (state === "loading") return <LoadingSpinner label="Memuat obrolan..." />;

  if (state === "unavailable") {
    return null;
  }

  if (state === "error" || !client || !channel) {
    return <ErrorState description="Gagal memuat obrolan." />;
  }

  return (
    <div className="h-[500px] overflow-hidden rounded-lg border border-border">
      <Chat client={client}>
        <Channel channel={channel}>
          <Window>
            <MessageList />
            <MessageComposerUI />
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
}
