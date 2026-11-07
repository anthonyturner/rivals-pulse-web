import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HeroTileComponent } from '../../insights/hero-tile/hero-tile.component';

interface HighlightTimelineEntry {
  time: string;
  title: string;
  note: string;
}

@Component({
  selector: 'app-user-highlights-page',
  imports: [HeroTileComponent, PageHeaderComponent],
  templateUrl: './user-highlights-page.component.html',
  styleUrls: ['../../../shared/styles/guide-article.css', './user-highlights-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserHighlightsPageComponent {
  readonly example = {
    player: 'SilentCoder',
    hero: 'Human Torch',
    heroImage: '/images/heroes/human-torch.png',
    title: 'Elevated entry into a four-elimination objective fight',
    duration: 'About 34 seconds',
    videoUrl:
      'https://x20replay01-ovs.fp.ps.easebar.com/file/6a54bab6b534930331a4c871H11Kzfyv03',
    posterUrl:
      'https://x20replay01-ovs.fp.ps.easebar.com/file/6a54bab6b534930331a4c871H11Kzfyv03?fop=vframe/offset/t30000',
    shareUrl:
      'https://x20replay01-ovs.fp.ps.easebar.com/file/6a54bab6b534930331a4c871H11Kzfyv03/share.html',
  };

  readonly topics = 'Human Torch, Off-angle, Vertical mobility, Objective pressure';

  readonly takeaways = [
    {
      title: 'What worked: change the angle before forcing the finish.',
      body: 'The clip avoids one long, predictable sightline. Height and lateral movement make Human Torch difficult to follow while keeping pressure on the same fight.',
    },
    {
      title: 'Review next: plan the exit before the objective dive.',
      body: 'The final commit succeeds with allied sustain. On review, check which movement tool remains available if healing is delayed or the first elimination does not land.',
    },
  ];

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
