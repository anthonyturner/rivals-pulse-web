import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PreviewPortraitComponent } from '../../../hub/preview-portrait/preview-portrait.component';
import { strategistPreview } from '../preview-views';

/** The topics the strategist guides cover and the heroes they teach. It reads the guides themselves, so it shows on the server too. */
@Component({
  selector: 'app-strategist-guides-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './strategist-guides-preview.component.html',
  styleUrl: './strategist-guides-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategistGuidesPreviewComponent {
  protected readonly preview = strategistPreview();
}
