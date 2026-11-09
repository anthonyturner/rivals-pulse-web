// Heroes the official site lists under ids the official roster does not have.
export const PORTRAIT_ALIASES = {
  deadpool: ['deadpool-duelist', 'deadpool-strategist', 'deadpool-vanguard'],
  hulk: ['bruce-banner'],
};

/**
 * Decides which portrait files a hero still needs.
 *
 * A file the repository already has is never proposed again, which is what keeps
 * the nightly sync from reopening a pull request for portraits master carries.
 * `exists` answers whether a file name is already in the portraits folder.
 */
export function planPortraits(heroes, { exists, force = false }) {
  const missing = [];
  const present = [];

  for (const hero of heroes) {
    const fileNames = [hero.id, ...(PORTRAIT_ALIASES[hero.id] ?? [])].map((id) => `${id}.png`);
    const pending = fileNames.filter((fileName) => force || !exists(fileName));

    if (pending.length === 0) {
      present.push(hero);
    } else {
      missing.push({ hero, fileNames: pending });
    }
  }

  return { missing, present };
}
