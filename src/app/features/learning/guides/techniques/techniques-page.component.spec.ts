import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TechniquesPageComponent } from './techniques-page.component';
import { TECHNIQUE_GUIDES } from './techniques.data';

describe('TechniquesPageComponent', () => {
  let fixture: ComponentFixture<TechniquesPageComponent>;
  let element: HTMLElement;

  const count = () => element.querySelector('[role="status"]')?.textContent?.trim();
  const titles = () => Array.from(element.querySelectorAll('.library app-technique-tile h3'), (h) => h.textContent?.trim());
  const input = () => element.querySelector('input') as HTMLInputElement;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function search(term: string): Promise<void> {
    input().value = term;
    input().dispatchEvent(new Event('input'));
    await settle();
  }

  async function pickCategory(category: string): Promise<void> {
    const select = element.querySelector('select') as HTMLSelectElement;
    select.value = category;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(TechniquesPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('lists every guide and says how many', () => {
    expect(count()).toBe('13 guides');
    expect(titles().length).toBe(TECHNIQUE_GUIDES.length);
  });

  it('leaves the main landmark to the shell and has one h1, a breadcrumb and a labelled search field', () => {
    const crumbs = element.querySelector('nav[aria-label="Breadcrumb"]');

    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(crumbs?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Techniques');
    expect(element.querySelector('label.guide-search .visually-hidden')?.textContent?.trim()).toBe('Search technique guides');
  });

  it('offers five categories and no Heroes tab', () => {
    const options = Array.from(element.querySelectorAll('option'), (option) => option.textContent?.trim());

    expect(options).toEqual(['All', 'Fundamentals', 'Roles', 'Mindset', 'VOD Reviews', 'Analyses']);
  });

  it('narrows by category and drops the category caption once one is chosen', async () => {
    expect(element.querySelector('.library app-technique-tile .guide-caption')?.textContent?.trim()).toBe('Fundamentals');

    await pickCategory('Roles');

    expect(count()).toBe('3 of 13 guides');
    expect(titles()).toEqual(['Carry on Vanguard', 'Carry on Duelist', 'Carry on Strategist']);
    expect(element.querySelector('.library app-technique-tile .guide-tile-head .guide-caption')).toBeNull();
  });

  it('searches title, takeaway, practice and tags, ignoring case and surrounding spaces', async () => {
    await search('  COVER ');
    expect(count()).toBe('2 of 13 guides');
    expect(titles()).toEqual(['Strategic Cover Usage', 'Autopilot, Tilt, and Anxiety']);

    await search('strategist');
    expect(titles()).toEqual(['Carry on Strategist']);

    await search('vod');
    expect(titles()).toEqual(['Self-review Framework']);
  });

  it('shows the empty state with no matches, whether from the search or search plus category', async () => {
    await search('zzz');

    expect(count()).toBe('No guides match');
    expect(element.querySelector('app-state-panel h3')?.textContent?.trim()).toBe('No guides match');
    expect(element.querySelector('.library app-technique-tile')).toBeNull();

    await search('cover');
    await pickCategory('Roles');

    expect(count()).toBe('No guides match');
    expect(element.querySelector('app-state-panel')).not.toBeNull();
  });

  it('clears the search and the category together and returns focus to the search field', async () => {
    await pickCategory('Roles');
    await search('zzz');

    (element.querySelector('app-state-panel button') as HTMLButtonElement).click();
    await settle();

    expect(count()).toBe('13 guides');
    expect(input().value).toBe('');
    expect((element.querySelector('select') as HTMLSelectElement).value).toBe('All');
    expect(document.activeElement).toBe(input());
  });

  it('keeps the sections below the tiles when the search finds nothing', async () => {
    await search('zzz');

    expect(element.querySelectorAll('ol.guide-steps li').length).toBe(4);
    expect(element.querySelectorAll('section.guide-section:nth-of-type(3) app-technique-tile').length).toBe(6);
    expect(element.querySelectorAll('section.guide-section:last-of-type .guide-tile').length).toBe(3);
  });

  it('lists the heroes of each role as one comma-separated paragraph', () => {
    const roles = element.querySelectorAll('section.guide-section:last-of-type .guide-tile');

    expect(roles[0].querySelector('h3')?.textContent?.trim()).toBe('Vanguard');
    expect(roles[0].querySelector('p')?.textContent).toContain('Captain America, Doctor Strange');
  });

  it('opens guide notes in this tab and videos in a new one, naming the guide in both', () => {
    const tile = element.querySelector('.library app-technique-tile') as HTMLElement;
    const [notes, video] = Array.from(tile.querySelectorAll('.links a'));

    expect(notes.getAttribute('href')).toBe('/strategic-cover');
    expect(notes.getAttribute('target')).toBeNull();
    expect(notes.textContent?.replace(/\s+/g, ' ').trim()).toBe('Guide notes for Strategic Cover Usage');

    expect(video.getAttribute('target')).toBe('_blank');
    expect(video.getAttribute('rel')).toContain('noopener');
    expect(video.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Edited video for Strategic Cover Usage (opens in a new tab)',
    );
  });

  it('shows no stat panel, diagram or uppercase-only chips', () => {
    expect(element.querySelector('[aria-hidden="true"]:not(span)')).toBeNull();
    expect(element.textContent).not.toContain('Source links');
  });
});
