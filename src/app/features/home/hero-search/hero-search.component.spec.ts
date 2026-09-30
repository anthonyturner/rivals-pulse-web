import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import {
  HERO_SEARCH_PARAM,
  HERO_SEARCH_ROUTE,
  HeroSearchComponent,
  POPULAR_SEARCHES,
} from './hero-search.component';

describe('HeroSearchComponent', () => {
  let fixture: ComponentFixture<HeroSearchComponent>;
  let component: HeroSearchComponent;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSearchComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSearchComponent);
    component = fixture.componentInstance;
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  function submit(): void {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  it('hands the typed term to the roster as a query parameter', () => {
    component.term.set('hela');
    submit();

    expect(navigate).toHaveBeenCalledWith([HERO_SEARCH_ROUTE], {
      queryParams: { [HERO_SEARCH_PARAM]: 'hela' },
    });
  });

  it('trims the term before searching', () => {
    component.term.set('  luna snow  ');
    submit();

    expect(navigate).toHaveBeenCalledWith([HERO_SEARCH_ROUTE], {
      queryParams: { [HERO_SEARCH_PARAM]: 'luna snow' },
    });
  });

  it('opens the unfiltered roster when nothing was typed', () => {
    component.term.set('   ');
    submit();

    expect(navigate).toHaveBeenCalledWith([HERO_SEARCH_ROUTE], { queryParams: {} });
  });

  it('renders a button per popular search and searches on click', () => {
    const chips = fixture.nativeElement.querySelectorAll('.popular-searches button');

    expect(chips.length).toBe(POPULAR_SEARCHES.length);

    chips[0].click();

    expect(component.term()).toBe(POPULAR_SEARCHES[0]);
    expect(navigate).toHaveBeenCalledWith([HERO_SEARCH_ROUTE], {
      queryParams: { [HERO_SEARCH_PARAM]: POPULAR_SEARCHES[0] },
    });
  });

  it('labels the field for assistive tech', () => {
    const input = fixture.nativeElement.querySelector('input[type="search"]');
    const label = fixture.nativeElement.querySelector('label');

    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('placeholder')).toContain('Search a hero');
  });

  it('does not reload the page when the form is submitted', () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
  });
});
