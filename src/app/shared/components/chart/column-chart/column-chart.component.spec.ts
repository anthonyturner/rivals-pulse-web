import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColumnChartComponent, type ChartColumn, type ChartLane } from './column-chart.component';

const LANES: ChartLane[] = [
  { name: 'Share of matches', kind: 'bars' },
  { name: 'Win rate', kind: 'dots', guide: { position: 50, label: '50%' } },
];

const COLUMNS: ChartColumn[] = [
  {
    label: 'Monday',
    shortLabel: 'Mon',
    cells: [
      { position: 100, valueLabel: '20%' },
      { position: 75, valueLabel: '55%', side: 'above' },
    ],
  },
  { label: 'Tuesday', shortLabel: 'Tue', cells: [{ position: 50, valueLabel: '10%' }, null] },
];

@Component({
  imports: [ColumnChartComponent],
  template: `<app-column-chart caption="Matches by day" rowHeader="Day" [lanes]="lanes" [columns]="columns" [showValues]="showValues" [describedBy]="describedBy" />`,
})
class HostComponent {
  lanes = LANES;
  columns = COLUMNS;
  showValues = true;
  describedBy: string | null = 'how-counted';
}

describe('ColumnChartComponent', () => {
  let element: HTMLElement;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('draws a bar at its height and keeps a dot inside the lane so its value has room', () => {
    const bars = element.querySelectorAll<HTMLElement>('.bar');
    const dots = element.querySelectorAll<HTMLElement>('.dot');

    expect(Array.from(bars, (bar) => bar.style.height)).toEqual(['100%', '50%']);
    expect(dots.length).toBe(1);
    expect(dots[0].style.bottom).toBe('66%');
    expect(dots[0].classList).toContain('above');
  });

  it('hides the drawn marks from assistive technology and prints every figure in a table', () => {
    expect(element.querySelector('.plot')?.getAttribute('aria-hidden')).toBe('true');

    const rows = Array.from(element.querySelectorAll('tbody tr'), (row) =>
      Array.from(row.children, (cell) => cell.textContent?.trim()),
    );

    expect(element.querySelector('caption')?.textContent).toBe('Matches by day');
    expect(Array.from(element.querySelectorAll('thead th'), (cell) => cell.textContent)).toEqual([
      'Day',
      'Share of matches',
      'Win rate',
    ]);
    expect(rows).toEqual([
      ['Monday', '20%', '55%'],
      ['Tuesday', '10%', 'Not enough data'],
    ]);
  });

  it('labels the axis with the short names and names the guide beside its lane', () => {
    expect(Array.from(element.querySelectorAll('.axis span'), (label) => label.textContent)).toEqual(['Mon', 'Tue']);
    expect(element.querySelector('.key')?.textContent?.trim()).toBe('50%');
  });

  it('gives each lane the same height whatever it holds', () => {
    const heights = Array.from(element.querySelectorAll<HTMLElement>('.lane'), (lane) => lane.style.height);

    expect(heights).toEqual(['96px', '96px']);
  });

  it('prints the figure over each mark, or leaves it to the tooltip and the table when asked not to', async () => {
    expect(Array.from(element.querySelectorAll('.value'), (value) => value.textContent)).toEqual(['20%', '10%', '55%']);

    fixture.componentInstance.showValues = false;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelectorAll('.value').length).toBe(0);
    expect(element.querySelectorAll('tbody td').length).toBe(4);
    expect(element.querySelector('.bar')?.getAttribute('title')).toBe('Monday: Share of matches 20%');
  });

  it('points its table at the note that explains the figures, when it is given one', async () => {
    expect(element.querySelector('table')?.getAttribute('aria-describedby')).toBe('how-counted');

    fixture.componentInstance.describedBy = null;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('table')?.hasAttribute('aria-describedby')).toBeFalse();
  });
});
