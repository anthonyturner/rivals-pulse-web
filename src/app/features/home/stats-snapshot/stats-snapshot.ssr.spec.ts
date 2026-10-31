import { APP_BASE_HREF } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { Component, destroyPlatform, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { renderApplication } from '@angular/platform-server';
import { provideRouter } from '@angular/router';

import { StatsSnapshotComponent } from './stats-snapshot.component';

@Component({
  selector: 'app-root',
  imports: [StatsSnapshotComponent],
  template: `<app-stats-snapshot />`,
})
class SsrHostComponent {}

describe('StatsSnapshotComponent server render', () => {
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

  it('renders the heading, the reserved loading panel, the links and the invitation, with no zeros or NaN', async () => {
    const page = await renderApplication(
      (context) =>
        bootstrapApplication(
          SsrHostComponent,
          {
            providers: [
              provideZonelessChangeDetection(),
              provideRouter([]),
              provideHttpClient(),
              { provide: APP_BASE_HREF, useValue: '/' },
            ],
          },
          context,
        ),
      { document: '<html><body><app-root></app-root></body></html>' },
    );

    const html = page.replace(/<style[\s\S]*?<\/style>/g, '');

    expect(html).toContain('Hero stats');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('href="/tier-list"');
    expect(html).toContain('Every match played with Rivals Pulse makes these stats sharper.');
    expect(html.match(/NaN|Infinity|undefined|<table|role="tab"/)).toBeNull();
    expect(html.match(/(^|[^\d.])0(\.0)?%/)).toBeNull();
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
