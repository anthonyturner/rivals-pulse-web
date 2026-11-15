import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { StrategistGuideDetailPageComponent } from './strategist-guide-detail-page.component';
import { STRATEGIST_ARTICLES } from './strategist-guide-article.data';
import { STRATEGIST_GUIDES } from './strategist-guides.data';

describe('StrategistGuideDetailPageComponent', () => {
  const guide = STRATEGIST_GUIDES[0];
  const params = new BehaviorSubject(convertToParamMap({ guideId: guide.id }));
  let fixture: ComponentFixture<StrategistGuideDetailPageComponent>;
  let element: HTMLElement;

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

  it('names the table parts explicitly, because the phone layout stacks them as blocks and Safari then drops the table', () => {
    const roles = (selector: string) =>
      Array.from(element.querySelectorAll(`table ${selector}`), (cell) => cell.getAttribute('role'));
    const rows = guide.decisionRules.length;

    expect(element.querySelector('table')?.getAttribute('role')).toBe('table');
    expect(roles('thead, tbody')).toEqual(['rowgroup', 'rowgroup']);
    expect(roles('tr')).toEqual(Array(rows + 1).fill('row'));
    expect(roles('thead th')).toEqual(['columnheader', 'columnheader']);
    expect(roles('tbody th')).toEqual(Array(rows).fill('rowheader'));
    expect(roles('tbody td')).toEqual(Array(rows).fill('cell'));
  });

  it('says each checkpoint link opens YouTube in a new tab', () => {
    const links = Array.from(element.querySelectorAll('a.checkpoint'));

    expect(links.length).toBe(guide.checkpoints.length);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.textContent).toContain('opens YouTube in a new tab');
    }
  });

  it('numbers the reading chapters and keeps replay questions as ordered steps', () => {
    expect(Array.from(element.querySelectorAll('.field-guide__number'), item => item.textContent?.trim())).toEqual(['01', '02', '03', '04']);
    expect(element.querySelectorAll('ol.guide-steps > li').length).toBe(guide.reviewQuestions.length);
  });

  it('lists related guides with the shared guide card', () => {
    expect(element.querySelectorAll('app-guide-card').length).toBeGreaterThan(0);
  });

  it('supplies a distinct editorial opening and hypothetical example for every lesson', async () => {
    expect(Object.keys(STRATEGIST_ARTICLES).sort()).toEqual(STRATEGIST_GUIDES.map(item => item.id).sort());
    for (const item of STRATEGIST_GUIDES) {
      params.next(convertToParamMap({ guideId: item.id }));
      await fixture.whenStable(); fixture.detectChanges();
      expect(element.querySelector('#worked-example')?.textContent).withContext(item.id).toContain('Hypothetical example');
      expect(element.querySelector('.opening')?.textContent).toBe(STRATEGIST_ARTICLES[item.id].introduction);
      expect(element.querySelector('.field-guide__body .guide-tile')).toBeNull();
      for (const rule of item.decisionRules) expect(element.querySelector('table')?.textContent).toContain(rule.action);
      for (const drill of item.drills) expect(element.querySelector('#practice')?.textContent).toContain(drill.success);
      for (const link of Array.from(element.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'))) {
        expect(element.querySelector(`[id="${new URL(link.href).hash.slice(1)}"]`)).not.toBeNull();
      }
    }
  });

  it('leaves the main landmark to the shell and has an h1', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('h1')).not.toBeNull();
  });
});
