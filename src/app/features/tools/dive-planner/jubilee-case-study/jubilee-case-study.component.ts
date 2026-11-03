import { ChangeDetectionStrategy, Component } from '@angular/core';

/** One player's Jubilee draft, worked through as an example of a dive response. It reads no data. */
@Component({
  selector: 'app-jubilee-case-study',
  templateUrl: './jubilee-case-study.component.html',
  styleUrl: './jubilee-case-study.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JubileeCaseStudyComponent {}
