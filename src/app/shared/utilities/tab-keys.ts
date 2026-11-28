/**
 * The tab a key moves to in a tab strip, or null when the key is not one a tab strip uses.
 * Arrow keys wrap around the ends; Home and End jump to them.
 */
export function tabTargetIndex(key: string, index: number, count: number): number | null {
  const last = count - 1;

  switch (key) {
    case 'ArrowRight':
      return index === last ? 0 : index + 1;
    case 'ArrowLeft':
      return index === 0 ? last : index - 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}
