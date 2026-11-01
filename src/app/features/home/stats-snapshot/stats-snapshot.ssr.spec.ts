import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';

import { renderOnServer, serverRenderSandbox } from '../../../testing/server-render';
import { StatsSnapshotComponent } from './stats-snapshot.component';

@Component({
  selector: 'app-root',
  imports: [StatsSnapshotComponent],
  template: `<app-stats-snapshot />`,
})
class SsrHostComponent {}

describe('StatsSnapshotComponent server render', () => {
  const sandbox = serverRenderSandbox();

  beforeEach(() => sandbox.enter());
  afterEach(() => sandbox.leave());

  it('renders the heading, the reserved loading panel, the links and the invitation, with no zeros or NaN', async () => {
    const html = await renderOnServer(SsrHostComponent, [provideRouter([]), provideHttpClient()]);

    expect(html).toContain('Hero stats');
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/class="highlight highlight--skeleton"/g)).toHaveSize(3);
    expect(html).not.toContain('Not enough data yet');
    expect(html).toContain('href="/tier-list"');
    expect(html).toContain('Every match played with Rivals Pulse makes these stats sharper.');
    expect(html.match(/NaN|Infinity|undefined|<table|role="tab"|<app-eyebrow/)).toBeNull();
    expect(html.match(/(^|[^\d.])0(\.0)?%/)).toBeNull();
  });
});
