import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  readonly isMenuOpen = signal(false);

  readonly primaryNavItems = [
    { label: 'Home', path: '/', enabled: true },
    { label: 'Heroes', path: '/heroes', enabled: true },
    { label: 'Guides', path: '/hero-guides', enabled: true },
    { label: 'Tools', path: '/tools', enabled: true },
    { label: 'Resources', path: '/resources', enabled: true },
  ];

  toggleMenu(): void {
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
