import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { Hero } from '../hero.model';
import { HeroPageHeaderComponent } from './hero-page-header.component';

const mantis = { id: 'mantis', name: 'Mantis', role: 'Strategist', difficulty: 3, summary: 'Heals and buffs.' } as Hero;

describe('HeroPageHeaderComponent', () => {
  let fixture: ComponentFixture<HeroPageHeaderComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(HeroPageHeaderComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('visibleCount', 12);
    fixture.componentRef.setInput('selectedRole', 'All');
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it("puts the hero's role above the name, and nowhere else", () => {
    fixture.componentRef.setInput('hero', mantis);
    fixture.detectChanges();

    const eyebrow = element.querySelector('.header-copy')?.firstElementChild as HTMLElement;

    expect(eyebrow.tagName).toBe('APP-EYEBROW');
    expect(text(eyebrow)).toBe('Strategist');
    expect(eyebrow.nextElementSibling?.tagName).toBe('H1');
    expect(text(element.querySelector('h1'))).toBe('Mantis');
    expect(text(element.querySelector('.hero-meta-row'))).not.toContain('Strategist');
  });

  it('shows no eyebrow before a hero is chosen', () => {
    fixture.detectChanges();

    expect(element.querySelector('app-eyebrow')).toBeNull();
    expect(text(element.querySelector('h1'))).toBe('Roster Lab');
  });
});
