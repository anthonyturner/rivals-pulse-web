import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PrivacyPageComponent } from './privacy-page.component';
import { EXTENDED_UPLOAD_FIELDS, EXTENDED_UPLOAD_STATUS, TODAY_UPLOAD_FIELDS } from './privacy-notes.data';

describe('PrivacyPageComponent', () => {
  let fixture: ComponentFixture<PrivacyPageComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPageComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  const section = (id: string): HTMLElement => {
    const element = page.querySelector(`#${id}`) as HTMLElement | null;
    expect(element).withContext(`section #${id}`).toBeTruthy();
    return element as HTMLElement;
  };

  const itemLabels = (id: string): string[] =>
    Array.from(section(id).querySelectorAll('li')).map((item) => item.textContent ?? '');

  it('names the page and has one h1', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.querySelector('h1')?.textContent).toContain('Privacy');
  });

  it('lists every field uploaded today, including names and player ids', () => {
    const items = itemLabels('uploaded-today');

    for (const field of TODAY_UPLOAD_FIELDS) {
      expect(items.some((text) => text.includes(field.label)))
        .withContext(field.label)
        .toBeTrue();
    }
    expect(TODAY_UPLOAD_FIELDS.map((field) => field.label)).toEqual(
      jasmine.arrayContaining(['In-game name', 'Player id', 'Match length', 'Match id']),
    );
  });

  it('lists every extended field and marks them as being added', () => {
    expect(EXTENDED_UPLOAD_STATUS).toBe('being-added');
    const extended = section('extended-fields');
    const items = itemLabels('extended-fields');

    for (const field of EXTENDED_UPLOAD_FIELDS) {
      expect(items.some((text) => text.includes(field.label)))
        .withContext(field.label)
        .toBeTrue();
    }
    expect(extended.textContent).toContain('being added');
    expect(extended.textContent).toContain('no player');
  });

  it('keeps the kill feed to heroes only', () => {
    const killFeed = EXTENDED_UPLOAD_FIELDS.find((field) => field.label === 'Kill feed');

    expect(killFeed?.detail).toContain('hero');
    expect(killFeed?.detail).toContain('no player names or ids');
  });

  it('promises anonymous aggregates with minimum sample sizes', () => {
    const text = (section('public-numbers').textContent ?? '').toLowerCase();

    expect(text).toContain('anonymous');
    expect(text).toContain('minimum');
    expect(text).toContain('never');
  });

  it('states the retention rule', () => {
    const text = section('retention').textContent ?? '';

    expect(text).toContain('six months');
    expect(text).toContain('half-season');
    expect(text).toContain('no time limit');
    expect(text).toContain('5,000');
  });

  it('says uploads are automatic rather than chosen', () => {
    const text = page.textContent ?? '';

    expect(text).toContain('uploaded automatically');
    expect(text).not.toContain('choose to upload');
  });
});
