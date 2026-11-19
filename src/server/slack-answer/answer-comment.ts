/**
 * The comment the Slack route posts for Tony, and how the answer workflow (`scripts/tony-answer.mjs`)
 * recognises it. Both sides import this file, so the signed footer cannot drift apart.
 */

/** Matches the hidden footer line of a comment posted for Tony from Slack. */
export const SLACK_ANSWER_MARKER_PATTERN = /<!--\s*tony-answer:slack\b[^>]*-->/;

const MAX_TEXT_LENGTH = 4000;

function slackAnswerMarker(slackTs: string): string {
  return `<!-- tony-answer:slack ts=${slackTs} -->`;
}

/** Slack text turned into plain text a GitHub comment can carry without notifying or linking anyone by accident. */
export function plainTextOfSlack(slackText: string): string {
  const plain = slackText
    .replace(/<(https?:\/\/[^>|]+)(?:\|[^>]*)?>/g, '$1')
    .replace(/<mailto:[^>|]*\|([^>]*)>/g, '$1')
    .replace(/<([@#!])[^>|]*\|([^>]*)>/g, (_match, sigil: string, label: string) => (sigil === '!' ? label : `${sigil}${label}`))
    .replace(/<[@#!][^>]*>/g, '(Slack mention)')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
  const unmentioned = plain.replace(/@(?=[A-Za-z0-9_-])/g, '@​');

  return unmentioned.length > MAX_TEXT_LENGTH ? `${unmentioned.slice(0, MAX_TEXT_LENGTH)}\n\n(cut here: the Slack reply was longer)` : unmentioned;
}

/**
 * What Tony said first, so the workflow reads it as his answer, then the hidden footer that carries
 * the Slack message time (the key for telling a retried delivery from a new reply) and a visible line
 * saying where it came from.
 */
export function slackAnswerComment(slackText: string, slackTs: string): string {
  return `${plainTextOfSlack(slackText)}\n\n${slackAnswerMarker(slackTs)}\n_Answered from Slack._`;
}

/** True when one of the comments is already the answer posted for this Slack reply. */
export function slackAnswerAlreadyPosted(commentBodies: readonly string[], slackTs: string): boolean {
  const marker = slackAnswerMarker(slackTs);

  return commentBodies.some((body) => body.includes(marker));
}
