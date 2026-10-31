import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FirstTimeGuidePageComponent } from './first-time-guide-page.component';

describe('FirstTimeGuidePageComponent', () => {
  let fixture: ComponentFixture<FirstTimeGuidePageComponent>;
  let component: FirstTimeGuidePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FirstTimeGuidePageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FirstTimeGuidePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a full first time guide outline', () => {
    expect(component.sections.length).toBeGreaterThan(5);
    expect(component.quickRules).toContain('Fight with teammates.');
  });

  it('points the hero actions at released pages only', () => {
    const element = fixture.nativeElement as HTMLElement;
    const targets = Array.from(element.querySelectorAll('.hero-actions a')).map((link) =>
      link.getAttribute('href'),
    );

    expect(targets).toEqual(['/beginner-interactive-guide', '/media-tutorials']);
  });
});
