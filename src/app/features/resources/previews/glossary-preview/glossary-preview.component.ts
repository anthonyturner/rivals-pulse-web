import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map } from 'rxjs';

import { LOCAL_DATE } from '../../../home/word-of-day/word-of-day.component';
import { selectWordOfDay } from '../../../home/word-of-day/word-of-day-term';
import { GlossaryDataService } from '../../../reference/glossary/glossary-data.service';
import type { GlossaryTerm } from '../../../reference/glossary/glossary.model';
import { previewData } from '../preview-data';

/** Today's glossary word and its definition: the same word the home page features. Draws nothing until the glossary has loaded. */
@Component({
  selector: 'app-glossary-preview',
  templateUrl: './glossary-preview.component.html',
  styleUrl: './glossary-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryPreviewComponent {
  private readonly localDate = inject(LOCAL_DATE);
  private readonly glossary = inject(GlossaryDataService);

  protected readonly term = previewData<GlossaryTerm>(() =>
    this.glossary.getTerms().pipe(map((terms) => selectWordOfDay(terms, this.localDate()))),
  );
}
