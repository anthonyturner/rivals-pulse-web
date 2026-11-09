import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** The privacy-enhanced YouTube host: embeds must load from here for their player commands to reach them. */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

export type YoutubeEmbedCommand = 'mute' | 'unMute';

/** Whether a message from the embed's window says its player is ready for commands. */
export function isPlayerReadyMessage(data: unknown): boolean {
  try {
    return typeof data === 'string' && (JSON.parse(data) as { event?: unknown } | null)?.event === 'onReady';
  } catch {
    return false;
  }
}

/** Sends player commands to a YouTube embed loaded with `enablejsapi=1`, without loading YouTube's iframe API script. */
@Injectable({ providedIn: 'root' })
export class YoutubeEmbedCommands {
  private readonly document = inject(DOCUMENT);

  send(frame: HTMLIFrameElement | undefined, command: YoutubeEmbedCommand): void {
    frame?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: command, args: [] }),
      YOUTUBE_EMBED_ORIGIN,
    );
  }

  /** Asks the embed to report back to this page. It answers `onReady` once it takes commands; one sent sooner is lost. */
  listen(frame: HTMLIFrameElement | undefined): void {
    frame?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      YOUTUBE_EMBED_ORIGIN,
    );
  }

  /**
   * Whether the browser will let a video start with sound: not before the visitor has pressed or typed
   * something on this page. When it cannot say, the answer is no, so a video is never left silently muted
   * while the page claims it plays.
   */
  canStartWithSound(): boolean {
    return this.document.defaultView?.navigator.userActivation?.hasBeenActive === true;
  }
}
