import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

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
  sections: [{ title: 'Idea', summary: 'Summary.', points: ['First', 'Second'] }],
  notesTitle: 'Notes',
  notes: [{ label: 'Role', detail: 'Do this.' }],
  drills: [{ label: 'Drill', detail: 'Practise.' }],
  timestamps: [
    { label: '1:36', detail: 'First topic.' },
    { label: '1:03:30', detail: 'Last topic.' },
  ],
};

describe('PositioningGuideComponent', () => {
  let fixture: ComponentFixture<PositioningGuideComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
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
});
