# Changelog

All notable changes to Rivals Pulse Coach are recorded in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
How to add an entry: [docs/changelog.md](docs/changelog.md).

## [Unreleased]

### Added

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

- The Season 9 Week 1 and Week 2 win-rate reports, which were built from YouTube video transcripts, and the win-rate summaries they added to each hero record; the featured slide on the home page now points to the new win-rate page ([#167](https://github.com/anthonyturner/rivals-pulse-web/pull/167)).

### Fixed

- The home page shows the current season again; it had stayed on Season 9 after Season 10 launched ([#38](https://github.com/anthonyturner/rivals-pulse-web/pull/38)).
- Newly released heroes show their official portrait instead of a placeholder ([#38](https://github.com/anthonyturner/rivals-pulse-web/pull/38)).
- Home page content that loads after the page appears now shows up ([#16](https://github.com/anthonyturner/rivals-pulse-web/pull/16)).
