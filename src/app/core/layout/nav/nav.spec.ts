import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Nav } from './nav';

describe('Nav', () => {
  let component: Nav;
  let fixture: ComponentFixture<Nav>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Nav],
      // The app runs zoneless, and the core orb is a router link.
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Nav);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers the core orb as a labelled link to the console', () => {
    const orb = fixture.nativeElement.querySelector('.core-orb') as HTMLAnchorElement | null;

    expect(orb).withContext('the nav renders a core orb').toBeTruthy();
    expect(orb?.getAttribute('aria-label')).toContain('Jarvis console');
    expect(orb?.getAttribute('href')).toContain('jarvis-console');
  });

  it('closes the menu when the orb is followed', () => {
    component.toggleMenu();
    expect(component.isMenuOpen()).toBeTrue();

    const orb = fixture.nativeElement.querySelector('.core-orb') as HTMLAnchorElement;
    // Cancelable, so the router link can stop the anchor navigating the test runner.
    orb.addEventListener('click', (event: Event) => event.preventDefault());
    orb.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(component.isMenuOpen()).toBeFalse();
  });
});
