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
  template: `<app-column-chart caption="Matches by day" rowHeader="Day" [lanes]="lanes" [columns]="columns" [showValues]="showValues" [emptyKey]="emptyKey" />`,
})
class HostComponent {
  lanes: ChartLane[] = LANES;
  columns = COLUMNS;
  showValues = true;
  emptyKey: string | null = null;
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

  it('draws a bar at its height and sets a dot by its position in the lane', () => {
    const bars = element.querySelectorAll<HTMLElement>('.bar');
    const dots = element.querySelectorAll<HTMLElement>('.dot');

    expect(Array.from(bars, (bar) => bar.style.height)).toEqual(['100%', '50%']);
    expect(dots.length).toBe(1);
    expect(dots[0].style.getPropertyValue('--position')).toBe('0.75');
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

  it('gives each lane a height that never depends on what it holds', () => {
    const heights = Array.from(element.querySelectorAll<HTMLElement>('.lane'), (lane) => lane.style.height);

    expect(heights).toEqual(['96px', '120px']);
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

  it('draws a quiet dash where a column has no figure, in the lane and for a mark with no position, even with the figures off', async () => {
    fixture.componentInstance.columns = [
      { label: 'Monday', cells: [{ position: 100, valueLabel: '20%' }, { position: null, valueLabel: 'Not enough results' }] },
      { label: 'Tuesday', cells: [null, null] },
    ];
    fixture.componentInstance.showValues = false;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    const dashes = Array.from(element.querySelectorAll('.plot .none'));

    expect(dashes.map((dash) => dash.textContent)).toEqual(['–', '–', '–']);
    expect(dashes.map((dash) => dash.getAttribute('title'))).toEqual([
      'Tuesday: Share of matches Not enough data',
      'Monday: Win rate Not enough results',
      'Tuesday: Win rate Not enough data',
    ]);
    expect(element.querySelectorAll('.value').length).toBe(0);
  });

  it('explains the dash in a key under the chart only when a dash is drawn and the key is given', async () => {
    expect(element.querySelector('.empty-key')).toBeNull();

    fixture.componentInstance.emptyKey = 'not enough data yet';
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.empty-key')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('– not enough data yet');
    expect(element.querySelector('.empty-key')?.getAttribute('aria-hidden')).toBe('true');

    fixture.componentInstance.columns = [{ label: 'Monday', cells: [{ position: 100, valueLabel: '20%' }, { position: 50, valueLabel: '50%' }] }];
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.empty-key')).toBeNull();
  });

  it('draws no mark for a figure with no position, and still prints its words in the table', async () => {
    fixture.componentInstance.columns = [
      { label: 'Monday', cells: [{ position: 100, valueLabel: '20%' }, { position: null, valueLabel: 'Not enough results' }] },
    ];
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelectorAll('.dot').length).toBe(0);
    expect(Array.from(element.querySelectorAll('tbody td'), (cell) => cell.textContent)).toEqual(['20%', 'Not enough results']);
  });

  it('prints a lane note beside its heading, outside the data table', async () => {
    fixture.componentInstance.lanes = [{ name: 'Win rate', kind: 'dots', note: 'Scale 45% to 55%' }];
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.lane-name .note')?.textContent).toBe('Scale 45% to 55%');
    expect(Array.from(element.querySelectorAll('thead th'), (cell) => cell.textContent)).toEqual(['Day', 'Win rate']);
  });
});
