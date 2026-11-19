/** Whether the visitor has agreed to what showing a Google ad needs. */
export type ConsentStatus = 'pending' | 'granted' | 'declined';

export interface ConsentReading {
  readonly status: ConsentStatus;
  /** True when Google's consent message applies to this visitor (EEA, UK, Switzerland), so they can be offered a way to change their choice. */
  readonly regulated: boolean;
}

export const CONSENT_PENDING: ConsentReading = { status: 'pending', regulated: false };
export const CONSENT_NOT_REQUIRED: ConsentReading = { status: 'granted', regulated: false };

/** Google's id in the IAB vendor list, the party an AdSense ad request is sent to. */
const GOOGLE_VENDOR_ID = '755';
const STORE_AND_ACCESS_PURPOSE_ID = '1';

/**
 * Reads the answer of the IAB Transparency and Consent Framework API (`__tcfapi`), which Google's
 * consent message provides. It applies the same test Google's own AdSense loader uses before it
 * touches device storage: the visitor consented to purpose 1 (store and access information on a
 * device) and to Google as a vendor. Switzerland is the one place that test waives purpose 1.
 *
 * Anything this cannot read leaves the visitor `pending`, which shows the house ad: a missing
 * answer is never taken as consent.
 */
export function readConsent(data: unknown, success: boolean): ConsentReading {
  if (!success || !isRecord(data)) {
    return CONSENT_PENDING;
  }

  if (data['cmpStatus'] === 'error') {
    return { status: 'declined', regulated: false };
  }

  if (data['gdprApplies'] === false) {
    return CONSENT_NOT_REQUIRED;
  }

  if (data['gdprApplies'] !== true) {
    return CONSENT_PENDING;
  }

  const decided = data['eventStatus'] === 'tcloaded' || data['eventStatus'] === 'useractioncomplete';

  return { status: decided ? (consentsToGoogleAds(data) ? 'granted' : 'declined') : 'pending', regulated: true };
}

function consentsToGoogleAds(data: Record<string, unknown>): boolean {
  const swissException = data['purposeOneTreatment'] === true && data['publisherCC'] === 'CH';

  return (
    consented(data['vendor'], GOOGLE_VENDOR_ID) &&
    (swissException || consented(data['purpose'], STORE_AND_ACCESS_PURPOSE_ID))
  );
}

function consented(group: unknown, id: string): boolean {
  return isRecord(group) && isRecord(group['consents']) && group['consents'][id] === true;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
