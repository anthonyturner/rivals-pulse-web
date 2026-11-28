# Hero Images Setup Guide

## Overview
The heroes page now displays actual hero images instead of placeholder initials. You need to download character portraits from the [Marvel Rivals Wiki](https://marvel-rivals.fandom.com) and place them in the `/public/heroes/` directory.

## Quick Setup

### Step 1: Create Directory
The `/public/heroes/` directory has already been created. All hero images should be placed here.

### Step 2: Download Hero Images
For each hero below, follow these steps:

1. Visit: `https://marvel-rivals.fandom.com/wiki/[HeroName]`
2. Find the hero's character portrait/image
3. Right-click → **Save Image As...**
4. Save to: `public/heroes/{hero-id}.webp`
   - Example: `public/heroes/adam-warlock.webp`

### Step 3: Image Format
- **Format**: WebP (recommended for performance) or PNG/JPG
- **Size**: Aim for ~100px × 100px for grid thumbnails, ~150px × 150px for detail panel
- **File naming**: Must use the hero ID in kebab-case (lowercase with hyphens)

---

## Hero List (48 Total)

| # | Hero Name | Wiki URL | File Name |
|---|-----------|----------|-----------|
| 1 | Adam Warlock | `/wiki/Adam_Warlock` | `adam-warlock.webp` |
| 2 | Angela | `/wiki/Angela` | `angela.webp` |
| 3 | Black Cat | `/wiki/Black_Cat` | `black-cat.webp` |
| 4 | Black Panther | `/wiki/Black_Panther` | `black-panther.webp` |
| 5 | Black Widow | `/wiki/Black_Widow` | `black-widow.webp` |
| 6 | Blade | `/wiki/Blade` | `blade.webp` |
| 7 | Hulk | `/wiki/Hulk` | `hulk.webp` |
| 8 | Captain America | `/wiki/Captain_America` | `captain-america.webp` |
| 9 | Cloak & Dagger | `/wiki/Cloak_%26_Dagger` | `cloak-and-dagger.webp` |
| 10 | Daredevil | `/wiki/Daredevil` | `daredevil.webp` |
| 11 | Deadpool | `/wiki/Deadpool` | `deadpool.webp` |
| 12 | Devil Dinosaur | `/wiki/Devil_Dinosaur` | `devil-dinosaur.webp` |
| 13 | Doctor Strange | `/wiki/Doctor_Strange` | `doctor-strange.webp` |
| 14 | Elsa Bloodstone | `/wiki/Elsa_Bloodstone` | `elsa-bloodstone.webp` |
| 15 | Emma Frost | `/wiki/Emma_Frost` | `emma-frost.webp` |
| 16 | Gambit | `/wiki/Gambit` | `gambit.webp` |
| 17 | Groot | `/wiki/Groot` | `groot.webp` |
| 18 | Hawkeye | `/wiki/Hawkeye` | `hawkeye.webp` |
| 19 | Hela | `/wiki/Hela` | `hela.webp` |
| 20 | Human Torch | `/wiki/Human_Torch` | `human-torch.webp` |
| 21 | Invisible Woman | `/wiki/Invisible_Woman` | `invisible-woman.webp` |
| 22 | Iron Fist | `/wiki/Iron_Fist` | `iron-fist.webp` |
| 23 | Iron Man | `/wiki/Iron_Man` | `iron-man.webp` |
| 24 | Jeff the Land Shark | `/wiki/Jeff_the_Land_Shark` | `jeff-the-land-shark.webp` |
| 25 | Loki | `/wiki/Loki` | `loki.webp` |
| 26 | Luna Snow | `/wiki/Luna_Snow` | `luna-snow.webp` |
| 27 | Magik | `/wiki/Magik` | `magik.webp` |
| 28 | Magneto | `/wiki/Magneto` | `magneto.webp` |
| 29 | Mantis | `/wiki/Mantis` | `mantis.webp` |
| 30 | Mister Fantastic | `/wiki/Mister_Fantastic` | `mister-fantastic.webp` |
| 31 | Moon Knight | `/wiki/Moon_Knight` | `moon-knight.webp` |
| 32 | Namor | `/wiki/Namor` | `namor.webp` |
| 33 | Peni Parker | `/wiki/Peni_Parker` | `peni-parker.webp` |
| 34 | Phoenix | `/wiki/Phoenix` | `phoenix.webp` |
| 35 | Psylocke | `/wiki/Psylocke` | `psylocke.webp` |
| 36 | Rocket Raccoon | `/wiki/Rocket_Raccoon` | `rocket-raccoon.webp` |
| 37 | Rogue | `/wiki/Rogue` | `rogue.webp` |
| 38 | Scarlet Witch | `/wiki/Scarlet_Witch` | `scarlet-witch.webp` |
| 39 | Spider-Man | `/wiki/Spider-Man` | `spider-man.webp` |
| 40 | Squirrel Girl | `/wiki/Squirrel_Girl` | `squirrel-girl.webp` |
| 41 | Star-Lord | `/wiki/Star-Lord` | `star-lord.webp` |
| 42 | Storm | `/wiki/Storm` | `storm.webp` |
| 43 | The Punisher | `/wiki/The_Punisher` | `the-punisher.webp` |
| 44 | The Thing | `/wiki/The_Thing` | `the-thing.webp` |
| 45 | Thor | `/wiki/Thor` | `thor.webp` |
| 46 | Ultron | `/wiki/Ultron` | `ultron.webp` |
| 47 | Venom | `/wiki/Venom` | `venom.webp` |
| 48 | White Fox | `/wiki/White_Fox` | `white-fox.webp` |
| 49 | Winter Soldier | `/wiki/Winter_Soldier` | `winter-soldier.webp` |
| 50 | Wolverine | `/wiki/Wolverine` | `wolverine.webp` |

---

## Technical Details

### Data Model
The `Hero` interface in [src/app/features/heroes/hero.model.ts](src/app/features/heroes/hero.model.ts) now includes:
```typescript
export interface Hero {
  // ... other properties
  imageUrl: string;  // Path to hero image (e.g., "/heroes/adam-warlock.webp")
}
```

### Mock Data
All heroes in [data/seeds/heroes.mock.json](data/seeds/heroes.mock.json) now have an `imageUrl` field:
```json
{
  "id": "adam-warlock",
  "imageUrl": "/heroes/adam-warlock.webp",
  // ... other properties
}
```

### Component Changes
The [heroes-page.component.html](src/app/features/heroes/heroes-page.component.html) now uses:
- Grid view: `<img class="hero-image" [src]="hero.imageUrl" [alt]="hero.name" />`
- Detail panel: `<img class="hero-image large" [src]="hero.imageUrl" [alt]="hero.name" />`

### CSS Styling
Updated [heroes-page.component.css](src/app/features/heroes/heroes-page.component.css) with:
```css
.hero-image {
  width: 74px;
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
}

.hero-image.large {
  width: 108px;
  height: 108px;
}
```

---

## Verification Checklist

- [ ] All 50 hero images downloaded
- [ ] Images saved in `/public/heroes/` directory
- [ ] File names match hero IDs exactly (e.g., `adam-warlock.webp`)
- [ ] Images display in browser at `http://localhost:4200/heroes`
- [ ] Grid thumbnails display correctly (74×74px)
- [ ] Detail panel images display correctly (108×108px)
- [ ] Images load without console errors

---

## Troubleshooting

### Images not showing
1. Check browser DevTools Network tab for 404 errors
2. Verify file names match exactly (case-sensitive on some systems)
3. Clear browser cache and rebuild: `ng build`

### Wrong image displays
1. Verify the hero ID in the mock JSON matches the file name
2. Check that images were saved in the correct directory

### Build errors
1. TypeScript should compile fine after updating the Hero model
2. Run `ng build` to verify no errors
3. Check for any import errors in the component

---

## Notes
- Images will be served from `/public/heroes/` via the Angular dev server
- In production (Vercel), ensure `/public/heroes/` assets are deployed
- Consider optimizing images with ImageMagick or similar if file sizes are large
- WebP format is recommended for performance but PNG/JPG also work
