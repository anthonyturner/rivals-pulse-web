import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { HeroDetailsComponent } from '../hero-details/hero-details.component';
import { Hero } from '../hero.model';
import { HeroRoleSwitcherComponent } from '../hero-role-switcher/hero-role-switcher.component';

interface HeroVideoSearch {
  label: string;
  query: string;
  url: string;
  embedUrl?: SafeResourceUrl;
}

@Component({
  selector: 'app-hero-content',
  imports: [HeroDetailsComponent, HeroRoleSwitcherComponent, RouterLink],
  templateUrl: './hero-content.component.html',
  styleUrl: './hero-content.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroContentComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly hero = input<Hero>();
  readonly videos = input.required<HeroVideoSearch[]>();
  readonly youtubeUrl = input.required<string>();
  readonly controller = input.required<any>();

  /** The selected hero as a one-item list: tracking by id gives each hero fresh details with the long sections collapsed. */
  readonly detailHeroes = computed(() => {
    const hero = this.hero();

    return hero ? [hero] : [];
  });

  readonly hasRoleKits = computed(() => {
    const hero = this.hero();

    return !!hero && this.controller().roleAbilityKits(hero).length > 0;
  });

  /** Brings the panel into view and moves keyboard focus to the hero name. */
  focusHeading(): void {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.host.nativeElement
      .querySelector('.hero-detail')
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    this.host.nativeElement.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }
}
