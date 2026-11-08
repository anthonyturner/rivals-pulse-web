import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ReturnTrail } from '../../../core/navigation/return-trail';
import { HeroDetailsComponent } from '../hero-details/hero-details.component';
import type { HeroesPageComponent } from '../heroes-page.component';
import { Hero } from '../hero.model';
import { HeroRoleSwitcherComponent } from '../hero-role-switcher/hero-role-switcher.component';

@Component({
  selector: 'app-hero-content',
  imports: [HeroDetailsComponent, HeroRoleSwitcherComponent, RouterLink],
  templateUrl: './hero-content.component.html',
  styleUrl: './hero-content.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroContentComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly returnTrail = inject(ReturnTrail);

  readonly hero = input<Hero>();
  readonly controller = input.required<HeroesPageComponent>();

  /** The page the reader opened this hero from, such as Your stats; null when they started on the Heroes page. */
  protected readonly origin = computed(() => this.returnTrail.originOutside('/heroes'));

  /** The selected hero as a one-item list: tracking by id gives each hero fresh details with the long sections collapsed. */
  readonly detailHeroes = computed(() => {
    const hero = this.hero();

    return hero ? [hero] : [];
  });

  readonly hasRoleKits = computed(() => {
    const hero = this.hero();

    return !!hero && this.controller().roleAbilityKits(hero).length > 0;
  });

  /**
   * Moves keyboard focus to the hero name, and brings the panel to the top of the page only when the name is
   * not already fully on screen, so choosing a hero from a roster that is in view does not move the page.
   */
  focusHeading(): void {
    const heading = this.host.nativeElement.querySelector<HTMLElement>('h2');

    if (heading && !this.isOnScreen(heading)) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.host.nativeElement
        .querySelector('.hero-detail')
        ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    heading?.focus({ preventScroll: true });
  }

  /** On screen means below the fixed header, which the page reserves as its scroll padding, and above the window's bottom. */
  private isOnScreen(element: HTMLElement): boolean {
    const headerHeight = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const box = element.getBoundingClientRect();

    return box.top >= headerHeight && box.bottom <= window.innerHeight;
  }
}
