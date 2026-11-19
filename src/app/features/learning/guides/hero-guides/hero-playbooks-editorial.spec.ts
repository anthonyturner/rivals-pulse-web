import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../../app.routes';

describe('hero playbook lessons', () => {
  let harness: RouterTestingHarness;

  const page = () => harness.routeNativeElement;
  const text = (selector: string) => page()?.querySelector(selector)?.textContent?.replace(/\s+/g, ' ') ?? '';

  async function open(hero: string): Promise<void> {
    await harness.navigateByUrl(`/hero-guides/${hero}`);
    harness.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter(routes)] });
    harness = await RouterTestingHarness.create();
  });

  it('keeps each direct address, visible source credit, example and practice focus in the reader', async () => {
    const guides = [
      { id: 'captain-america', title: 'Captain America', source: 'https://www.youtube.com/watch?v=HZrBVN4tuik' },
      { id: 'jubilee', title: 'Jubilee', source: 'https://www.youtube.com/watch?v=-XnynKZDHls' },
      { id: 'deadpool', title: 'Deadpool', source: 'https://www.youtube.com/watch?v=JJoZw60nFto&t=317s' },
    ];

    for (const guide of guides) {
      await open(guide.id);
      expect(text('h1').trim()).toBe(guide.title);
      expect(page()?.querySelector('.field-guide__source-credit a')?.getAttribute('href')).toBe(guide.source);
      expect(text('#worked-example')).not.toBe('');
      expect(text('#next-match')).toContain('match');
      expect(text('.field-guide__caveat')).toContain('balance may differ');
      expect(page()?.querySelector('.guide-tile, .guide-bullets')).toBeNull();
      expect(page()?.querySelector('#sources details')?.hasAttribute('open')).toBeFalse();
      for (const fragment of ['worked-example', 'next-match', 'ultimates', 'sources']) {
        expect(page()?.querySelector(`app-guide-chapters a[href$="#${fragment}"]`)).not.toBeNull();
      }
    }
  });

  it('retains the Captain America finish-versus-exit limit and the three ultimate jobs', async () => {
    await open('captain-america');

    expect(text('.field-guide__body')).toContain('it stops when it hits a target');
    expect(text('.field-guide__body')).toContain('saving it lets you dodge crowd control and leave');
    expect(text('#worked-example')).toContain('Paulie');
    expect(text('#worked-example')).toContain('Psylocke');
    expect(text('#ultimates')).toContain('Freedom Charge: Engage');
    expect(text('#ultimates')).toContain('Freedom Charge: Counter-threat');
    expect(text('#ultimates')).toContain('Freedom Charge: Stall');
    expect(text('#ultimates')).toContain('Ultron pressure');
    expect(text('#ultimates')).toContain('Huge fight-ending ultimates');
  });

  it('keeps Jubilee recall, detonation and healthy-target charging conditions distinct', async () => {
    await open('jubilee');

    expect(text('.field-guide__body')).toContain('Recall does not require line of sight, but detonation does');
    expect(text('.field-guide__body')).toContain('A healthy ally has no missing health');
    expect(text('.field-guide__body')).toContain('use the others before they expire to refresh it');
    expect(text('#worked-example')).toContain('hypothetical practice situation');
    expect(text('#ultimates')).toContain('Firework Finale');
    expect(text('#ultimates')).toContain('Contracting the ring when allies urgently need its healing');
    expect(text('#ultimates')).toContain('Repeated ring animations when enhanced fire could secure eliminations');
  });

  it('preserves Tankpool source timing, shield exceptions and survival-oriented ultimate advice', async () => {
    await open('deadpool');

    expect(page()?.querySelector('iframe')?.getAttribute('src')).toContain('start=317');
    expect(text('.field-guide__body')).toContain('even if the target never shoots or misses');
    expect(text('.field-guide__body')).toContain('strict 45-second cooldown');
    expect(text('#worked-example')).toContain('hypothetical practice sequence');
    expect(text('#ultimates')).toContain('Jeff if he goes underground and stops healing');
    expect(text('#ultimates')).toContain('Phoenix ultimate because it cuts through');
    expect(text('#ultimates')).toContain('Fights already lost with no team follow-up');
    expect(text('#ultimates')).toContain('300-400 health shield');
  });
});
