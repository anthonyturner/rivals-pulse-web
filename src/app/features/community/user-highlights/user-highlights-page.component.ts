import { Component } from '@angular/core';

interface HighlightTimelineEntry {
  time: string;
  title: string;
  note: string;
}

@Component({
  selector: 'app-user-highlights-page',
  templateUrl: './user-highlights-page.component.html',
  styleUrl: './user-highlights-page.component.css',
})
export class UserHighlightsPageComponent {
  readonly example = {
    player: 'SilentCoder',
    hero: 'Human Torch',
    title: 'Elevated entry into a four-elimination objective fight',
    duration: 'About 34 seconds',
    videoUrl:
      'https://x20replay01-ovs.fp.ps.easebar.com/file/6a54bab6b534930331a4c871H11Kzfyv03',
    posterUrl:
      'https://x20replay01-ovs.fp.ps.easebar.com/file/6a54bab6b534930331a4c871H11Kzfyv03?fop=vframe/offset/t30000',
    shareUrl:
      'https://x20replay01-ovs.fp.ps.easebar.com/file/6a54bab6b534930331a4c871H11Kzfyv03/share.html',
  };

  readonly timeline: HighlightTimelineEntry[] = [
    {
      time: '0:05',
      title: 'Arrive from height',
      note: 'Human Torch approaches above the main lane, preserving vision and a second entry angle.',
    },
    {
      time: '0:10',
      title: 'Pressure the choke',
      note: 'The play moves toward a grouped fight without settling into a stationary front-door duel.',
    },
    {
      time: '0:15',
      title: 'Keep the fight vertical',
      note: 'A quick height change keeps pressure on a target while making return fire harder to track.',
    },
    {
      time: '0:25',
      title: 'Commit on the objective',
      note: 'The decisive dive lands where enemies are stacked, converting area pressure into eliminations.',
    },
    {
      time: '0:30',
      title: 'Finish the sequence',
      note: 'Sustained movement and allied healing help extend the play through the four-elimination finish.',
    },
  ];
}
