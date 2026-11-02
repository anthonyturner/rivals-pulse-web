import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StrategistGuidesPageComponent } from './strategist-guides-page.component';
import { STRATEGIST_GUIDES } from './strategist-guides.data';

describe('StrategistGuidesPageComponent', () => {
  let fixture: ComponentFixture<StrategistGuidesPageComponent>;
  let element: HTMLElement;

  const count = () => element.querySelector('[role="status"]')?.textContent?.trim();
  const names = () => Array.from(element.querySelectorAll('app-guide-card a'), (link) => link.textContent?.trim());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function search(term: string): Promise<void> {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(StrategistGuidesPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('lists every guide once, each under its own link name', () => {
    expect(count()).toBe('10 guides');
    expect(names().length).toBe(STRATEGIST_GUIDES.length);
    expect(new Set(names()).size).toBe(STRATEGIST_GUIDES.length);
  });

  it('labels the search input without showing the label', () => {
    expect(element.querySelector('label.guide-search .visually-hidden')?.textContent?.trim()).toBe('Search guides');
  });

  it('says how many of the guides match a search', async () => {
    await search('dive');

    expect(count()).toMatch(/^\d+ of 10 guides$/);
    expect(names().length).toBeLessThan(10);
  });

  it('shows the empty state, 0 of 10 and a way out when nothing matches', async () => {
    await search('zzzz no such guide');

    expect(count()).toBe('0 of 10 guides');
    expect(element.querySelector('app-state-panel h2')?.textContent?.trim()).toBe('No guides match');
    expect(element.querySelector('app-guide-card')).toBeNull();

    (element.querySelector('app-state-panel button') as HTMLButtonElement).click();
    await settle();

    expect(count()).toBe('10 guides');
    expect((element.querySelector('input') as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(element.querySelector('input'));
  });

  it('narrows the list by category', async () => {
    const select = element.querySelector('select') as HTMLSelectElement;
    select.value = 'Rocket Raccoon';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(count()).toBe('3 of 10 guides');
  });

  it('has one main landmark wrapping the header and the list', () => {
    expect(element.querySelectorAll('main').length).toBe(1);
    expect(element.querySelector('main h1')).not.toBeNull();
    expect(element.querySelector('main app-guide-card')).not.toBeNull();
  });
});
