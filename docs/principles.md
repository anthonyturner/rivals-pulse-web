how can i apply principles to my marvel rivals project

Applying principles to your Marvel Rivals companion app is one of the best ways to keep the project from turning into a tangled jungle of code as it grows. Instead of asking, "How should I build this feature?" you ask, "Which of my principles should guide this decision?"

Since I know you're building this in Angular with plans for a Hero API, Hero pages, and a Counter Engine, here are principles I'd recommend.

1. Single Source of Truth

Every piece of data should have one authoritative owner.

For example, your hero data should only exist in one place.

❌ Bad

HeroComponent
- Hero name
- Health
- Abilities

CounterEngine
- Hero name
- Health
- Abilities

Search
- Hero name

Now you have to update three places whenever a hero changes.

✅ Better

Hero API
    ↓
HeroService
    ↓
Everything else

Every page reads from HeroService.

2. Reuse Before Rebuild

If you write something twice, stop and ask if it should become reusable.

Instead of

HeroCardComponent
CounterCardComponent
SearchResultComponent

each having their own hero layout...

Create

HeroCardComponent

and use it everywhere.

3. Data First, UI Second

The UI should display data, not contain business logic.

Instead of

if (hero.role === 'Strategist' &&
    hero.health > 300 &&
    hero.mobility === 'HIGH') {

spread across multiple components...

Move it into your engine.

counterEngine.getRecommendedCounters(hero)

The UI simply displays the results.

4. Make It Easy to Add Heroes

Ask yourself:

"If Marvel adds a new hero tomorrow, how much code changes?"

A good principle is:

Adding a hero should mostly be adding data, not changing code.

Instead of

switch(hero.id) {
    case 'ironman':
    case 'spiderman':
    case 'thor':

Use data.

{
  "id": "thor",
  "role": "Vanguard",
  "abilities": [...]
}

The app becomes future-proof.

5. Keep Logic in One Place

Your Counter Engine should decide everything about counters.

Instead of

Hero Page
Counter Page
Tier List
Search

all calculating counters...

Everything asks

CounterEngine

This becomes your "brain."

6. Design for Expansion

Today:

Counter Engine

Tomorrow:

Counter Engine
Synergy Engine
Draft Assistant
Team Builder
Ban Assistant
Ultimate Tracker

If the engine is modular now, adding these later becomes much easier.

7. Prefer Configuration Over Code

Instead of writing:

if(hero.id === 'deadpool')

Create configuration.

{
  "heroId": "deadpool",
  "weakAgainst": [
    "emma-frost",
    "namor"
  ]
}

Changing balance patches becomes editing JSON rather than changing TypeScript.

8. Build Like an API Consumer

Pretend the frontend didn't know how the backend worked.

Instead of

Component
 ↓
Database

Always go

Component
 ↓
HeroService
 ↓
API

That lets you swap a local JSON file for a real backend later without rewriting the UI.

9. Optimize for Reading

You'll read your code far more often than you'll write it.

Instead of

calc(h, c)

write

calculateCounterScore(hero, counter)

Future you will thank present you.

10. Every Feature Has One Responsibility

For example:

Hero API

Returns hero data.

Counter Engine

Calculates counters.

Search Engine

Finds heroes.

Hero Page

Displays hero information.

Notice none of them overlap much.

What this could look like
Marvel Rivals Companion

├── Hero API
│     Principle:
│     "Hero data lives here."
│
├── Counter Engine
│     Principle:
│     "Only this engine decides counters."
│
├── Hero Pages
│     Principle:
│     "Display data only."
│
├── Search
│     Principle:
│     "Find heroes, don't calculate heroes."
│
├── Tier Lists
│     Principle:
│     "Consume Counter Engine results."
│
└── Future AI
      Principle:
      "Ask existing services instead of duplicating logic."