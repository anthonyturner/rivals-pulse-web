import { DATA_JOBS, type DataJobDefinition } from './admin-data-jobs.model';

describe('DATA_JOBS', () => {
  const jobs: readonly DataJobDefinition[] = DATA_JOBS;

  for (const job of jobs) {
    describe(job.key, () => {
      it('says in words what it updates and gives one example', () => {
        expect(job.updates.trim()).not.toBe('');
        expect(job.example.trim()).not.toBe('');
      });

      it('either feeds something a person can open or says why nothing shows it', () => {
        const feedsSomething = job.pages.length > 0 || job.atlasFiles.length > 0;

        expect(feedsSomething || (job.caveat ?? '').trim() !== '').toBeTrue();
      });
    });
  }

  it('links only to addresses on the site, each with the name and section that changes', () => {
    const pages = jobs.flatMap((job) => job.pages);

    expect(pages.length).toBeGreaterThan(0);

    for (const page of pages) {
      expect(page.path).toMatch(/^\/[a-z0-9\-/]*$/);
      expect(page.name.trim()).not.toBe('');
      expect(page.section.trim()).not.toBe('');
    }
  });

  it('lists no page twice for the same job', () => {
    for (const job of jobs) {
      const seen = job.pages.map((page) => `${page.path} ${page.section}`);

      expect(new Set(seen).size).withContext(job.key).toBe(seen.length);
    }
  });
});
