import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StatePanelComponent } from './state-panel.component';

@Component({
  imports: [StatePanelComponent],
  template: `
    <app-state-panel id="loading" kind="loading" heading="Loading the tier list">Fetching.</app-state-panel>
    <app-state-panel id="error" kind="error" heading="Could not be loaded" [headingLevel]="3">Try later.</app-state-panel>
    <app-state-panel id="empty"><p>Nothing yet.</p></app-state-panel>
  `,
})
class HostComponent {}

describe('StatePanelComponent', () => {
  let element: HTMLElement;
  const panel = (id: string): HTMLElement => element.querySelector(`#${id}`) as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('announces a loading panel politely and marks it busy', () => {
    expect(panel('loading').getAttribute('role')).toBe('status');
    expect(panel('loading').getAttribute('aria-busy')).toBe('true');
  });

  it('announces an error panel politely without marking it busy', () => {
    expect(panel('error').getAttribute('role')).toBe('status');
    expect(panel('error').hasAttribute('aria-busy')).toBeFalse();
  });

  it('does not announce an empty panel', () => {
    expect(panel('empty').hasAttribute('role')).toBeFalse();
    expect(panel('empty').querySelector('[role="heading"]')).toBeNull();
    expect(panel('empty').textContent).toContain('Nothing yet.');
  });

  it('draws the heading at the level the page asks for', () => {
    expect(panel('loading').querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('2');
    expect(panel('error').querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('3');
  });
});
