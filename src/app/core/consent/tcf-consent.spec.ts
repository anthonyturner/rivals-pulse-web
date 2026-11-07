import { readConsent } from './tcf-consent';

function tcData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cmpStatus: 'loaded',
    gdprApplies: true,
    eventStatus: 'useractioncomplete',
    purpose: { consents: { '1': true } },
    vendor: { consents: { '755': true } },
    ...overrides,
  };
}

describe('readConsent', () => {
  it('grants when the visitor agreed to storage and to Google', () => {
    expect(readConsent(tcData(), true)).toEqual({ status: 'granted', regulated: true });
    expect(readConsent(tcData({ eventStatus: 'tcloaded' }), true)).toEqual({ status: 'granted', regulated: true });
  });

  it('declines when the visitor chose Do not consent', () => {
    const declined = tcData({ purpose: { consents: {} }, vendor: { consents: {} } });

    expect(readConsent(declined, true)).toEqual({ status: 'declined', regulated: true });
  });

  it('declines when only one of storage and Google was agreed to', () => {
    expect(readConsent(tcData({ vendor: { consents: {} } }), true).status).toBe('declined');
    expect(readConsent(tcData({ purpose: { consents: { '1': false } } }), true).status).toBe('declined');
  });

  it('waits while the message is on screen', () => {
    expect(readConsent(tcData({ eventStatus: 'cmpuishown' }), true)).toEqual({ status: 'pending', regulated: true });
  });

  it('needs no consent where the regulation does not apply', () => {
    expect(readConsent({ cmpStatus: 'loaded', gdprApplies: false, eventStatus: 'tcloaded' }, true)).toEqual({
      status: 'granted',
      regulated: false,
    });
  });

  it('waives storage consent for Switzerland only when Google still has consent', () => {
    const swiss = tcData({ purpose: { consents: {} }, purposeOneTreatment: true, publisherCC: 'CH' });

    expect(readConsent(swiss, true).status).toBe('granted');
    expect(readConsent({ ...swiss, publisherCC: 'DE' }, true).status).toBe('declined');
    expect(readConsent({ ...swiss, vendor: { consents: {} } }, true).status).toBe('declined');
  });

  it('never reads an answer it cannot understand as consent', () => {
    expect(readConsent(undefined, true).status).toBe('pending');
    expect(readConsent('consent', true).status).toBe('pending');
    expect(readConsent(tcData(), false).status).toBe('pending');
    expect(readConsent(tcData({ gdprApplies: undefined }), true).status).toBe('pending');
    expect(readConsent(tcData({ cmpStatus: 'error' }), true).status).toBe('declined');
    expect(readConsent(tcData({ purpose: 'yes', vendor: null }), true).status).toBe('declined');
  });
});
