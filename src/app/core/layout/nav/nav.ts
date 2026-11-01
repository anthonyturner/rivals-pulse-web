import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  private readonly auth = inject(AuthService);

  readonly isMenuOpen = signal(false);

  /** Hidden until the server has answered, so a signed-in visitor never sees "Sign in" flash by. */
  readonly accountLink = computed(() => {
    switch (this.auth.state().status) {
      case 'signedIn':
        return { label: 'Account', path: '/account' };
      case 'signedOut':
      case 'unavailable':
        return { label: 'Sign in', path: '/sign-in' };
      default:
        return null;
    }
  });

  readonly primaryNavItems = [
    { label: 'Home', path: '/', enabled: true },
    { label: 'Heroes', path: '/heroes', enabled: true },
    { label: 'Guides', path: '/hero-guides', enabled: true },
    { label: 'Tools', path: '/tools', enabled: true },
    { label: 'Resources', path: '/resources', enabled: true },
    { label: 'Community', path: '/community', enabled: true },
  ];

  constructor() {
    void this.auth.load();
  }

  toggleMenu(): void {
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
