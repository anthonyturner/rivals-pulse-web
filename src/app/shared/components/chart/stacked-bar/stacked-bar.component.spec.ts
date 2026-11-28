import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StackedBarComponent, type StackedBarPart } from './stacked-bar.component';

const PARTS: StackedBarPart[] = [
  { label: 'Competitive', value: 60, valueLabel: '60%', detail: '24 min' },
  { label: 'Quick Match', value: 40, valueLabel: '40%' },
  { label: 'Practice', value: 0, valueLabel: '0%' },
];

@Component({ imports: [StackedBarComponent], template: '<app-stacked-bar [parts]="parts" [whole]="whole" />' })
class HostComponent {
  parts = PARTS;
  whole: number | undefined = undefined;
}

describe('StackedBarComponent', () => {
  let element: HTMLElement;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('cuts the bar in proportion and skips a part with nothing in it', () => {
    const widths = Array.from(element.querySelectorAll<HTMLElement>('.part'), (part) => part.style.width);

    expect(widths).toEqual(['60%', '40%']);
  });

  it('hides the bar and lists every part with its figure and detail as text', () => {
    expect(element.querySelector('.bar')?.getAttribute('aria-hidden')).toBe('true');

    const items = Array.from(element.querySelectorAll('.item'), (item) => item.textContent?.replace(/\s+/g, ' ').trim());

    expect(items).toEqual(['Competitive 60% 24 min', 'Quick Match 40%', 'Practice 0%']);
  });

  it('leaves the rest of the bar empty when it is given a whole larger than its parts', async () => {
    fixture.componentInstance.parts = [PARTS[0], { ...PARTS[1], value: 15 }];
    fixture.componentInstance.whole = 100;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    const widths = Array.from(element.querySelectorAll<HTMLElement>('.part'), (part) => part.style.width);

    expect(widths).toEqual(['60%', '15%']);
  });
});
