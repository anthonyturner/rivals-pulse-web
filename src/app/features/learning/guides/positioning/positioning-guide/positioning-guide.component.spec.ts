import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PositioningGuideComponent } from './positioning-guide.component';
import type { PositioningGuide } from './positioning-guide.types';

const GUIDE: PositioningGuide = {
  title: 'Test guide',
  lede: 'A lede.',
  sourceLabel: 'Watch it',
  sourceUrl: 'https://youtu.be/abc123?si=token',
  diagram: {
    caption: 'What the diagram shows.',
    rows: [{ label: 'Row', nodes: [{ text: 'One', key: true }, { text: 'Two' }] }],
  },
  checklist: [{ label: 'Check', detail: 'Is it checked?' }],
  sections: [{ title: 'Idea', paragraphs: ['First explanation.', 'Second explanation.'] }],
  notesTitle: 'Notes',
  notes: [{ label: 'Role', detail: 'Do this.' }],
  drills: [{ label: 'Drill', detail: 'Practise.' }],
  timestamps: [
    { label: '1:36', detail: 'First topic.' },
    { label: '1:03:30', detail: 'Last topic.' },
  ],
  workedExample: { title: 'Hypothetical: a position', paragraphs: ['Make the decision.'] },
  practiceFocus: 'Review one decision.',
};

describe('PositioningGuideComponent', () => {
  let fixture: ComponentFixture<PositioningGuideComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(PositioningGuideComponent);
    fixture.componentRef.setInput('guide', GUIDE);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('gives the diagram a visible caption and hides the nodes from assistive technology', () => {
    expect(element.querySelector('figure figcaption')?.textContent?.trim()).toBe('What the diagram shows.');
    expect(element.querySelector('.diagram-rows')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelectorAll('.flow li').length).toBe(2);
  });

  it('links each guide map time into the video at that moment, described by its topic', () => {
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.timeline a'));

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://youtu.be/abc123?si=token&t=96s',
      'https://youtu.be/abc123?si=token&t=3810s',
    ]);
    for (const link of links) {
      expect(element.querySelector(`#${link.getAttribute('aria-describedby')}`)?.textContent).toContain('topic');
      expect(link.textContent).toContain('opens YouTube in a new tab');
    }
  });

  it('has no live region', () => {
    expect(element.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length).toBe(0);
  });

  it('reads as an article and gives every chapter link a matching target', () => {
    expect(element.querySelector('.guide-tile, .guide-bullets, .guide-grid')).toBeNull();
    expect(element.querySelector('#chapter-1')?.textContent).toContain('First explanation.');
    expect(element.querySelector('#worked-example')?.textContent).toContain('Hypothetical:');
    expect(element.querySelector('#next-match')?.textContent).toContain('Review one decision.');
    for (const link of Array.from(element.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'))) {
      const id = new URL(link.href).hash.slice(1);
      expect(element.querySelector(`[id="${id}"]`)).withContext(id).not.toBeNull();
    }
    expect(element.querySelector('details.chapters--mobile')?.hasAttribute('open')).toBeFalse();
  });

  it('updates the reading content and source moments when its guide input changes', () => {
    fixture.componentRef.setInput('guide', {
      ...GUIDE,
      title: 'Another lesson',
      sections: [{ title: 'Changed idea', paragraphs: ['Changed explanation.'] }],
      sourceUrl: 'https://www.youtube.com/watch?v=changed',
      timestamps: [{ label: '2:00', detail: 'Changed topic.' }],
    });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent).toBe('Another lesson');
    expect(element.querySelector('#chapter-1')?.textContent).toContain('Changed explanation.');
    expect(element.querySelector('.timeline a')?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=changed&t=120s');
  });
});
