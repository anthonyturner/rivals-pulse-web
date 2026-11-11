import policyMarkdown from './app-privacy-policy.md';
import { parsePolicyMarkdown, type PolicyDocument } from './policy-markdown';

/** The desktop app's privacy policy, read from the checked-in copy of the overlay repository's file. `npm run sync:app-privacy-policy` refreshes that copy. */
export const APP_PRIVACY_POLICY: PolicyDocument = parsePolicyMarkdown(policyMarkdown);
