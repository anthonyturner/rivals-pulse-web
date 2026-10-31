# Changelog

All notable changes to Rivals Pulse Coach are recorded in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
How to add an entry: [docs/changelog.md](docs/changelog.md).

## [Unreleased]

### Changed

- Learning Paths and Watch Next Quiz now sit at the bottom of the Tools page beside AI Coach as Coming soon cards instead of links, and the beginner and first-time guides point to Hero Guides and Media Tutorials instead ([#220](https://github.com/anthonyturner/rivals-pulse-web/pull/220)).

### Added

- `GET /api/hero-stats?mode=` answers for Quick Match, Competitive, Arcade or Practice on its own, every answer lists the modes on offer with their match counts, and the Community Stats role benchmarks now include Arcade and Practice; without a `mode` the Quick Match and Competitive numbers are unchanged ([#221](https://github.com/anthonyturner/rivals-pulse-web/pull/221)).
- The home page opens with a hero stats snapshot: the five most-picked heroes with their tier, win rate, pick rate and appearances, switchable between All, Vanguard, Duelist and Strategist, from matches Rivals Pulse players recorded; a role without enough data says so, and the old most-used heroes block is gone from the season section ([#212](https://github.com/anthonyturner/rivals-pulse-web/pull/212)).
- A "How we count" page at `/how-we-count`, linked beside the home page hero line and from the Community and tier list pages, says in plain words where the hero numbers come from, what an appearance is, the 10-appearance minimum, that ranks are blended, which modes count, and how half-seasons and the previous half-season standing in work ([#210](https://github.com/anthonyturner/rivals-pulse-web/pull/210)).
- Sharing rivalspulse.com in Discord, X or a search result now shows a title, description and preview image, and each page names its own address as canonical; the preview image is a plain brand card that can later be swapped for a gameplay screenshot ([#207](https://github.com/anthonyturner/rivals-pulse-web/pull/207)).
- A tools row on the home page links straight to the tier list, the team builder and the hero guides ([#206](https://github.com/anthonyturner/rivals-pulse-web/pull/206)).
- The Community Heroes, Tier list and Counters tabs now show a summary from Rivals Pulse uploads: the most-picked and highest-winning heroes, the S and A tiers, and the winning matchups with the clearest edge, each linking to its full page, with "not enough data yet" until enough matches are uploaded ([#198](https://github.com/anthonyturner/rivals-pulse-web/pull/198)).
- `/api/hero-stats` and `/api/hero-matchups` answer "not enough data yet" instead of an error while the database read function is not deployed yet; any other failure still returns an error ([#198](https://github.com/anthonyturner/rivals-pulse-web/pull/198)).
- The Community Stats tab shows what a normal game looks like for each role (Vanguard, Duelist, Strategist): average kills, deaths, assists, KDA, final hits and win rate, for Quick Match and Competitive together or each alone, once a role has 50 lines in a mode, and "not enough data yet" until then ([#192](https://github.com/anthonyturner/rivals-pulse-web/pull/192)).
- `GET /api/hero-matchups` answers how each hero fares against each enemy hero in matches Rivals Pulse players record, for Competitive and Quick Match, from 10 matches per pairing ([#190](https://github.com/anthonyturner/rivals-pulse-web/pull/190)).
- Pulse Atlas now publishes `hero-stats.json`: each hero's win rate, pick rate, KDA and final hits in every half-season, with the matches behind them and an "enough data" flag, built only from Rivals Pulse community matches, so the overlay can read the figures without calling the site ([#145](https://github.com/anthonyturner/rivals-pulse-web/pull/188)).
- A Community page at `/community`, linked from the main menu, with a tab for each Rivals Pulse app screen (Heroes, Matches, Counters, Tier list, Stats and Insights); each tab explains what it will show and says "not enough data yet" until matches are uploaded ([#181](https://github.com/anthonyturner/rivals-pulse-web/pull/181)).
- A privacy notes page at `/privacy`, linked from a new site footer, says which match fields the desktop app uploads (including the damage, healing, damage blocked, time per hero and kill-feed fields being added), that the site publishes only anonymous totals, and how long uploads are kept ([#182](https://github.com/anthonyturner/rivals-pulse-web/pull/182)).
- Each hero page shows its win rate, pick rate, KDA and final hits from matches recorded by Rivals Pulse players, with the number of matches behind them; a hero without enough matches says "Not enough data yet" with its matches so far, and a new half-season shows the previous one, labelled, until it has enough ([#180](https://github.com/anthonyturner/rivals-pulse-web/pull/180)).
- The Pulse Atlas tier list is now the community list, built from the matches Rivals Pulse players upload with one season per half-season, and carries a `rivals-pulse-community` marker so the overlay only shows files made this way; it no longer comes from Rivals Meta ([#166](https://github.com/anthonyturner/rivals-pulse-web/pull/166)).
- Every hero in the Pulse Atlas `heroes.json` now carries the game's numeric hero id as `gameId` (Deadpool also lists his three role ids), so anyone reading the feed can turn a tier-list `heroId` into a hero ([#159](https://github.com/anthonyturner/rivals-pulse-web/pull/159)).
- Pulse Atlas now publishes `hero-styles.json`, a Poke / Dive / Brawl percentage mix for every hero, so the overlay can weight hero pick rates by playstyle; the first 54 weights are drafts for review ([#127](https://github.com/anthonyturner/rivals-pulse-web/pull/127)).
- The Pulse Atlas site has a home page at its root and at `/pulse-atlas/v1/` that says what it is and lists each file with its size and hash, instead of GitHub's 404 ([#118](https://github.com/anthonyturner/rivals-pulse-web/pull/118)).
- A public Pulse Atlas feed of heroes, the tier list (every season and rank), the glossary and maps as JSON on GitHub Pages, refreshed every six hours, so the overlay and other tools can read reference data without the API ([#111](https://github.com/anthonyturner/rivals-pulse-web/pull/111)).
- A Jarvis voice-assistant console on the home page, opened from a new orb in the header, answering sample questions in a scripted demo ([#68](https://github.com/anthonyturner/rivals-pulse-web/pull/68)).
- New heroes reach the hero page within a day of release, through a daily roster sync ([#38](https://github.com/anthonyturner/rivals-pulse-web/pull/38)).
- The home banner plays the latest official season update video, with a spotlight card for that update ([#35](https://github.com/anthonyturner/rivals-pulse-web/pull/35)).
- A clear-filters button on the heroes grid, and a clearer message when no hero matches ([#33](https://github.com/anthonyturner/rivals-pulse-web/pull/33)).
- A featured-content slideshow on the home page, leading with the latest win-rate report ([#29](https://github.com/anthonyturner/rivals-pulse-web/pull/29)).
- Win-rate reports by season and week at `/win-rates/:season`, starting with Season 9 Weeks 1 and 2 and each hero's win rate across all seven ranks; old `/season-9-win-rates` links redirect ([#23](https://github.com/anthonyturner/rivals-pulse-web/pull/23)).
- A Dive Response Planner on the Hero Counters page: pick up to four dive threats and get ranked counter picks and a team response plan ([#18](https://github.com/anthonyturner/rivals-pulse-web/pull/18)).
- Season content on the home page: season updates, highlights, events and the most-picked heroes from the tier list ([#15](https://github.com/anthonyturner/rivals-pulse-web/pull/15)).
- A Triple Support counter guide, a User Highlights page for reviewing community clips, and game stats that compare current and previous player counts and rankings ([#9](https://github.com/anthonyturner/rivals-pulse-web/pull/9), [#13](https://github.com/anthonyturner/rivals-pulse-web/pull/13)).
- A background video on the home page, with play controls ([#9](https://github.com/anthonyturner/rivals-pulse-web/pull/9), [#11](https://github.com/anthonyturner/rivals-pulse-web/pull/11), [#12](https://github.com/anthonyturner/rivals-pulse-web/pull/12)).
- Official hero abilities on the heroes page, synced from the official site ([#5](https://github.com/anthonyturner/rivals-pulse-web/pull/5)).

### Changed

- The home page hero now introduces Rivals Pulse as an Overwolf stats overlay, with a "Get Rivals Pulse on Overwolf" button (shown as "Coming soon" until the app has a store listing), a "See stats" button to the Community page, and a line saying how many matches the site's numbers are counted from ([#208](https://github.com/anthonyturner/rivals-pulse-web/pull/208)).
- The tier list, the home page's most-used heroes and the season dashboard now show numbers from matches that Rivals Pulse players record, each labelled "Based on Rivals Pulse players" with the matches behind it, and say "Not enough data yet" (with progress toward 10 appearances) until a hero has enough; the tier list drops the rank picker and the Ban column, and the season picker lists every half-season that has started. The season glance dates come from the half-season start dates and end with "ongoing" for the current one ([#196](https://github.com/anthonyturner/rivals-pulse-web/pull/196)).
- The Hero Counters page and the Dive Response Planner now come from matches that Rivals Pulse players record: each card shows how often a hero won against another, with the matches behind it, and says "Not enough data yet" until a pairing has 10 matches. A hero page shows the same records in place of its old counters list, below its community stats ([#190](https://github.com/anthonyturner/rivals-pulse-web/pull/190)).
- The win-rate page at `/win-rates` now shows each hero's win rate and appearances from matches that Rivals Pulse players record, for one half-season, with "not enough data yet" until a hero has 10 appearances and a plain empty state while no matches are counted. It drops the rank breakdowns, because Rivals Pulse has no rank data, and old season addresses such as `/win-rates/9` now say the page shows only the current half-season instead of showing a Season 9 report ([#167](https://github.com/anthonyturner/rivals-pulse-web/pull/167)).
- The Pulse Atlas tier list no longer names or links Rivals Meta, so the overlay can bundle the file without naming that site ([#138](https://github.com/anthonyturner/rivals-pulse-web/pull/138)).
- The Pulse Atlas tier list is now about 90 KB instead of 3 MB: hero rows keep only the hero id and the numbers, and `tier-list.json` holds the current season and an index, and every season has its own file under `tier-list/seasons/`, so the overlay downloads a past season only when a player picks it ([#133](https://github.com/anthonyturner/rivals-pulse-web/pull/133)).
- A new hero without a playstyle rating no longer stops the Pulse Atlas feed: the tier list and hero data keep refreshing and the hero is simply left out of `hero-styles.json`, with a warning on the run ([#129](https://github.com/anthonyturner/rivals-pulse-web/pull/129)).
- The app is now branded Rivals Pulse ([#31](https://github.com/anthonyturner/rivals-pulse-web/pull/31)).
- Hero guidance reads as one Playstyle article instead of three overlapping sections ([#20](https://github.com/anthonyturner/rivals-pulse-web/pull/20)).
- Home page news, patch notes, events and rewards now update from official sources instead of fixed text, and the most-used hero cards are sharper and more compact ([#16](https://github.com/anthonyturner/rivals-pulse-web/pull/16)).
- Navigation uses new icons ([#9](https://github.com/anthonyturner/rivals-pulse-web/pull/9)).
- Pages fit better on phones, with consistent mobile spacing ([#8](https://github.com/anthonyturner/rivals-pulse-web/pull/8)).
- The heroes page is redesigned, with new hero icons, a hero browser with search and role filters, and a clearer hero detail view ([#6](https://github.com/anthonyturner/rivals-pulse-web/pull/6), [#7](https://github.com/anthonyturner/rivals-pulse-web/pull/7)).
- The site header logo is easier to see ([#3](https://github.com/anthonyturner/rivals-pulse-web/pull/3)).

### Removed

- The Rivals Meta tier-list sync (the six-hourly job, `npm run sync:tier-list`, `/api/sync/tier-list` and `/api/tier-list`) and every page, label and link that named Rivals Meta; `/api/content/status` now reports `communityHeroStats` in place of the tier-list counts ([#196](https://github.com/anthonyturner/rivals-pulse-web/pull/196)).
- The counter picks copied from Rivals Meta, with the script that refreshed them (`npm run refresh:counters`) and the hand-written reasons that went with them ([#190](https://github.com/anthonyturner/rivals-pulse-web/pull/190)).
- The Season 9 Week 1 and Week 2 win-rate reports, which were built from YouTube video transcripts, and the win-rate summaries they added to each hero record; the featured slide on the home page now points to the new win-rate page ([#167](https://github.com/anthonyturner/rivals-pulse-web/pull/167)).

### Fixed

- The home page shows the current season again; it had stayed on Season 9 after Season 10 launched ([#38](https://github.com/anthonyturner/rivals-pulse-web/pull/38)).
- Newly released heroes show their official portrait instead of a placeholder ([#38](https://github.com/anthonyturner/rivals-pulse-web/pull/38)).
- Home page content that loads after the page appears now shows up ([#16](https://github.com/anthonyturner/rivals-pulse-web/pull/16)).
