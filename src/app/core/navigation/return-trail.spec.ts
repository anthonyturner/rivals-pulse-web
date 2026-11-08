import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { pageLabel, provideReturnTrail, ReturnTrail } from './return-trail';

@Component({ template: '' })
class BlankPage {}

describe('ReturnTrail', () => {
  let router: Router;
  let trail: ReturnTrail;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', title: 'RivalsPulse | Feel the pulse of every match', component: BlankPage },
          { path: 'profile', title: 'Your stats | RivalsPulse', component: BlankPage },
          { path: 'community/:tab', title: 'Community | RivalsPulse', component: BlankPage },
          { path: 'counters', component: BlankPage },
          { path: 'heroes', title: 'Heroes | RivalsPulse', component: BlankPage },
          { path: 'heroes/:heroId', title: 'Mantis | RivalsPulse', component: BlankPage },
        ]),
        provideReturnTrail(),
      ],
    });
    router = TestBed.inject(Router);
    trail = TestBed.inject(ReturnTrail);
  });

  async function visit(...urls: string[]): Promise<void> {
    for (const url of urls) {
      await router.navigateByUrl(url);
    }
  }

  it('names the page the reader came from and keeps its address', async () => {
    await visit('/profile', '/heroes/mantis');

    const origin = trail.originOutside('/heroes');

    expect(origin?.label).toBe('Your stats');
    expect(router.serializeUrl(origin!.url)).toBe('/profile');
  });

  it('keeps the query string of the page the reader came from', async () => {
    await visit('/community/heroes?season=9', '/heroes/mantis');

    expect(router.serializeUrl(trail.originOutside('/heroes')!.url)).toBe('/community/heroes?season=9');
  });

  it('keeps the same origin while the reader moves between heroes', async () => {
    await visit('/profile', '/heroes/mantis', '/heroes/storm', '/heroes', '/heroes/loki');

    expect(trail.originOutside('/heroes')?.label).toBe('Your stats');
  });

  it('has no origin for a hero page opened directly', async () => {
    await visit('/heroes/mantis');

    expect(trail.originOutside('/heroes')).toBeNull();
  });

  it('follows the latest page the reader left the area for', async () => {
    await visit('/profile', '/heroes/mantis', '/community/heroes', '/heroes/storm');

    expect(trail.originOutside('/heroes')?.label).toBe('Community');
  });

  it('has no origin when the reader opened the hero from the Heroes page', async () => {
    await visit('/', '/heroes', '/heroes/mantis');

    expect(trail.originOutside('/heroes')).toBeNull();
  });

  it('calls the home page Home', async () => {
    await visit('/', '/heroes/mantis');

    expect(trail.originOutside('/heroes')?.label).toBe('Home');
  });

  it('offers a plain Back for a page with no title of its own', async () => {
    await visit('/counters', '/heroes/mantis');

    const origin = trail.originOutside('/heroes');

    expect(origin?.label).toBe('Back');
    expect(router.serializeUrl(origin!.url)).toBe('/counters');
  });

  it('has no origin for an area the reader is not in', async () => {
    await visit('/heroes/mantis', '/profile');

    expect(trail.originOutside('/heroes')).toBeNull();
  });
});

describe('pageLabel', () => {
  const url = (path: string) => TestBed.inject(Router).parseUrl(path);

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));

  it('drops the site name from a page title', () => {
    expect(pageLabel('Tier list | RivalsPulse', url('/tier-list'))).toBe('Tier list');
  });

  it('keeps a title without the site name as it is', () => {
    expect(pageLabel('Tier list', url('/tier-list'))).toBe('Tier list');
  });
});
