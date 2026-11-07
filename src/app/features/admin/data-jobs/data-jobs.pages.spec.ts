import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DATA_JOBS, type DataJobDefinition, type DataJobPage } from '../../../../contracts/admin-data-jobs.model';
import { routes } from '../../../app.routes';
import { SHOW_UNRELEASED_PAGES } from '../../../core/navigation/released-page.guard';
import { NotFoundComponent } from '../../../shared/components/not-found/not-found.component';

/**
 * The pages the Data jobs page tells the owner to look at are real, public pages: each one opens as
 * a visitor would reach it, is not sent back to a "Coming soon" hub, and is not the not-found page.
 */
describe('the pages the data jobs say they feed', () => {
  const jobs: readonly DataJobDefinition[] = DATA_JOBS;
  const byPath = new Map<string, DataJobPage>(jobs.flatMap((job) => job.pages).map((page) => [page.path, page]));
  const pages = [...byPath.values()];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: SHOW_UNRELEASED_PAGES, useValue: false },
      ],
    });
  });

  it('names at least one page', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const page of pages) {
    it(`opens ${page.path} as ${page.name}`, async () => {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl(page.path);

      expect(TestBed.inject(Router).url).toBe(page.path);
      expect(component).not.toBeInstanceOf(NotFoundComponent);
    });
  }
});
