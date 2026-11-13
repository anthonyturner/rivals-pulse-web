import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PowerPositionsPageComponent } from '../positioning/power-positions/power-positions-page.component';
import { StrategicCoverPageComponent } from '../positioning/strategic-cover/strategic-cover-page.component';
import { BuildTheoryPageComponent } from './build-theory/build-theory-page.component';
import { TripleSupportGuidePageComponent } from './triple-support/triple-support-guide-page.component';

const POSITIONING_SOURCES = [
  {
    path: '/power-positions',
    title: 'Power Positions',
    url: 'https://youtu.be/hnCgeDZCt0I?si=d7wxsqlCxCDMWcwU',
    times: [96, 181, 502, 1053, 2460, 3810],
    checks: ['Options.', 'Pressure.', 'Information.', 'Safety.', 'Team Sync.'],
    caveat: 'imperfect healing really requires surrendering',
  },
  {
    path: '/strategic-cover',
    title: 'Strategic Cover Usage',
    url: 'https://youtu.be/rqxP_tKV2vc?si=9K2auPgj1OXjaD2y',
    times: [0, 100, 218, 391, 480],
    checks: ['Hitbox.', 'Enemy Cover.', 'Angles.', 'Scout.', 'Exit.'],
    caveat: 'least exposure that still lets you make a useful threat',
  },
] as const;

describe('Positioning and composition field-guide routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'power-positions', component: PowerPositionsPageComponent },
          { path: 'strategic-cover', component: StrategicCoverPageComponent },
          { path: 'build-theory', component: BuildTheoryPageComponent },
          { path: 'triple-support-counter', component: TripleSupportGuidePageComponent },
        ]),
      ],
    });
  });

  it('preserves both positioning sources, every recorded source moment and the five-question tests', async () => {
    const harness = await RouterTestingHarness.create();
    for (const expected of POSITIONING_SOURCES) {
      await harness.navigateByUrl(expected.path);
      const page = harness.routeNativeElement;
      if (!page) throw new Error(`No page rendered for ${expected.path}`);
      expect(page.querySelector('h1')?.textContent?.trim()).toBe(expected.title);
      expect(page.querySelector('.field-guide__source-credit a')?.getAttribute('href')).toBe(expected.url);
      expect(Array.from(page.querySelectorAll('.timeline a'), link => link.getAttribute('href'))).toEqual(
        expected.times.map(seconds => `${expected.url}&t=${seconds}s`),
      );
      expect(Array.from(page.querySelectorAll('.checks strong'), term => term.textContent?.trim())).toEqual([...expected.checks]);
      expect(page.querySelector('#worked-example')?.textContent).toContain('Hypothetical:');
      expect(page.querySelector('#next-match')?.textContent).toMatch(/review|replay/i);
      expect(page.textContent).toContain(expected.caveat);
      expect(page.querySelector('figure figcaption')?.textContent?.trim()).not.toBe('');
      expect(page.querySelector('.diagram-rows')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('keeps all four existing destinations readable without the old main-body card grid', async () => {
    const harness = await RouterTestingHarness.create();
    for (const path of ['/power-positions', '/strategic-cover', '/build-theory', '/triple-support-counter']) {
      await harness.navigateByUrl(path);
      const page = harness.routeNativeElement;
      if (!page) throw new Error(`No page rendered for ${path}`);
      expect(page.querySelectorAll('h1').length).withContext(path).toBe(1);
      expect(page.querySelector('.guide-grid, .guide-tile, .guide-bullets')).withContext(path).toBeNull();
      expect(page.querySelector('.field-guide__body')).withContext(path).not.toBeNull();
      expect(page.querySelector('#worked-example h2')?.textContent).withContext(path).toContain('Hypothetical:');
      expect(page.querySelector('#next-match')).withContext(path).not.toBeNull();
      for (const link of Array.from(page.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'))) {
        const id = new URL(link.href).hash.slice(1);
        expect(page.querySelector(`[id="${id}"]`)).withContext(`${path}: ${id}`).not.toBeNull();
      }
    }
  });

  it('contains article, source and procedure layouts at narrow and sidebar-column widths in both themes', async () => {
    const harness = await RouterTestingHarness.create();
    const priorTheme = document.documentElement.getAttribute('data-theme');
    try {
      for (const path of ['/power-positions', '/strategic-cover', '/build-theory', '/triple-support-counter']) {
        await harness.navigateByUrl(path);
        const page = harness.routeNativeElement;
        if (!page) throw new Error(`No page rendered for ${path}`);
        page.style.display = 'block';
        for (const theme of ['dark', 'light']) {
          document.documentElement.setAttribute('data-theme', theme);
          for (const width of [320, 390, 884, 970]) {
            page.style.width = `${width}px`;
            harness.fixture.detectChanges();
            await harness.fixture.whenStable();
            const frame = page.querySelector<HTMLElement>('.field-guide');
            if (!frame) throw new Error(`No article frame for ${path}`);
            expect(frame.clientWidth).withContext(`${path} ${theme} ${width}: measurable frame`).toBeGreaterThan(0);
            expect(frame.scrollWidth).withContext(`${path} ${theme} ${width}: frame`).toBeLessThanOrEqual(frame.clientWidth + 1);
            const body = page.querySelector<HTMLElement>('.field-guide__body');
            if (!body) throw new Error(`No article body for ${path}`);
            expect(body.scrollWidth).withContext(`${path} ${theme} ${width}: body`).toBeLessThanOrEqual(body.clientWidth + 1);
          }
        }
      }
    } finally {
      if (priorTheme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', priorTheme);
    }
  });
});
