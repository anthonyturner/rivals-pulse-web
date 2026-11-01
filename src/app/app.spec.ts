import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService, SessionState } from './core/auth/auth.service';
import { ROUTE_WITHOUT_SIDEBAR } from './core/layout/sidebar/sidebar-visibility';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application brand', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Rivals Pulse Coach');
  });
});

@Component({ template: '<p>page</p>' })
class PageComponent {}

describe('App sidebar', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', component: PageComponent, data: ROUTE_WITHOUT_SIDEBAR },
          { path: 'heroes', component: PageComponent },
        ]),
        {
          provide: AuthService,
          useValue: { state: signal<SessionState>({ status: 'signedOut' }), load: () => Promise.resolve() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
  });

  async function show(url: string): Promise<HTMLElement> {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the house ad beside every page except home', async () => {
    expect((await show('/heroes')).querySelector('app-sidebar app-ad-slot')).not.toBeNull();
    expect((await show('/')).querySelector('app-sidebar')).toBeNull();
  });

  it('keeps the not-affiliated notice on pages with and without the sidebar', async () => {
    for (const url of ['/', '/heroes']) {
      expect((await show(url)).querySelector('app-footer')?.textContent).toContain(
        'not affiliated with NetEase, Marvel or Overwolf',
      );
    }
  });
});
