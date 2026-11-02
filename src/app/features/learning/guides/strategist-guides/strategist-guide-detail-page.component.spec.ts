import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { StrategistGuideDetailPageComponent } from './strategist-guide-detail-page.component';
import { STRATEGIST_GUIDES } from './strategist-guides.data';

describe('StrategistGuideDetailPageComponent', () => {
  const guide = STRATEGIST_GUIDES[0];
  const params = new BehaviorSubject(convertToParamMap({ guideId: guide.id }));
  let fixture: ComponentFixture<StrategistGuideDetailPageComponent>;
  let element: HTMLElement;

  async function open(guideId: string): Promise<void> {
    params.next(convertToParamMap({ guideId }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    params.next(convertToParamMap({ guideId: guide.id }));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    fixture = TestBed.createComponent(StrategistGuideDetailPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('says the guide is not found for an unknown id, with a way back', async () => {
    await open('nope');

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Guide not found');
    expect(element.querySelector('app-state-panel')?.getAttribute('role')).toBe('status');
    expect(element.querySelector('a[href="/strategist-guides"]')).not.toBeNull();
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('marks the current guide in the breadcrumb', () => {
    const current = element.querySelector('nav[aria-label="Breadcrumb"] [aria-current="page"]');

    expect(current?.textContent?.trim()).toBe(guide.shortTitle);
  });

  it('puts the category, length and hero on one line above the title', () => {
    const eyebrow = element.querySelector('app-eyebrow') as HTMLElement;

    expect(eyebrow.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${guide.category} · ${guide.duration} · ${guide.heroFocus}`,
    );
    expect(eyebrow.nextElementSibling?.tagName).toBe('H1');
  });

  it('shows the patch note in the shared notice', () => {
    expect(element.querySelector('app-notice')?.textContent).toContain(guide.sourceEra);
  });

  it('lays the decision rules out as a table with one When and Do header row', () => {
    const headers = Array.from(element.querySelectorAll('table thead th'), (cell) => cell.textContent?.trim());

    expect(headers).toEqual(['When', 'Do']);
    expect(element.querySelectorAll('table tbody tr').length).toBe(guide.decisionRules.length);
  });

  it('says each checkpoint link opens YouTube in a new tab', () => {
    const links = Array.from(element.querySelectorAll('a.checkpoint'));

    expect(links.length).toBe(guide.checkpoints.length);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.textContent).toContain('opens YouTube in a new tab');
    }
  });

  it('shows no numerals on the principles, and numbers the replay questions as steps', () => {
    expect(element.querySelector('.guide-tile span')).toBeNull();
    expect(element.querySelectorAll('ol.guide-steps > li').length).toBe(guide.reviewQuestions.length);
  });

  it('lists related guides with the shared guide card', () => {
    expect(element.querySelectorAll('app-guide-card').length).toBeGreaterThan(0);
  });

  it('leaves the main landmark to the shell and has an h1', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('h1')).not.toBeNull();
  });
});
