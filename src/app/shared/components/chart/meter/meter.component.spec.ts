import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MeterComponent } from './meter.component';

@Component({
  imports: [MeterComponent],
  template: `
    <app-meter id="plain" [value]="30" />
    <app-meter id="guided" [value]="60" [min]="40" [max]="80" [guide]="50" />
    <app-meter id="over" [value]="250" />
  `,
})
class HostComponent {}

describe('MeterComponent', () => {
  let element: HTMLElement;
  const fill = (id: string): HTMLElement => element.querySelector(`#${id} .fill`) as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('fills the track up to the value', () => {
    expect(fill('plain').style.width).toBe('30%');
    expect(fill('guided').style.width).toBe('50%');
  });

  it('holds a value past the end of the track to the end', () => {
    expect(fill('over').style.width).toBe('100%');
  });

  it('draws the guide only when asked, at its place on the same scale', () => {
    expect(element.querySelector('#plain .guide')).toBeNull();
    expect((element.querySelector('#guided .guide') as HTMLElement).style.left).toBe('25%');
  });

  it('is hidden from assistive technology', () => {
    expect(element.querySelector('#plain')?.getAttribute('aria-hidden')).toBe('true');
  });
});
