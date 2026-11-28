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
    expect(compiled.querySelector('.brand')?.textContent).toContain('RivalsPulse');
  });

  it('shows the logo as a decorative image beside the name, and no tagline', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const brand = (fixture.nativeElement as HTMLElement).querySelector('.brand') as HTMLElement;
    const marks = Array.from(brand.querySelectorAll('img.brand-mark'));

    expect(marks.map((mark) => mark.getAttribute('src'))).toEqual([
      '/images/site/rivals-pulse-logo.svg',
      '/images/site/rivals-pulse-logo-light.svg',
    ]);
    for (const mark of marks) {
      expect(mark.getAttribute('alt')).toBe('');
      expect(mark.getAttribute('width')).toBe('32');
      expect(mark.getAttribute('height')).toBe('32');
    }
    expect(brand.querySelector('.brand-name')?.textContent).toBe('RivalsPulse');
    expect(brand.getAttribute('aria-label')).toBe('RivalsPulse home');
    expect(brand.textContent).not.toContain('Draft smarter');
  });
});

@Component({ template: '<p>page</p>' })
class PageComponent {}

describe('App shell', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', component: PageComponent, data: ROUTE_WITHOUT_SIDEBAR },
          { path: 'heroes', component: PageComponent },
          { path: 'counters', component: PageComponent },
        ]),
        {
          provide: AuthService,
          useValue: { state: signal<SessionState>({ status: 'signedOut' }), load: () => Promise.resolve() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    page = fixture.nativeElement as HTMLElement;
    await router.navigateByUrl('/heroes');
    await fixture.whenStable();
  });

  const main = (): HTMLElement => page.querySelector('main') as HTMLElement;
  const goTo = async (url: string): Promise<void> => {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  };

  it('owns the one main landmark, around the page and not the sidebar', () => {
    expect(page.querySelectorAll('main').length).toBe(1);
    expect(main().id).toBe('main-content');
    expect(main().getAttribute('tabindex')).toBe('-1');
    expect(main().querySelector('p')?.textContent).toBe('page');
    expect(main().contains(page.querySelector('app-sidebar'))).toBeFalse();
    expect(main().contains(page.querySelector('header'))).toBeFalse();
    expect(main().contains(page.querySelector('app-footer'))).toBeFalse();
  });

  it('keeps the one main on a page with no sidebar', async () => {
    await goTo('/');

    expect(page.querySelectorAll('main').length).toBe(1);
  });

  it('makes the skip link the first stop, and sends focus to main without navigating', async () => {
    const link = page.querySelector('a') as HTMLAnchorElement;
    const url = router.url;

    expect(link.textContent?.trim()).toBe('Skip to main content');
    expect(link.classList).toContain('skip-link');
    expect(page.querySelector('header')?.compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    await fixture.whenStable();

    expect(click.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(main());
    expect(router.url).toBe(url);
  });

  it('moves focus to main when the page changes, but not on first load', async () => {
    expect(document.activeElement).not.toBe(main());

    await goTo('/counters');

    expect(document.activeElement).toBe(main());
  });

  it('leaves focus to the router when a link goes to a fragment of another page', async () => {
    const other = document.createElement('input');
    page.appendChild(other);
    other.focus();

    await goTo('/counters#abilities');

    expect(document.activeElement).not.toBe(main());
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it('leaves focus alone for a query or fragment change on the same page', async () => {
    const other = document.createElement('input');
    page.appendChild(other);

    for (const url of ['/heroes?hero=1', '/heroes#abilities']) {
      other.focus();
      await goTo(url);

      expect(document.activeElement).withContext(url).toBe(other);
    }

    other.remove();
  });

  it('labels the footer links and has one banner', () => {
    expect(page.querySelector('app-footer nav')?.getAttribute('aria-label')).toBe('Footer');
    expect(page.querySelectorAll('header').length).toBe(1);
  });
});

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

  it('renders no sidebar before the first navigation resolves, so a full load of home cannot flash one', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('app-sidebar')).toBeNull();
    expect(page.querySelector('.app-body--with-sidebar')).toBeNull();
  });

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
