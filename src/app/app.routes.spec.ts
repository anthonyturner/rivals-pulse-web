import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';
import { adminGuard } from './core/auth/admin.guard';
import { signedInGuard } from './core/auth/signed-in.guard';
import { ROUTE_DESCRIPTION_KEY, ROUTE_NOINDEX } from './core/seo/page-meta-title.strategy';
import { FAIR_PLAY_DESCRIPTION } from './features/fair-play/fair-play-meta';
import { APP_PRIVACY_POLICY_DESCRIPTION } from './features/privacy/app-privacy-policy/app-privacy-policy-meta';
import { OverlayFaqPageComponent } from './features/overlay-faq/overlay-faq-page.component';

describe('FAQ routes', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(routes)],
    });
    router = TestBed.inject(Router);
  });

  for (const [from, to] of [
    ['/faq', '/faq'],
    ['/faq#ban-risk', '/faq#ban-risk'],
    ['/overlay-faq', '/faq'],
    ['/overlay-faq?ref=x#ban-risk', '/faq?ref=x#ban-risk'],
  ]) {
    it(`serves the FAQ page when visiting ${from}`, async () => {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl(from);

      expect(component).toBeInstanceOf(OverlayFaqPageComponent);
      expect(router.url).toBe(to);
    });
  }
});

describe('profile route', () => {
  const profile = routes.find((route) => route.path === 'profile');

  it('is behind the signed-in guard, since the stats are private to the visitor', () => {
    expect(profile?.canActivate).toEqual([signedInGuard]);
  });

  it('has its own title', () => {
    expect(profile?.title).toBe('Your profile | RivalsPulse');
  });
});

describe('admin route', () => {
  const admin = routes.find((route) => route.path === 'admin');

  it('is behind the admin guard and asks not to be indexed', () => {
    expect(admin?.canMatch).toEqual([adminGuard]);
    expect(admin?.data).toEqual(jasmine.objectContaining(ROUTE_NOINDEX));
  });

  it('is the only route, anywhere in the tree (lazy children included), that uses the admin guard or asks not to be indexed', async () => {
    const flagged: string[] = [];
    const visit = async (list: Routes, path: string): Promise<void> => {
      for (const route of list) {
        const here = `${path}/${route.path ?? ''}`;

        if (route.canMatch?.includes(adminGuard) || route.canActivate?.includes(adminGuard)) {
          flagged.push(here);
        }

        if (route.data?.['noindex'] === true) {
          flagged.push(`${here} (noindex)`);
        }

        await visit(route.children ?? [], here);

        if (typeof route.loadChildren === 'function') {
          const loaded = await route.loadChildren();

          await visit(Array.isArray(loaded) ? loaded : [], here);
        }
      }
    };

    await visit(routes, '');

    expect(flagged.sort()).toEqual(['/admin', '/admin (noindex)']);
  });

});

describe('route titles', () => {
  it('ends the Privacy notes tab title in the site name, like the other pages', () => {
    const privacy = routes.find((route) => route.path === 'privacy');

    expect(privacy?.title).toBe('Privacy notes | RivalsPulse');
  });

  it('gives the app privacy policy a tab title in the site name and its own meta description', () => {
    const appPolicy = routes.find((route) => route.path === 'privacy/app');

    expect(appPolicy?.title).toBe('App privacy policy | RivalsPulse');
    expect(appPolicy?.data?.[ROUTE_DESCRIPTION_KEY]).toBe(APP_PRIVACY_POLICY_DESCRIPTION);
  });

  it('gives the Fair play and privacy page a tab title in the site name and its own meta description', () => {
    const fairPlay = routes.find((route) => route.path === 'fair-play');

    expect(fairPlay?.title).toBe('Fair play and privacy | RivalsPulse');
    expect(fairPlay?.data?.[ROUTE_DESCRIPTION_KEY]).toBe(FAIR_PLAY_DESCRIPTION);
  });
});
