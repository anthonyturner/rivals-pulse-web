import { Component, destroyPlatform, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { renderApplication } from '@angular/platform-server';
import { provideRouter } from '@angular/router';

import type { HeroStats } from '../../../../../contracts/hero-stats.model';
import { HeroUsageSectionComponent } from './hero-usage-section.component';
import { buildHeroUsageView } from './hero-usage-view';

const emptyDataset: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};

@Component({
  selector: 'app-root',
  imports: [HeroUsageSectionComponent],
  template: `<app-hero-usage-section eyebrow="Season 10 meta" title="Most-used heroes" [view]="view" />`,
})
class SsrHostComponent {
  readonly view = buildHeroUsageView(emptyDataset, new Map());
}

describe('HeroUsageSectionComponent server render', () => {
  // Two things leak out of a server render, so both are put back for the specs that run after it.
  // Angular allows one platform at a time and the test runner holds the browser one; and the server
  // platform overwrites the browser's globals (Event, Node, Element...) with its own DOM classes.
  let globalsBefore: Map<PropertyKey, PropertyDescriptor>;

  beforeEach(() => {
    globalsBefore = new Map(
      Reflect.ownKeys(globalThis).flatMap((key): [PropertyKey, PropertyDescriptor][] => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);

        return descriptor === undefined ? [] : [[key, descriptor]];
      }),
    );
    getTestBed().resetTestEnvironment();
    destroyPlatform();
  });

  afterEach(() => {
    destroyPlatform();
    restoreGlobals(globalsBefore);
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
      errorOnUnknownElements: true,
      errorOnUnknownProperties: true,
    });
  });

  it('renders the compact empty notice and the source label, with no cards, zeros or NaN, from an empty dataset', async () => {
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          SsrHostComponent,
          { providers: [provideZonelessChangeDetection(), provideRouter([])] },
          context,
        ),
      { document: '<html><body><app-root></app-root></body></html>' },
    );

    expect(html).toContain('Based on Rivals Pulse players');
    expect(html).toContain('Not enough data yet');
    expect(html).toContain('class="usage-empty"');
    expect(html).not.toMatch(/NaN|Infinity|class="usage-card|<dl/);
  });
});

function restoreGlobals(before: ReadonlyMap<PropertyKey, PropertyDescriptor>): void {
  for (const key of Reflect.ownKeys(globalThis)) {
    const original = before.get(key);

    if (original === undefined) {
      Reflect.deleteProperty(globalThis, key);
    } else if (!sameDescriptor(Object.getOwnPropertyDescriptor(globalThis, key), original)) {
      Object.defineProperty(globalThis, key, original);
    }
  }
}

function sameDescriptor(a: PropertyDescriptor | undefined, b: PropertyDescriptor): boolean {
  return a !== undefined && a.value === b.value && a.get === b.get && a.set === b.set && a.writable === b.writable;
}
