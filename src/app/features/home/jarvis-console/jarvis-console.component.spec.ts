import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JarvisConsoleComponent } from './jarvis-console.component';
import { JARVIS_EXCHANGES, JARVIS_STATES } from './jarvis-console.data';

describe('JarvisConsoleComponent', () => {
  let fixture: ComponentFixture<JarvisConsoleComponent>;
  let component: JarvisConsoleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JarvisConsoleComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(JarvisConsoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Stops the core's animation frame loop between specs.
    fixture.destroy();
  });

  it('starts idle, with no transcript and an invitation to ask', () => {
    expect(component.state()).toBe('idle');
    expect(component.busy()).toBeFalse();
    expect(component.hasTranscript()).toBeFalse();
    expect(component.coreHint()).toBe('Tap to ask');
    expect(fixture.nativeElement.querySelector('.caption-text').textContent).toContain(
      'Tap the core',
    );
  });

  it('renders a chip for every core state and marks the active one', () => {
    const chips = fixture.nativeElement.querySelectorAll('.state-chip');

    expect(chips.length).toBe(JARVIS_STATES.length);
    expect(chips[0].classList).toContain('is-active');
    expect(chips[0].getAttribute('data-state')).toBe('idle');
  });

  it('offers one prompt button per scripted exchange', () => {
    const prompts = fixture.nativeElement.querySelectorAll('.prompt');

    expect(prompts.length).toBe(JARVIS_EXCHANGES.length);
    expect(prompts[0].textContent.trim()).toBe(JARVIS_EXCHANGES[0].question);
  });

  it('starts listening as soon as a prompt is asked', () => {
    component.onPromptClick(0);

    expect(component.busy()).toBeTrue();
    expect(component.state()).toBe('listening');
    expect(component.coreHint()).toBe('listening');
  });

  it('ignores a second question while one is already running', () => {
    component.onPromptClick(0);
    const asked = component.askedQuestion();

    component.onPromptClick(1);

    expect(component.askedQuestion()).toBe(asked);
    expect(component.state()).toBe('listening');
  });

  it('walks through the exchanges when the core itself is tapped', () => {
    component.onCoreClick();
    expect(component.busy()).toBeTrue();

    // Releasing the lock stands in for the scripted answer finishing.
    component.busy.set(false);
    component.onCoreClick();

    expect(component.state()).toBe('listening');
  });

  it('offers the shared get-app button, which is unavailable until the overlay has a listing', () => {
    const button = fixture.nativeElement.querySelector('.console-actions app-get-app-button');

    expect(button).toBeTruthy();
    expect(button.querySelector('button[aria-disabled="true"]')?.textContent).toContain('Coming soon');
    expect(button.querySelector('a')).toBeNull();
  });

  it('labels Jarvis as Premium and makes no rank or free claim', () => {
    const element: HTMLElement = fixture.nativeElement;
    const copy = (element.querySelector('.console-copy') as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

    expect(element.querySelector('.eyebrow .premium')?.textContent?.trim()).toBe('Premium');
    expect(element.querySelector('.lead')?.textContent).toContain('Premium');
    expect(copy).not.toMatch(/\branks?\b|twelve|free|Grandmaster/i);
  });

  it('names Alt+V as the push-to-talk binding, matching the overlay', () => {
    const lead = fixture.nativeElement.querySelector('.lead').textContent.replace(/\s+/g, ' ');

    expect(lead).toContain('Alt');
    expect(lead).toContain('V');
    expect(lead).toContain('scripted');
  });
});
