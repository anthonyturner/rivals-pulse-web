import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Footer } from './core/layout/footer/footer';
import { Nav } from './core/layout/nav/nav';
import { Sidebar } from './core/layout/sidebar/sidebar';
import { SidebarVisibility } from './core/layout/sidebar/sidebar-visibility';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, Nav, Footer, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly hasSidebar = inject(SidebarVisibility).visible;
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private lastPath: string | null = null;

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(({ urlAfterRedirects }) => {
        // A query or fragment change stays on the page, so focus stays where the visitor put it.
        const path = urlAfterRedirects.split(/[?#]/)[0];
        const movedPage = this.lastPath !== null && path !== this.lastPath;
        this.lastPath = path;

        if (movedPage) {
          this.focusMain();
        }
      });
  }

  /** The page has `<base href="/">`, so the anchor's own jump would navigate home. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.focusMain();
  }

  private focusMain(): void {
    this.main().nativeElement.focus({ preventScroll: true });
  }
}
