import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ReportHeroComponent } from './report-hero.component';

describe('ReportHeroComponent', () => {
  let fixture: ComponentFixture<ReportHeroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportHeroComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportHeroComponent);
    fixture.componentRef.setInput('eyebrow', 'Featured report');
    fixture.componentRef.setInput('title', 'Season 9 Week 2');
    fixture.componentRef.setInput('description', 'Rank-by-rank hero results.');
    fixture.componentRef.setInput('headingLevel', 2);
    fixture.componentRef.setInput('actions', [
      {
        label: 'Open report',
        routerLink: '/win-rates/9',
        primary: true,
      },
    ]);
    fixture.componentRef.setInput('media', {
      kind: 'image',
      imageUrl: '/images/heroes/peni-parker.png',
      imageAlt: 'Peni Parker',
      label: 'Meta report',
      title: 'Week 2',
      meta: 'Bronze through Celestial',
    });
    fixture.detectChanges();
  });

  it('renders the requested heading level and content', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h2')?.textContent).toContain('Season 9 Week 2');
    expect(element.querySelector('.lede')?.textContent).toContain('Rank-by-rank');
  });

  it('renders reusable actions and media', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.primary-action')?.textContent).toContain('Open report');
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('Peni Parker');
  });
});
