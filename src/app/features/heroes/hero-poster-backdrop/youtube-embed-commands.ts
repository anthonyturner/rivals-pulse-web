import { Injectable } from '@angular/core';

/** The privacy-enhanced YouTube host: embeds must load from here for their player commands to reach them. */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

export type YoutubeEmbedCommand = 'mute' | 'unMute';

/** Sends player commands to a YouTube embed loaded with `enablejsapi=1`, without loading YouTube's iframe API script. */
@Injectable({ providedIn: 'root' })
export class YoutubeEmbedCommands {
  send(frame: HTMLIFrameElement | undefined, command: YoutubeEmbedCommand): void {
    frame?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: command, args: [] }),
      YOUTUBE_EMBED_ORIGIN,
    );
  }
}
