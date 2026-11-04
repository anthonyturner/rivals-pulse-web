import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AdSlotComponent } from '../../../shared/components/ad-slot/ad-slot.component';
import { SidebarContent } from './sidebar-content';

/** The column beside (wide screens) or below (narrow screens) a page's content: what the page supplies, then the ad slots. */
@Component({
  selector: 'app-sidebar',
  imports: [AdSlotComponent, NgTemplateOutlet],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.sidebar--with-page-content]': 'pageContent() !== null' },
})
export class Sidebar {
  protected readonly pageContent = inject(SidebarContent).template;
}
