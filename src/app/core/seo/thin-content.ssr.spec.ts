import { Component } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { provideRouter, RouterOutlet, TitleStrategy } from '@angular/router';

import { renderOnServer, serverRenderSandbox } from '../../testing/server-render';
import { Sidebar } from '../layout/sidebar/sidebar';
import { PageMetaTitleStrategy } from './page-meta-title.strategy';
import { type ContentState, reportContentState } from './thin-content';

let state: ContentState = 'thin';
let robotsTags: string[] = [];

/** The server render sandbox cannot append to a head, so this records the robots tags the strategy asks for. */
class RecordingMeta extends Meta {
  override addTag(tag: { name?: string; content: string }): HTMLMetaElement | null {
    if (tag.name === 'robots') {
      robotsTags.push(tag.content);
    }

    return null;
  }

  override updateTag(): HTMLMetaElement | null {
    return null;
  }
}

@Component({ template: '<p>numbers</p>' })
class DataPage {
  constructor() {
    reportContentState(() => state);
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar],
  template: `<router-outlet /><app-sidebar />`,
})
class SsrHostComponent {}

describe('A page with too little content, rendered on the server', () => {
  const sandbox = serverRenderSandbox();
  const render = (): Promise<string> =>
    renderOnServer(SsrHostComponent, [
      provideRouter([{ path: '', title: 'Data', component: DataPage }]),
      { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
      { provide: Meta, useClass: RecordingMeta },
    ]);

  beforeEach(() => {
    robotsTags = [];
    sandbox.enter();
  });
  afterEach(() => sandbox.leave());

  it('asks for noindex and has no ad in the rendered page', async () => {
    state = 'thin';

    const html = await render();

    expect(robotsTags).toContain('noindex');
    expect(html).not.toContain('app-ad-slot');
  });

  it('asks for no noindex and has the ad once it has enough', async () => {
    state = 'ready';

    const html = await render();

    expect(robotsTags).toEqual([]);
    expect(html).toContain('app-ad-slot');
  });
});
