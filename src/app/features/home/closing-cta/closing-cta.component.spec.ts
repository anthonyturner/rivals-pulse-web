import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DISCORD_INVITE_URL } from '../../../shared/discord-invite';
import { ClosingCtaComponent } from './closing-cta.component';

describe('ClosingCtaComponent', () => {
  let fixture: ComponentFixture<ClosingCtaComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(ClosingCtaComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const discord = (): HTMLAnchorElement | null => element.querySelector('a[href^="https://"]');

  it('is a dark band named "Get Rivals Pulse" with the shared get-app button', () => {
    expect(element.querySelector('section')?.classList).toContain('band--dark');
    expect(text(element.querySelector('h2'))).toBe('Get Rivals Pulse');
    expect(element.querySelector('app-get-app-button button[aria-disabled="true"]')).toBeTruthy();
  });

  it('links the stats and How we count', () => {
    const hrefs = Array.from(element.querySelectorAll('.links a:not([target])')).map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(['/community', '/how-we-count']);
  });

  it('has no email field, since nothing stores a notify-me address yet', () => {
    expect(element.querySelector('input, form')).toBeNull();
  });

  describe('the Discord link', () => {
    it('links the configured Discord invite, first and opening in a new tab', () => {
      expect(DISCORD_INVITE_URL).toBe('https://discord.gg/TtGh6btTr');
      expect(discord()?.getAttribute('href')).toBe(DISCORD_INVITE_URL);
      expect(discord()?.target).toBe('_blank');
      expect(discord()?.rel).toBe('noopener noreferrer');
      expect(text(discord())).toBe('Join the Discord (opens in a new tab)');
      expect(element.querySelector('.links a')).toBe(discord());
    });

    it('is left out when the configured URL is emptied', () => {
      fixture.componentRef.setInput('discordUrl', '');
      fixture.detectChanges();

      expect(discord()).toBeNull();
      expect(text(element)).not.toContain('Discord');
    });
  });
});
