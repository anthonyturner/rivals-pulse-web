import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { contentState, reportContentState } from '../../../core/seo/thin-content';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { APP_PRIVACY_POLICY } from './app-privacy-policy';

/**
 * The desktop app's privacy policy, rendered from the checked-in copy of the overlay repository's
 * `docs/privacy-policy.md` (see `scripts/sync-app-privacy-policy.ts`). The policy's words are the
 * overlay team's and are shown as they are; only the notice above them is this site's, and it says
 * the app is not released yet.
 */
@Component({
  selector: 'app-app-privacy-policy-page',
  imports: [NgTemplateOutlet, NoticeComponent, PageHeaderComponent, RouterLink],
  templateUrl: './app-privacy-policy-page.component.html',
  styleUrls: ['../../../shared/styles/reading.css', './app-privacy-policy-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPrivacyPolicyPageComponent {
  readonly policy = APP_PRIVACY_POLICY;

  constructor() {
    reportContentState(() => contentState(false, this.policy.sections.length > 0));
  }
}
