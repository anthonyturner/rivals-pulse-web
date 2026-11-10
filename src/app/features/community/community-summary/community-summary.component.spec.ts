import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ThinContent } from '../../../core/seo/thin-content';
import { CommunitySummaryComponent } from './community-summary.component';

describe('CommunitySummaryComponent', () => {
  let fixture: ComponentFixture<CommunitySummaryComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function render(inputs: Record<string, unknown>): void {
    fixture = TestBed.createComponent(CommunitySummaryComponent);
    fixture.componentRef.setInput('heading', 'Hero pick and win rates');
    fixture.componentRef.setInput('subject', 'hero numbers');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
  });

  it('opens with the tab heading, and shows the season once the numbers are ready', () => {
    render({ kind: 'ready', halfSeasonLabel: 'Season 10.5' });

    expect(host().querySelector('h2')?.textContent?.trim()).toBe('Hero pick and win rates');
    expect(host().querySelector('.tab-scope')?.textContent?.trim()).toBe('Season 10.5');
  });

  it('announces a loading panel under the tab heading, with a level-3 heading', () => {
    render({ kind: 'loading' });

    const panel = host().querySelector('app-state-panel') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('status');
    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(panel.querySelector('h3')?.textContent).toBe('Loading hero numbers');
    expect(host().querySelector('.tab-scope')).toBeNull();
  });

  it('says the numbers could not be loaded, naming the subject', () => {
    render({ kind: 'unavailable' });

    expect(host().querySelector('app-state-panel h3')?.textContent).toBe('Hero numbers could not be loaded');
  });

  it('shows the reason and the first link when there is not enough data, without a heading of its own', () => {
    render({ kind: 'not-enough-data', summary: 'Twelve matches so far.', link: { label: 'Browse', path: '/heroes' } });

    const panel = host().querySelector('app-state-panel') as HTMLElement;
    expect(panel.hasAttribute('role')).toBeFalse();
    expect(panel.querySelector('h2, h3')).toBeNull();
    expect(panel.textContent).toContain('Twelve matches so far.');
    expect(panel.querySelector('a')?.getAttribute('href')).toBe('/heroes');
  });

  it('is thin content, so ad-free and noindex, unless the numbers are ready', () => {
    const thin = TestBed.inject(ThinContent);

    for (const kind of ['loading', 'unavailable', 'not-enough-data']) {
      render({ kind });

      expect(thin.thin()).withContext(kind).toBeTrue();
      fixture.destroy();
    }

    render({ kind: 'ready' });

    expect(thin.thin()).toBeFalse();
  });

  it('shows the notice, footnote and both links when ready', () => {
    render({
      kind: 'ready',
      notice: 'Season 10 stands in.',
      footnote: 'From 194 matches.',
      link: { label: 'First', path: '/a' },
      secondLink: { label: 'Second', path: '/b' },
    });

    expect(host().querySelector('app-notice')?.textContent).toContain('Previous half-season. Season 10 stands in.');
    expect(host().querySelector('.footnote')?.textContent).toBe('From 194 matches.');
    expect(Array.from(host().querySelectorAll('.links a')).map((a) => a.getAttribute('href'))).toEqual(['/a', '/b']);
  });
});
