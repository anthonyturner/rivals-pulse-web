# Changelog

All notable changes to Rivals Pulse Coach are recorded in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
How to add an entry: [docs/changelog.md](docs/changelog.md).

## [Unreleased]

### Added

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

- The app is now branded Rivals Pulse ([#31](https://github.com/anthonyturner/rivals-pulse-web/pull/31)).
- Hero guidance reads as one Playstyle article instead of three overlapping sections ([#20](https://github.com/anthonyturner/rivals-pulse-web/pull/20)).
- Home page news, patch notes, events and rewards now update from official sources instead of fixed text, and the most-used hero cards are sharper and more compact ([#16](https://github.com/anthonyturner/rivals-pulse-web/pull/16)).
- Navigation uses new icons ([#9](https://github.com/anthonyturner/rivals-pulse-web/pull/9)).
- Pages fit better on phones, with consistent mobile spacing ([#8](https://github.com/anthonyturner/rivals-pulse-web/pull/8)).
- The heroes page is redesigned, with new hero icons, a hero browser with search and role filters, and a clearer hero detail view ([#6](https://github.com/anthonyturner/rivals-pulse-web/pull/6), [#7](https://github.com/anthonyturner/rivals-pulse-web/pull/7)).
- The site header logo is easier to see ([#3](https://github.com/anthonyturner/rivals-pulse-web/pull/3)).

### Fixed

- The home page shows the current season again; it had stayed on Season 9 after Season 10 launched ([#38](https://github.com/anthonyturner/rivals-pulse-web/pull/38)).
- Newly released heroes show their official portrait instead of a placeholder ([#38](https://github.com/anthonyturner/rivals-pulse-web/pull/38)).
- Home page content that loads after the page appears now shows up ([#16](https://github.com/anthonyturner/rivals-pulse-web/pull/16)).
