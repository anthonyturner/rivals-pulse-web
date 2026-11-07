import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';

import { BeginnerGuidePageComponent } from './beginner-guide-page.component';

describe('BeginnerGuidePageComponent', () => {
  let fixture: ComponentFixture<BeginnerGuidePageComponent>;
  let component: BeginnerGuidePageComponent;
  let element: HTMLElement;

  const radios = (): HTMLInputElement[] =>
    Array.from(element.querySelectorAll<HTMLInputElement>('fieldset input[type="radio"]'));

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BeginnerGuidePageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BeginnerGuidePageComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('points the header links at released pages only', () => {
    const targets = Array.from(element.querySelectorAll('.guide-nav a')).map((link) =>
      link.getAttribute('href'),
    );

    expect(targets).toEqual(['/hero-guides', '/media-tutorials']);
  });

  it('updates the recommended plan when a role is selected', async () => {
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="group"] button'));
    const duelist = buttons.find((button) => button.textContent?.trim() === 'Duelist');

    duelist?.click();
    await settle();

    expect(component.recommendedPlan().title).toBe('Setup Before Burst');
    expect(duelist?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').length).toBe(1);
  });

  it('asks the scenario as a fieldset of radios', () => {
    const legend = element.querySelector('fieldset legend');

    expect(legend?.textContent?.trim()).toBe(component.currentModule().scenario.prompt);
    expect(radios().length).toBe(component.currentModule().scenario.choices.length);
    expect(new Set(radios().map((radio) => radio.name)).size).toBe(1);
  });

  it('shows feedback, progress and a checked radio when an answer is chosen', async () => {
    radios()[0].click();
    await settle();

    expect(component.selectedChoice()?.feedbackTitle).toBe('Strong read');
    expect(element.querySelector('.feedback')?.textContent).toContain('Strong read');
    expect(element.querySelector('.feedback')?.textContent).toContain('Quality: strong');
    expect(element.querySelector('.feedback')?.closest('[aria-live], [role="status"]')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Strong read. Quality: strong.');
    expect(element.querySelector('progress')?.value).toBe(1);
    expect(radios()[0].checked).toBeTrue();
  });

  it('lets an answer be changed after it is given', async () => {
    radios()[0].click();
    await settle();
    radios()[1].click();
    await settle();

    expect(component.selectedChoice()?.feedbackTitle).toBe('Too isolated');
    expect(element.querySelectorAll('[role="status"]').length).toBe(1);
  });

  it('announces an answer once and stays quiet when a module is revisited', async () => {
    const status = (): string => element.querySelector('[role="status"]')?.textContent?.trim() ?? '';

    expect(status()).toBe('');

    radios()[0].click();
    await settle();
    expect(status()).toContain('Strong read');

    component.goToModule(1);
    await settle();
    expect(status()).toBe('');

    component.goToModule(0);
    await settle();
    expect(element.querySelector('.feedback')?.textContent).toContain('Strong read');
    expect(status()).toBe('');
  });

  it('clears the announcement when the guide is reset', async () => {
    radios()[0].click();
    await settle();

    component.resetGuide();
    await settle();

    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
  });

  it('has exactly one live region on the page', () => {
    expect(element.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length).toBe(1);
  });

  it('marks the current module step and moves focus to the module heading', async () => {
    const steps = Array.from(element.querySelectorAll<HTMLButtonElement>('.module-step'));

    expect(steps.map((step) => step.getAttribute('aria-current'))).toEqual(['step', null, null, null]);

    steps[2].click();
    await settle();

    const updated = Array.from(element.querySelectorAll('.module-step'));
    expect(updated.map((step) => step.getAttribute('aria-current'))).toEqual([null, null, 'step', null]);
    expect(document.activeElement?.id).toBe('module-title');
    expect(document.activeElement?.textContent).toContain(component.modules[2].title);
  });

  it('disables Previous on the first module and Next on the last', async () => {
    const buttons = (): HTMLButtonElement[] =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('.module-foot button'));

    expect(buttons()[0].disabled).toBeTrue();
    expect(buttons()[1].disabled).toBeFalse();

    component.goToModule(component.modules.length - 1);
    await settle();

    expect(buttons()[0].disabled).toBeFalse();
    expect(buttons()[1].disabled).toBeTrue();
  });

  it('says in text that the plan is locked until every scenario is answered', async () => {
    expect(element.querySelector('.plan')).toBeNull();
    expect(element.textContent).toContain('Finish the scenarios to unlock');

    for (const module of component.modules) {
      component.selectAnswer(module.id, module.scenario.choices[0].id);
    }
    await settle();

    expect(component.guideComplete()).toBeTrue();
    expect(component.strongAnswerCount()).toBe(4);
    expect(element.querySelector('.plan')).not.toBeNull();
    expect(element.textContent).not.toContain('Finish the scenarios to unlock');
  });

  it('clears the answers when the guide is reset', async () => {
    radios()[0].click();
    await settle();

    (element.querySelector('.guide-tile > .guide-button') as HTMLButtonElement).click();
    await settle();

    expect(component.answeredCount()).toBe(0);
    expect(radios().every((radio) => !radio.checked)).toBeTrue();
    expect(element.querySelector('progress')?.value).toBe(0);
  });
});
