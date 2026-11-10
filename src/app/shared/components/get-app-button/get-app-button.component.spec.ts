import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OVERWOLF_APP_URL } from '../../overwolf-app';
import { GetAppButtonComponent } from './get-app-button.component';

describe('GetAppButtonComponent', () => {
  let fixture: ComponentFixture<GetAppButtonComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(GetAppButtonComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('shows nothing while there is no store URL, not a link and not a "Coming soon" button', () => {
    // Guards against a placeholder URL reaching the page.
    expect(OVERWOLF_APP_URL).toBe('');
    expect(element.querySelector('a, button')).toBeNull();
    expect(text(element)).toBe('');
  });

  it('becomes a link in the same slot once the store URL is set', () => {
    fixture.componentRef.setInput('appUrl', 'https://www.overwolf.com/app/rivals-pulse');
    fixture.detectChanges();

    const link = element.querySelector('a.get-app') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('https://www.overwolf.com/app/rivals-pulse');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(text(link)).toBe('Get RivalsPulse on Overwolf (opens in a new tab)');
    expect(element.querySelector('button')).toBeNull();
  });
});
