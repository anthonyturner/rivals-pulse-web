import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeBandComponent, type HomeBandAlign, type HomeBandTone } from './home-band.component';

@Component({
  imports: [HomeBandComponent],
  template: `
    <app-home-band
      [tone]="tone"
      [headAlign]="headAlign"
      [eyebrow]="eyebrow"
      heading="Hero stats"
      headingId="stats-title"
      [lede]="lede"
    >
      <p class="body">Body</p>
    </app-home-band>
  `,
})
class HostComponent {
  tone: HomeBandTone = 'light';
  headAlign: HomeBandAlign = 'start';
  lede = 'Counted from real matches.';
  eyebrow = '';
}

describe('HomeBandComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const section = (): HTMLElement => element.querySelector('section') as HTMLElement;

  it('is a section labelled by its h2', () => {
    const heading = element.querySelector('h2') as HTMLElement;

    expect(heading.textContent?.trim()).toBe('Hero stats');
    expect(heading.id).toBe('stats-title');
    expect(section().getAttribute('aria-labelledby')).toBe('stats-title');
  });

  it('starts with the heading, then the lede, above the projected content', () => {
    const head = element.querySelector('.band__head') as HTMLElement;
    const body = element.querySelector('.body') as HTMLElement;

    expect(head.firstElementChild?.tagName).toBe('H2');
    expect(section().textContent?.trim().startsWith('Hero stats')).toBeTrue();
    expect(head.querySelector('.band__lede')?.textContent).toBe('Counted from real matches.');
    expect(head.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts a given eyebrow above the heading without changing the heading or its label', () => {
    fixture.componentInstance.eyebrow = 'Season 10.5 · 149 matches';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    const head = element.querySelector('.band__head') as HTMLElement;
    const heading = element.querySelector('h2') as HTMLElement;

    expect(head.firstElementChild?.tagName).toBe('APP-EYEBROW');
    expect(head.firstElementChild?.textContent?.trim()).toBe('Season 10.5 · 149 matches');
    expect(head.firstElementChild?.nextElementSibling).toBe(heading);
    expect(element.querySelectorAll('h1, h2, h3, h4, h5, h6').length).toBe(1);
    expect(section().getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('shows no eyebrow when it has none', () => {
    expect(element.querySelector('app-eyebrow')).toBeNull();
  });

  it('leaves out a lede it was not given', () => {
    fixture.componentInstance.lede = '';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(element.querySelector('.band__lede')).toBeNull();
  });

  it('marks its tone, with light as the plain band', async () => {
    expect(section().classList).not.toContain('band--white');

    fixture.componentInstance.tone = 'white';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(section().classList).toContain('band--white');
  });

  it('centres its head on request and starts it at the left otherwise', () => {
    expect(section().classList).not.toContain('band--center');

    fixture.componentInstance.headAlign = 'center';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(section().classList).toContain('band--center');
    expect(getComputedStyle(element.querySelector('.band__title') as HTMLElement).textAlign).toBe('center');
    expect(getComputedStyle(element.querySelector('.body') as HTMLElement).textAlign).not.toBe('center');
  });
});
