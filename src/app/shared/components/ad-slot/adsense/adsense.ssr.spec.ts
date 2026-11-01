import { Component } from '@angular/core';

import { renderOnServer, serverRenderSandbox } from '../../../../testing/server-render';
import { AdSlotComponent } from '../ad-slot.component';
import { ADSENSE_CONFIG } from './adsense.config';
import { provideAdSense } from './adsense.provider';

@Component({
  selector: 'app-root',
  imports: [AdSlotComponent],
  template: `<app-ad-slot slot="rectangle" />`,
})
class SsrHostComponent {}

describe('AdSense on the server', () => {
  const sandbox = serverRenderSandbox();

  beforeEach(() => sandbox.enter());
  afterEach(() => sandbox.leave());

  it('renders the house ad, with no ad unit, while no ad unit id is set', async () => {
    const html = await renderOnServer(SsrHostComponent, [provideAdSense()]);

    expect(html).toContain('Coming soon');
    expect(html).not.toContain('adsbygoogle');
  });

  it('renders only the reserved box, with no ad unit, once an ad unit id is set', async () => {
    const config = { publisherId: 'ca-pub-1', slotIds: { rectangle: '1234567890' } };
    const html = await renderOnServer(SsrHostComponent, [
      { provide: ADSENSE_CONFIG, useValue: config },
      provideAdSense(),
    ]);

    expect(html).toContain('width: 300px');
    expect(html).toContain('height: 250px');
    expect(html).not.toContain('<ins');
    expect(html).not.toContain('adsbygoogle');
    expect(html).not.toContain('1234567890');
  });
});
