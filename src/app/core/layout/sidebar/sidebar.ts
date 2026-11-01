import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AdSlotComponent } from '../../../shared/components/ad-slot/ad-slot.component';

/** The column of ad slots beside (wide screens) or below (narrow screens) a page's content. */
@Component({
  selector: 'app-sidebar',
  imports: [AdSlotComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {}
