import { Component } from '@angular/core';

import { renderOnServer, serverRenderSandbox } from '../../../testing/server-render';
import { AdSlotComponent } from './ad-slot.component';
import { AD_PROVIDER, AdProvider } from './ad-slot.types';

@Component({ selector: 'app-script-ad', template: `<p class="script-ad">would load a network script</p>` })
class ScriptAdComponent {}

@Component({
  selector: 'app-root',
  imports: [AdSlotComponent],
  template: `<app-ad-slot slot="rectangle" />`,
})
class SsrHostComponent {}

describe('AdSlotComponent server render', () => {
  const sandbox = serverRenderSandbox();

  beforeEach(() => sandbox.enter());
  afterEach(() => sandbox.leave());

  it('renders the reserved-size box and the house ad, with no script tag', async () => {
    const html = await renderOnServer(SsrHostComponent);

    expect(html).toContain('width: 300px');
    expect(html).toContain('height: 250px');
    expect(html).toContain('RivalsPulse, in your match');
    expect(html).not.toMatch(/<script[\s>](?![^>]*ng-state)(?![^>]*ng-server-context)/);
    expect(html).not.toContain('<ins');
  });

  it('renders only the reserved-size box for a browser-only provider', async () => {
    const provider: AdProvider = { id: 'network', component: ScriptAdComponent, browserOnly: true };
    const html = await renderOnServer(SsrHostComponent, [{ provide: AD_PROVIDER, useValue: provider }]);

    expect(html).toContain('width: 300px');
    expect(html).toContain('height: 250px');
    expect(html).not.toContain('script-ad');
  });
});
