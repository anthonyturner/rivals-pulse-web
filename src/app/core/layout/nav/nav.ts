import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import type { LinkedPlayer } from '../../auth/linked-player.types';
import { PlayerAvatarComponent } from '../../../shared/components/player-avatar/player-avatar.component';

interface AccountLink {
  label: string;
  path: string;
  /** Set when the visible label is a player's name, so "Account" is still announced. */
  ariaLabel: string | null;
  player: LinkedPlayer | null;
}

@Component({
  selector: 'app-nav',
  imports: [PlayerAvatarComponent, RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  private readonly auth = inject(AuthService);

  readonly isMenuOpen = signal(false);

  /** Hidden until the server has answered, so a signed-in visitor never sees "Sign in" flash by. */
  readonly accountLink = computed<AccountLink | null>(() => {
    const state = this.auth.state();

    switch (state.status) {
      case 'signedIn':
        return state.player
          ? { label: state.player.name, path: '/account', ariaLabel: `Account, ${state.player.name}`, player: state.player }
          : { label: 'Account', path: '/account', ariaLabel: null, player: null };
      case 'signedOut':
      case 'unavailable':
        return { label: 'Sign in', path: '/sign-in', ariaLabel: null, player: null };
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
