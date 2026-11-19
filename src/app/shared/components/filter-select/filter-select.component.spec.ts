import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterSelectComponent } from './filter-select.component';

describe('FilterSelectComponent', () => {
  let fixture: ComponentFixture<FilterSelectComponent>;
  let select: HTMLSelectElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterSelectComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterSelectComponent);
    fixture.componentRef.setInput('label', 'Mode');
    fixture.componentRef.setInput('options', [
      { value: 'all', label: 'Quick Match and Competitive' },
      { value: 'competitive', label: 'Competitive' },
    ]);
    fixture.componentRef.setInput('value', 'competitive');
    fixture.detectChanges();
    select = (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
  });

  it('labels the drop-down and lists the options with the current value selected', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('label')?.textContent).toContain('Mode');
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
      'Quick Match and Competitive',
      'Competitive',
    ]);
    expect(select.value).toBe('competitive');
  });

  it('reports the value a person picks', () => {
    const picked: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => picked.push(value));

    select.value = 'all';
    select.dispatchEvent(new Event('change'));

    expect(picked).toEqual(['all']);
  });
});
