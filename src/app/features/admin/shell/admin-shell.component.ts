import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ADMIN_PAGE_LIST } from '../admin-pages';

/**
 * The frame of the admin area: a heading, a menu of the pages in `ADMIN_PAGE_LIST`, and the page
 * itself. Which pages exist is not decided here, so a new page never changes this component. Who
 * may open it is not decided here either: the route guard hides it, and the server and the database
 * refuse everything the pages ask for (ADR-0005).
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShellComponent {
  readonly pages = inject(ADMIN_PAGE_LIST);
}
