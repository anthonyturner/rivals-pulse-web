import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ScatterChartComponent, type ScatterAxis, type ScatterGuide, type ScatterPoint } from './scatter-chart.component';

const X: ScatterAxis = { title: 'Pick rate', min: 0, max: 20, ticks: [{ value: 0, label: '0%' }, { value: 20, label: '20%' }] };
const Y: ScatterAxis = { title: 'Win rate', min: 40, max: 60, ticks: [{ value: 40, label: '40%' }, { value: 60, label: '60%' }] };
const GUIDES: ScatterGuide[] = [{ axis: 'y', value: 50, label: '50% win rate' }];
const POINTS: ScatterPoint[] = [
  {
    id: 'hulk',
    label: 'Hulk',
    x: 10,
    y: 55,
    imageUrl: '/images/heroes/hulk.png',
    role: 'Vanguard',
    link: ['/heroes', 'hulk'],
    figures: ['10.0%', '55.0%', '40 games'],
    description: 'Hulk: 55.0% win rate',
  },
];

@Component({
  imports: [ScatterChartComponent],
  template: `
    <app-scatter-chart
      caption="Hero win rate and pick rate"
      rowHeader="Hero"
      [xAxis]="x"
      [yAxis]="y"
      [columns]="['Games']"
      [guides]="guides"
      [points]="points"
    />
  `,
})
class HostComponent {
  x = X;
  y = Y;
  guides = GUIDES;
  points = POINTS;
}

describe('ScatterChartComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('places a portrait by its two figures and links it to the hero', () => {
    const dot = element.querySelector('.dot') as HTMLAnchorElement;

    expect(dot.style.left).toBe('50%');
    expect(dot.style.bottom).toBe('75%');
    expect(dot.getAttribute('href')).toBe('/heroes/hulk');
    expect(dot.dataset['role']).toBe('vanguard');
    expect(dot.getAttribute('title')).toBe('Hulk: 55.0% win rate');
  });

  it('draws the guide line at its value on its axis', () => {
    const guide = element.querySelector('.guide--across') as HTMLElement;

    expect(guide.style.bottom).toBe('50%');
    expect(guide.textContent?.trim()).toBe('50% win rate');
  });

  it('hides the plot from assistive technology and prints every point in a table', () => {
    expect(element.querySelector('.area')?.getAttribute('aria-hidden')).toBe('true');
    expect((element.querySelector('.dot') as HTMLElement).getAttribute('tabindex')).toBe('-1');
    expect(Array.from(element.querySelectorAll('thead th'), (cell) => cell.textContent)).toEqual([
      'Hero',
      'Pick rate',
      'Win rate',
      'Games',
    ]);
    expect(Array.from(element.querySelectorAll('tbody tr td'), (cell) => cell.textContent)).toEqual(['10.0%', '55.0%', '40 games']);
  });
});
