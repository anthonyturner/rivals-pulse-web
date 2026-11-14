import { signal, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Theme, ThemeService } from '../../theme/theme.service';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  const theme = signal<Theme>('dark');
  const toggleTheme = jasmine.createSpy('toggleTheme').and.callFake(() => theme.update((t) => (t === 'dark' ? 'light' : 'dark')));
  let fixture: ComponentFixture<ThemeToggle>;

  const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');

  beforeEach(async () => {
    theme.set('dark');
    toggleTheme.calls.reset();

    await TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ThemeService, useValue: { theme: theme.asReadonly(), toggleTheme } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
  });

  it('is a real button named for the theme it switches to', () => {
    expect(button().type).toBe('button');
    expect(button().getAttribute('aria-label')).toBe('Switch to light theme');
    expect(button().title).toBe('Switch to light theme');
  });

  it('flips the theme on click and renames itself', async () => {
    button().click();
    await fixture.whenStable();

    expect(toggleTheme).toHaveBeenCalledTimes(1);
    expect(button().getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('renders both the sun and the moon, and both labels, so the server HTML is right before the browser runs a script', () => {
    expect(button().querySelectorAll('.theme-toggle__icon > span').length).toBe(2);
    expect(button().querySelector('.theme-toggle__text .to-light')?.textContent).toBe('Light theme');
    expect(button().querySelector('.theme-toggle__text .to-dark')?.textContent).toBe('Dark theme');
  });

  it('hides its icon from assistive technology', () => {
    expect(button().querySelector('.theme-toggle__icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
