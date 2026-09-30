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
});
