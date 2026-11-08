import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OVERWOLF_APP_URL } from '../../../shared/overwolf-app';
import { HowItWorksComponent } from './how-it-works.component';

describe('HowItWorksComponent', () => {
  let fixture: ComponentFixture<HowItWorksComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(HowItWorksComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const steps = (): HTMLElement[] => Array.from(element.querySelectorAll<HTMLElement>('ol.steps > li'));

  it('is a light band named "How it works", with the trust block after the steps', () => {
    const band = element.querySelector('section') as HTMLElement;

    expect(text(element.querySelector('h2'))).toBe('How it works');
    expect(band.getAttribute('aria-labelledby')).toBe('home-how-title');
    expect(
      (element.querySelector('ol.steps') as HTMLElement).compareDocumentPosition(
        element.querySelector('app-trust-block') as HTMLElement,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('has three numbered steps, each with an h3', () => {
    expect(steps().map((step) => text(step.querySelector('h3')))).toEqual([
      'Install RivalsPulse from Overwolf',
      'Play Marvel Rivals with RivalsPulse running',
      'Your matches are recorded and counted',
    ]);
    expect(steps().map((step) => text(step.querySelector('.step__num')))).toEqual(['01', '02', '03']);
  });

  describe('the install step', () => {
    it('says coming soon while there is no Overwolf listing', () => {
      expect(OVERWOLF_APP_URL).toBe('');
      expect(text(steps()[0])).toContain('coming soon to the Overwolf store');
    });

    it('sends people to the store once there is a listing', () => {
      fixture.componentRef.setInput('listed', true);
      fixture.detectChanges();

      expect(text(steps()[0])).toContain('Get it from the Overwolf store');
      expect(text(steps()[0])).not.toMatch(/coming soon/i);
    });
  });

  it("counts each match into the site's stats and the player's own history", () => {
    expect(text(steps()[2].querySelector('.step__text'))).toBe(
      "Each match is recorded and counted into this site's stats, and added to your own match history.",
    );
  });

  it('makes no claim about autostart, hotkeys, ranks or Pulsa', () => {
    expect(text(element.querySelector('ol.steps'))).not.toMatch(
      /pulsa|hotkey|alt\s*\+|ctrl|autostart|starts with|\branks?\b|premium|free/i,
    );
  });
});
