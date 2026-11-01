import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
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
}
