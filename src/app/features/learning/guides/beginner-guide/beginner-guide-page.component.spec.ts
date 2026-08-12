import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';

import { BeginnerGuidePageComponent } from './beginner-guide-page.component';

describe('BeginnerGuidePageComponent', () => {
  let fixture: ComponentFixture<BeginnerGuidePageComponent>;
  let component: BeginnerGuidePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BeginnerGuidePageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BeginnerGuidePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates the recommended plan when a role is selected', () => {
    component.selectRole('Duelist');

    expect(component.recommendedPlan().title).toBe('Setup Before Burst');
  });

  it('updates feedback and progress when an answer is selected', () => {
    const module = component.currentModule();

    component.selectAnswer(module.id, module.scenario.choices[0].id);

    expect(component.selectedChoice()?.feedbackTitle).toBe('Strong read');
    expect(component.answeredCount()).toBe(1);
    expect(component.progressPercent()).toBe(25);
  });

  it('marks the guide complete when every module has an answer', () => {
    for (const module of component.modules) {
      component.selectAnswer(module.id, module.scenario.choices[0].id);
    }

    expect(component.guideComplete()).toBeTrue();
    expect(component.strongAnswerCount()).toBe(4);
  });
});
