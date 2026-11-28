import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ProfileFigureListComponent } from './profile-figure-list.component';

describe('ProfileFigureListComponent', () => {
  it('draws each figure with its label and detail, and a figure not counted in its quiet style', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(ProfileFigureListComponent);
    fixture.componentRef.setInput('figures', [
      { label: 'Win rate', value: '55.6%', detail: '10 wins, 8 losses', counted: true },
      { label: 'Final hits', value: 'Not counted', detail: null, counted: false },
    ]);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const items = Array.from(element.querySelectorAll('.figure'));

    expect(items.length).toBe(2);
    expect(items[0].querySelector('dt')?.textContent).toBe('Win rate');
    expect(items[0].querySelector('.value')?.textContent).toBe('55.6%');
    expect(items[0].querySelector('.value--missing')).toBeNull();
    expect(items[0].querySelector('.detail')?.textContent).toBe('10 wins, 8 losses');
    expect(items[1].querySelector('.value--missing')?.textContent).toBe('Not counted');
    expect(items[1].querySelector('.detail')).toBeNull();
  });
});
