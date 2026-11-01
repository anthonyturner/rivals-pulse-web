import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GoogleConsentService } from '../../consent/google-consent.service';
import { Footer } from './footer';

describe('Footer', () => {
  const canChangeChoice = signal(false);
  const reopenChoices = jasmine.createSpy('reopenChoices');
  let fixture: ComponentFixture<Footer>;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settingsButton = (): HTMLButtonElement | null =>
    page().querySelector<HTMLButtonElement>('button.site-footer__link');

  beforeEach(async () => {
    canChangeChoice.set(false);
    reopenChoices.calls.reset();

    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: GoogleConsentService, useValue: { canChangeChoice, reopenChoices } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
  });

  it('links to the privacy notes', () => {
    const link = page().querySelector('a[href="/privacy"]') as HTMLAnchorElement | null;

    expect(link).withContext('the footer has a privacy link').toBeTruthy();
    expect(link?.textContent?.trim()).toBe('Privacy notes');
  });

  it('keeps saying the site is an independent fan project', () => {
    const text = (page().textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('RivalsPulse is an independent project, not affiliated with NetEase, Marvel or Overwolf.');
  });

  it('offers no privacy settings button where Google shows no consent message', () => {
    expect(settingsButton()).toBeNull();
  });

  it('offers a privacy settings button where Google shows its message, and reopens the message on click', async () => {
    canChangeChoice.set(true);
    await fixture.whenStable();

    expect(settingsButton()?.textContent?.trim()).toBe('Privacy and cookie settings');

    settingsButton()?.click();

    expect(reopenChoices).toHaveBeenCalledTimes(1);
  });
});
