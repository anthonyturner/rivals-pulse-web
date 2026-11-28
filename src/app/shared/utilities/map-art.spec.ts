import { mapArtPath, mapInitials } from './map-art';

describe('map art', () => {
  it('finds a map by the short name the community answers carry', () => {
    expect(mapArtPath('Central Park')).toBe('/images/maps/empire-of-eternal-night-central-park.webp');
  });

  it('finds a map by the full name with its region', () => {
    expect(mapArtPath('Tokyo 2099: Shin-Shibuya')).toBe('/images/maps/tokyo-2099-shin-shibuya.webp');
  });

  it('ignores letter case and apostrophe style, as the database spells them', () => {
    expect(mapArtPath("Birnin t'challa")).toBe('/images/maps/intergalactic-empire-of-wakanda-birnin-tchalla.webp');
    expect(mapArtPath('Birnin T’Challa')).toBe('/images/maps/intergalactic-empire-of-wakanda-birnin-tchalla.webp');
  });

  it('gives the two Asgard maps that share one picture the same path', () => {
    expect(mapArtPath('Royal Palace')).toBe(mapArtPath('Yggdrasill Path'));
    expect(mapArtPath('Royal Palace')).not.toBeNull();
  });

  it('has no picture for a map it does not know', () => {
    expect(mapArtPath('Atlantis')).toBeNull();
    expect(mapArtPath('')).toBeNull();
  });

  it('stands in for a missing picture with the first letters of the first two words', () => {
    expect(mapInitials('Digital Duel Grounds')).toBe('DD');
    expect(mapInitials('Museum of Contemplation')).toBe('MC');
    expect(mapInitials("Hell's Heaven")).toBe('HH');
    expect(mapInitials('Jeffland')).toBe('J');
    expect(mapInitials('')).toBe('');
  });
});
