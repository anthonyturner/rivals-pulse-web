import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { DeltaView } from '../game-stats-view';
import { StatDeltaComponent } from './stat-delta.component';

describe('StatDeltaComponent', () => {
  function render(delta: DeltaView): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(StatDeltaComponent);
    fixture.componentRef.setInput('delta', delta);
    fixture.detectChanges();

    return fixture.nativeElement;
  }

  it('draws the change for the eye and says it in words for a screen reader', () => {
    const element = render({ text: '▲2', spoken: 'up 2 places', trend: 'up' });

    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('▲2');
    expect(element.querySelector('.visually-hidden')?.textContent).toBe('up 2 places');
  });

  it('carries its trend on the host so the colour follows it', () => {
    expect(render({ text: '▼1', spoken: 'down 1 place', trend: 'down' }).getAttribute('data-trend')).toBe('down');
  });
});
