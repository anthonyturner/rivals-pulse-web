import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BAN_ANSWER_SOURCES, buildBanAnswer } from '../../../shared/ban-answer';
import { TrustBlockComponent } from './trust-block.component';

describe('TrustBlockComponent', () => {
  let fixture: ComponentFixture<TrustBlockComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(TrustBlockComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('asks the ban question in an h3 and answers it with the text shared with /faq', () => {
    expect(text(element.querySelector('h3'))).toBe('Will it get me banned?');
    expect(text(element.querySelector('.trust__answer'))).toBe(buildBanAnswer(false));
  });

  it('follows the listing: the same answer, with the official-app clause once there is one', () => {
    fixture.componentRef.setInput('listed', true);
    fixture.detectChanges();

    expect(text(element.querySelector('.trust__answer'))).toBe(buildBanAnswer(true));
  });

  it('lists the shared sources in order, each opening in a new tab', () => {
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.sources a'));

    expect(links.map((link) => link.getAttribute('href'))).toEqual(BAN_ANSWER_SOURCES.map((source) => source.url));
    expect(links.every((link) => link.target === '_blank' && link.rel === 'noopener noreferrer')).toBeTrue();
  });

  it('links the FAQ for the rest', () => {
    expect(element.querySelector('a[href="/faq#ban-risk"]')).toBeTruthy();
  });

  it('links the Fair play and privacy page', () => {
    expect(element.querySelector('a[href="/fair-play"]')).toBeTruthy();
  });

  it('never calls the app safe or promises more than the FAQ does', () => {
    expect(text(element)).not.toMatch(/\bsafe\b|ban-proof|risk-free|100%|guarantee/i);
  });
});
