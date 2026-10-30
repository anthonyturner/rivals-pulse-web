import { Component, destroyPlatform, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { renderApplication } from '@angular/platform-server';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { HeroCommunityStatsComponent } from './hero-community-stats.component';

const emptyDataset: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};

@Component({
  selector: 'app-root',
  imports: [HeroCommunityStatsComponent],
  template: `<app-hero-community-stats heroId="storm" heroName="Storm" [stats]="stats" />`,
})
class SsrHostComponent {
  readonly stats = emptyDataset;
}

describe('HeroCommunityStatsComponent server render', () => {
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

  it('renders the designed empty state, with no zeros or NaN, from an empty dataset', async () => {
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(SsrHostComponent, { providers: [provideZonelessChangeDetection()] }, context),
      { document: '<html><body><app-root></app-root></body></html>' },
    );

    expect(html).toContain('Not enough data yet');
    expect(html).toContain('No match recorded by Rivals Pulse players has Storm yet');
    expect(html).toContain('Rivals Pulse players');
    expect(html).not.toMatch(/NaN|Infinity|<dl/);
  });
});

function restoreGlobals(before: ReadonlyMap<PropertyKey, PropertyDescriptor>): void {
  for (const key of Reflect.ownKeys(globalThis)) {
    const original = before.get(key);

    if (original === undefined) {
      Reflect.deleteProperty(globalThis, key);
    } else if (Object.getOwnPropertyDescriptor(globalThis, key)?.value !== original.value) {
      Object.defineProperty(globalThis, key, original);
    }
  }
}
