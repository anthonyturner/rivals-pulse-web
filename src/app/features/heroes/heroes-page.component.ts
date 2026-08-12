import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  HERO_GUIDES,
  HeroUltimateGuide,
} from '../learning/guides/hero-guides/hero-guide-data';
import { HeroDataService } from './hero-data.service';
import { HeroContentComponent } from './hero-content/hero-content.component';
import { HeroDetailModalComponent } from './hero-detail-modal/hero-detail-modal.component';
import { HeroGridComponent, HeroGridMode, HeroRoleFilter } from './hero-grid/hero-grid.component';
import { HeroPageHeaderComponent } from './hero-page-header/hero-page-header.component';
import {
  buildHeroBuildProfileRationale,
  computeHeroBuildProfile,
  heroBuildTypes,
  HeroBuildType,
} from './hero-build-profile';
import {
  Hero,
  HeroAbility,
  HeroAbilityTechnicalDetail,
  HeroBuildProfileRationale,
  HeroPlaystyleGuide,
  HeroRole,
  HeroRoleAbilityKit,
  HeroStrategyGuide,
  HeroVideo,
  HeroVideoType,
} from './hero.model';

import { slugify, escapeRegExp } from '../../shared/utilities/string-utils';

interface HeroVideoSearch {
  label: string;
  query: string;
  url: string;
  embedUrl?: SafeResourceUrl;
}

interface UltimateStrategy {
  ability: HeroAbility;
  sourceDescription: string;
  strategy: string;
}

interface DeadpoolUpgradeStep {
  rank: number | string;
  name: string;
  reason: string;
  note: string;
}

interface DeadpoolUltimatePath extends HeroUltimateGuide {
  timing: string;
  execution: string[];
}

interface DeadpoolAggressivePath {
  id: string;
  title: string;
  summary: string;
  whenToUse: string;
  upgrades: DeadpoolUpgradeStep[];
  transcriptRead: string;
}

interface FandomOverviewSection {
  title: string;
  paragraphs: string[];
}

@Component({
  selector: 'app-heroes-page',
  imports: [
    CommonModule,
    HeroContentComponent,
    HeroDetailModalComponent,
    HeroGridComponent,
    HeroPageHeaderComponent,
  ],
  templateUrl: './heroes-page.component.html',
  styleUrl: './heroes-page.component.css',
})
export class HeroesPageComponent implements OnInit {
  private readonly heroDataService = inject(HeroDataService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly heroes = signal<Hero[]>([]);
  private readonly heroVideos = signal<HeroVideo[]>([]);

  readonly roles: HeroRoleFilter[] = ['All', 'Vanguard', 'Duelist', 'Strategist'];
  readonly selectedRole = signal<HeroRoleFilter>('All');
  readonly heroGridMode = signal<HeroGridMode>('thumbs');
  readonly searchTerm = signal('');
  readonly selectedHeroId = signal(this.heroes()[0]?.id ?? '');
  readonly selectedAbilityKitRole = signal<HeroRole>('Vanguard');
  readonly isHeroDetailModalOpen = signal(false);
  readonly activeAbilityAnchorId = signal('');
  readonly selectedAbilityTabId = signal('');
  readonly activeUltimatePathName = signal('');
  readonly activeAggressivePathId = signal('');
  readonly buildTypes = heroBuildTypes();
  readonly detailsController = this;
  readonly deadpoolUltimatePaths: DeadpoolUltimatePath[] = [
    {
      ...this.tankpoolUltimateGuide('The Ban Hammer / Gun Ultimate'),
      timing:
        'Choose this path when a backline threat, Punisher angle, Phoenix, Angela shift, or enemy Strategist is the fight problem.',
      execution: [
        'Play flanky Tankpool: take an off-angle, force the support line to look at you, then ult the target that cannot ignore the pressure.',
        'Gun ult is the default fight-winning path when you need reliable punishment from range or need to finish a squishy through chaos.',
        'The rank-one review shows gun ult becoming more common on maps with front-to-back fights or into Punisher pressure.',
        'Use Deadpool In Your Area before the commit when possible so the attack-speed window helps surprise the backline.',
      ],
    },
    {
      ...this.tankpoolUltimateGuide('Katana / Sword Ultimate'),
      timing:
        'Choose this path when survival, point stall, or a close-range cleanup matters more than ranged target pressure.',
      execution: [
        'Treat sword ult as a tempo and survival tool: speed plus healing lets you stay alive while the fight turns messy.',
        'Dash before ulting when you can. If the dash connects, the ult refresh gives more total slash/bounce attempts.',
        'Swap to swords quickly when Jeff ult or heavy focus threatens you; surviving the engage can be the whole value.',
        'Use it in small rooms or close scrambles where aiming pistols gets awkward and sword pressure is easier to apply.',
      ],
    },
    {
      ...this.tankpoolUltimateGuide('Magical Unicorn Shield / Plushie Shield'),
      timing:
        'Choose this path when the fight is decided by line of sight, burst denial, or isolating a support from their team.',
      execution: [
        'Drop shield with a specific job: block an ultimate, cut a healing lane, split two supports, or buy one reset beat.',
        'Use it defensively before it is upgraded; the transcript review calls out early bubble usage as punishable when spent too casually.',
        'Bubble between a support and their target, then pressure the isolated side before the shield is shredded.',
        'Do not treat it like permanent cover. It is a short denial window that creates a commit or escape timing.',
      ],
    },
  ];
  readonly deadpoolAggressivePaths: DeadpoolAggressivePath[] = [
    {
      id: 'aggressive-path',
      title: 'Aggressive Path',
      summary:
        'The main Vanguard Deadpool route from the transcript: hit early power spikes, build ultimate fast, and keep constant pressure instead of waiting for perfect moments.',
      whenToUse:
        'Use when your team needs you to force tempo, create early pressure, and turn style points into a fast ultimate cycle.',
      upgrades: [
        {
          rank: 1,
          name: 'Hazardous Hijinks',
          reason:
            'Starts the route with early pressure, six charges, bunny bounce value, movement, and fast style-up ranks.',
          note: 'Use the extra movement to dash in and out, stay on Strategists or exposed targets, and keep momentum rolling while your ultimate is still weaker.',
        },
        {
          rank: 2,
          name: 'Dual Desert Eagles',
          reason:
            'Stabilizes the route with reliable ranged pressure and fast ultimate charge before you hard commit.',
          note: 'Pair upgraded Deagles with Deadpool In Your Area attack speed to spray grouped enemies and build more than half an ultimate safely.',
        },
        {
          rank: 3,
          name: 'The Big Test',
          reason: 'Upgrades the ultimate once the pressure loop is already online.',
          note: 'The stronger activation health and eight-second completed challenge window matter most when you are already in their face.',
        },
        {
          rank: 4,
          name: 'Deadpool In Your Area',
          reason:
            'Locks the aggressive route together with damage reduction, ally protection, attack speed, and sustain during the ultimate window.',
          note: 'Drop it before or during The Big Test challenge completion so damage reduction, healing, bonus health, and faster attacks stack together.',
        },
        {
          rank: 5,
          name: 'Kick@$$ Katana',
          reason:
            'Improves committed melee damage after the core pressure and ultimate engine are online.',
          note: 'Faster swings, crit potential, and more reliable close-range damage help once you are already brawling in their space.',
        },
        {
          rank: 6,
          name: 'Magical Unicorn Shield!',
          reason: 'Adds stronger utility, but it is not the core of the aggressive loop.',
          note: 'Use the larger 400-health shield to block damage, cover a reset, or pressure a Strategist the way the ability section describes.',
        },
        {
          rank: 7,
          name: 'The Ban Hammer',
          reason:
            'Lowest priority in this path because the aggressive Vanguard plan is built around movement, Deagles, ultimate pressure, and sustain.',
          note: 'Still useful in specific situations, but the transcript says it is not the focus for Vanguard play.',
        },
      ],
      transcriptRead:
        'Transcript order: Hazardous Hijinks, Dual Desert Eagles, The Big Test, Deadpool In Your Area, Katana, Unicorn Shield, Ban Hammer.',
    },
    {
      id: 'defense-path',
      title: 'Defense Path',
      summary:
        'The safer defensive route from the transcript: establish ranged pressure, protect the team, then counter-engage when the fight comes to you.',
      whenToUse:
        'Use when you are holding space, defending a lane, peeling for allies, or playing a slower fight where enemies have to walk into you.',
      upgrades: [
        {
          rank: 1,
          name: 'Dual Desert Eagles',
          reason:
            'Starts with safe ranged damage and reliable ultimate charge while you absorb front-line pressure on defense.',
          note: 'Spray grouped enemies with base Deadpool In Your Area to build charge quickly without stepping too far forward.',
        },
        {
          rank: 2,
          name: 'Deadpool In Your Area',
          reason:
            'Becomes the defensive backbone: 40% damage reduction for you and 20% for nearby allies.',
          note: 'Use it to stabilize the front line or peel a dive on your Strategists so the fight has time to flip.',
        },
        {
          rank: 3,
          name: 'Hazardous Hijinks',
          reason:
            'Adds mobility and burst style generation after defensive pressure and ultimate charge are already online.',
          note: 'Use the six charges to finish ultimate, reposition quickly, or punish overextensions without forcing a full commit.',
        },
        {
          rank: 4,
          name: 'The Big Test',
          reason: 'Turns the defensive setup into a counter-engage payoff.',
          note: 'With Deadpool In Your Area already upgraded, you can use the enhanced ultimate with strong survivability and team support.',
        },
        {
          rank: 5,
          name: 'Kick@$$ Katana',
          reason:
            'Improves close-range cleanup and pressure once enemies have committed into your space.',
          note: 'On defense, the transcript frames Katana less as an opener and more as cleanup or close-range pressure.',
        },
        {
          rank: 6,
          name: 'Magical Unicorn Shield!',
          reason: 'Adds more utility for blocking damage, saving teammates, and controlling space.',
          note: 'The 400-health shield is stronger on defense because brief denial windows can preserve the position you are holding.',
        },
        {
          rank: 7,
          name: 'The Ban Hammer',
          reason:
            'Lowest priority because the defensive path mostly uses Katana ultimate and team-stabilizing tools.',
          note: 'The transcript says 90 to 95% of the time this path uses Katana ultimate instead.',
        },
      ],
      transcriptRead:
        'Transcript order: Dual Desert Eagles, Deadpool In Your Area, Hazardous Hijinks, The Big Test, Katana, Unicorn Shield, Ban Hammer.',
    },
  ];
  readonly deadpoolUpgradeOrders: Record<Exclude<HeroRole, 'Multi-Role'>, DeadpoolUpgradeStep[]> = {
    Vanguard: [
      {
        rank: 1,
        name: 'Dual Desert Eagles',
        reason: 'Adds ranged pressure and Boom Emoji explosive value to your baseline weapon loop.',
        note: 'Take after core space tools unless you need safer poke early.',
      },
      {
        rank: 4,
        name: 'Hazardous Hijinks',
        reason: 'Hit-refresh bounce adds engage, chase, and escape options.',
        note: 'Move up on maps with strong vertical routes.',
      },
      {
        rank: 5,
        name: 'Deadpool In Your Area',
        reason:
          'Best early space tool: 12s cooldown, AoE vision disruption, attack speed, and ally damage reduction.',
        note: 'Take first when you need to walk space.',
      },
      {
        rank: 2,
        name: 'Kick@$$ Katana',
        reason: 'Improves close-range brawl pressure and follow-up after Bunny Bounce.',
        note: 'Move up when you are consistently fighting in melee range.',
      },
      {
        rank: 3,
        name: 'Magical Unicorn Shield!',
        reason: 'Adds a 400-health shield on a 12s cooldown for crosses, holds, and resets.',
        note: 'Swap to first if your team is being burst early.',
      },
      {
        rank: 7,
        name: 'The Big Test',
        reason: 'Teamfight swing with bonus health, healing, speed, and challenge payoff.',
        note: 'Best before planned objective fights.',
      },
      {
        rank: 6,
        name: 'The Ban Hammer',
        reason: 'Single-target taunt upgrade with sustain and missed-ability punishment.',
        note: 'Move up into ability-spam matchups.',
      },
    ],
    Duelist: [
      {
        rank: 3,
        name: 'Headshot!',
        reason: 'High-frequency 10s damage tool with repeat throws and third-toss explosion.',
        note: 'Cleanest first pick for poke and picks.',
      },
      {
        rank: 5,
        name: 'Deadpool In Your Area',
        reason: 'Adds AoE disruption, 30/s field damage, self damage reduction, and attack speed.',
        note: 'Move first for tight rooms or objective brawls.',
      },
      {
        rank: 4,
        name: 'Hazardous Hijinks',
        reason: 'Improves chase and resets with two charges and hit refresh.',
        note: 'Take earlier for flank or dive pressure.',
      },
      {
        rank: 7,
        name: 'Pop Quiz!',
        reason: 'Snowballs fights with speed, healing, damage boost, and cooldown refresh.',
        note: 'Best when you reliably complete the challenge.',
      },
      {
        rank: 6,
        name: 'Skill Issue',
        reason: 'Adds 25/s damage over time and Vulnerability stacks to the taunt.',
        note: 'Move up into ability-heavy duelists.',
      },
      {
        rank: 1,
        name: 'Dual Desert Eagles',
        reason: 'Adds ranged poke and Boom Emoji explosive damage to the baseline DPS loop.',
        note: 'Take after core pick tools unless you need safer ranged pressure early.',
      },
      {
        rank: 2,
        name: 'Kick@$$ Katana',
        reason: 'Improves close-range confirm damage and Bunny Hop follow-up pressure.',
        note: 'Move up when you are reliably finishing fights in brawl range.',
      },
    ],
    Strategist: [
      {
        rank: 3,
        name: 'Bouncing Bobblehead',
        reason: 'Repeatable 8s damage and healing with return throws and stronger third toss.',
        note: 'Best first for steady healing between fights.',
      },
      {
        rank: 7,
        name: 'Final Exam',
        reason:
          'Huge teamfight swing: 80/s healing, 120/s completed healing, and 3000 bonus health.',
        note: 'Strong when completion is realistic.',
      },
      {
        rank: 5,
        name: 'Deadpool In Your Area',
        reason: 'Adds 70/s field healing, 30/s field damage, damage boost, and disruption.',
        note: 'Excellent for grouped brawl comps.',
      },
      {
        rank: 4,
        name: 'Healing Hijinks',
        reason: 'Adds 55 healing in an 8m field while keeping dash refresh.',
        note: 'Strong when healing while moving matters.',
      },
      {
        rank: 1,
        name: 'Dual Desert Eagles',
        reason: 'Adds safer ranged damage and healing throughput to your basic pressure loop.',
        note: 'Take after the core support cooldown upgrades.',
      },
      {
        rank: 2,
        name: 'Kick@$$ Katana',
        reason: 'Adds close-range pressure and Healing Hop follow-up value.',
        note: 'Best when you can safely play in brawl range.',
      },
      {
        rank: 6,
        name: 'Pwnage Pound',
        reason: 'Taunt upgrade that turns missed enemy abilities into ally healing.',
        note: 'Move up against heavy dive pressure.',
      },
    ],
  };

  readonly filteredHeroes = computed(() => {
    const role = this.selectedRole();
    const searchTerm = this.searchTerm().trim().toLowerCase();

    return this.heroes().filter((hero) => {
      const matchesRole = role === 'All' || this.heroMatchesRole(hero, role);
      const matchesSearch =
        searchTerm.length === 0 ||
        hero.name.toLowerCase().includes(searchTerm) ||
        hero.summary.toLowerCase().includes(searchTerm) ||
        (hero.gameplayArchetypes ?? []).some((archetype) =>
          `${archetype.label} ${archetype.description}`.toLowerCase().includes(searchTerm),
        ) ||
        hero.strengths.some((strength) => strength.toLowerCase().includes(searchTerm));

      return matchesRole && matchesSearch;
    });
  });

  readonly selectedHero = computed<Hero | undefined>(() => {
    const visibleHeroes = this.filteredHeroes();
    const selectedHero = visibleHeroes.find((hero) => hero.id === this.selectedHeroId());

    // Keep the detail panel populated when filters hide the previously selected hero.
    return selectedHero ?? visibleHeroes[0] ?? this.heroes()[0];
  });

  readonly selectedHeroVideos = computed<HeroVideoSearch[]>(() => {
    const hero = this.selectedHero();

    if (!hero) {
      return [];
    }

    const guide = this.gefestRoleGuide(this.heroRoleLabel(hero));
    const gameplay = this.pazGameplayVideo(hero);
    const countersAndCombos = this.pazCountersCombosVideo(hero);

    return [guide, gameplay, countersAndCombos];
  });

  readonly selectedHeroYoutubeUrl = computed(() =>
    this.youtubeSearchUrl(`Marvel Rivals ${this.selectedHero()?.name ?? ''}`),
  );
  ngOnInit(): void {
    forkJoin({
      heroes: this.heroDataService.getHeroes(),
      heroVideos: this.heroDataService.getHeroVideos(),
    }).subscribe(({ heroes, heroVideos }) => {
      const hydratedHeroes = heroes.map((hero) => ({
        ...hero,
        buildProfile: hero.buildProfile ?? computeHeroBuildProfile(hero),
      }));
      const requestedHeroId = this.route.snapshot.queryParamMap.get('hero') ?? '';
      const initialHero =
        hydratedHeroes.find((hero) => hero.id === requestedHeroId) ?? hydratedHeroes[0];

      this.heroes.set(hydratedHeroes);
      this.heroVideos.set(heroVideos);
      this.selectedHeroId.set(initialHero?.id ?? '');
    });
  }

  selectRole(role: HeroRoleFilter): void {
    this.selectedRole.set(role);
    this.selectedHeroId.set(this.filteredHeroes()[0]?.id ?? '');
    this.selectedAbilityKitRole.set(role === 'All' ? 'Vanguard' : role);
    this.closeHeroDetailModal();
  }

  selectHeroGridMode(mode: HeroGridMode): void {
    this.heroGridMode.set(mode);
  }

  resetHeroFilters(): void {
    this.selectedRole.set('All');
    this.searchTerm.set('');
    this.heroGridMode.set('thumbs');
    this.selectedHeroId.set(this.filteredHeroes()[0]?.id ?? '');
    this.closeHeroDetailModal();
  }

  selectHero(heroId: string): void {
    this.selectedHeroId.set(heroId);
    const role = this.selectedRole();

    if (role !== 'All') {
      this.selectedAbilityKitRole.set(role);
    }
    this.openHeroDetailModal();
  }

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.updateSearchTerm(input.value);
  }

  updateSearchTerm(searchTerm: string): void {
    this.searchTerm.set(searchTerm);
    this.selectedHeroId.set(this.filteredHeroes()[0]?.id ?? '');
    this.closeHeroDetailModal();
  }

  roleClass(role: HeroRole): string {
    return role.toLowerCase();
  }

  gameplayArchetype(hero: Hero): string {
    const selectedRole = this.heroRoleLabel(hero);

    return (
      hero.gameplayArchetypes?.find((archetype) => archetype.role === selectedRole)?.label ??
      hero.gameplayArchetypes?.[0]?.label ??
      ''
    );
  }

  heroInitials(hero: Hero): string {
    return hero.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2);
  }

  selectAbilityKit(role: HeroRole): void {
    this.selectedAbilityKitRole.set(role);
  }

  openHeroDetailModal(): void {
    if (this.selectedHero()) {
      this.isHeroDetailModalOpen.set(true);
    }
  }

  closeHeroDetailModal(): void {
    this.isHeroDetailModalOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeHeroDetailModalOnEscape(): void {
    this.closeHeroDetailModal();
  }

  @HostListener('click', ['$event'])
  handleAbilityLinkClick(event: MouseEvent): void {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-ability-target]');

    if (!link) {
      return;
    }

    event.preventDefault();
    const targetId = link.dataset['abilityTarget'] ?? '';
    this.selectedAbilityTabId.set(targetId);

    window.setTimeout(() => {
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      this.activeAbilityAnchorId.set(targetId);
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }

  roleAbilityKits(hero: Hero): HeroRoleAbilityKit[] {
    return hero.roleAbilityKits ?? [];
  }

  selectedAbilityKit(hero: Hero): HeroRoleAbilityKit | undefined {
    const kits = this.roleAbilityKits(hero);

    return kits.find((kit) => kit.role === this.selectedAbilityKitRole()) ?? kits[0];
  }

  displayedAbilities(hero: Hero): HeroAbility[] {
    return this.selectedAbilityKit(hero)?.abilities ?? hero.abilities;
  }

  activeAbilities(hero: Hero): HeroAbility[] {
    return this.displayedAbilities(hero).filter((ability) => !this.isPassiveAbility(ability));
  }

  passiveAbilities(hero: Hero): HeroAbility[] {
    return this.displayedAbilities(hero).filter((ability) => this.isPassiveAbility(ability));
  }

  teamUpAbilities(hero: Hero): HeroAbility[] {
    const displayedTeamUps = this.displayedAbilities(hero).filter(
      (ability) => ability.type === 'Team-Up Ability',
    );

    if (displayedTeamUps.length > 0) {
      return displayedTeamUps;
    }

    return hero.abilities.filter((ability) => ability.type === 'Team-Up Ability');
  }

  normalAbilities(hero: Hero): HeroAbility[] {
    return this.activeAbilities(hero).filter((ability) => ability.type !== 'Team-Up Ability');
  }

  officialBaseStats(hero: Hero): HeroAbilityTechnicalDetail[] {
    const selectedRole = this.selectedAbilityKit(hero)?.role ?? this.heroRoleLabel(hero);
    const roleKit = hero.officialSource?.baseStatKits?.find((kit) => kit.role === selectedRole);

    return roleKit?.stats ?? hero.officialSource?.baseStats ?? [];
  }

  officialHeroSourceUrl(hero: Hero): string {
    return hero.officialSource?.sourceUrl ?? this.fandomHeroUrl(hero);
  }

  selectedAbilityTab(hero: Hero, abilities: HeroAbility[]): HeroAbility | undefined {
    if (abilities.length === 0) {
      return undefined;
    }

    const selectedId = this.selectedAbilityTabId();

    return (
      abilities.find((ability) => this.abilityAnchorId(hero, ability) === selectedId) ??
      abilities[0]
    );
  }

  selectAbilityTab(hero: Hero, ability: HeroAbility): void {
    this.selectedAbilityTabId.set(this.abilityAnchorId(hero, ability));
    this.activeAbilityAnchorId.set('');
  }

  displayedPlaystyle(hero: Hero): string {
    const kit = this.selectedAbilityKit(hero);
    const guide = this.displayedPlaystyleGuides(hero)[0];

    if (guide) {
      return guide.summary;
    }

    if (kit) {
      return this.buildPlaystyle(hero, kit.role, kit.abilities);
    }

    return hero.playstyle;
  }

  displayedPlaystyleGuides(hero: Hero): HeroPlaystyleGuide[] {
    const role = this.selectedAbilityKit(hero)?.role ?? this.heroRoleLabel(hero);

    return (hero.playstyles ?? []).filter(
      (playstyle) => !playstyle.role || playstyle.role === role,
    );
  }

  ultimateStrategies(hero: Hero): UltimateStrategy[] {
    const abilities = this.displayedAbilities(hero);
    const role = this.selectedAbilityKit(hero)?.role ?? this.heroRoleLabel(hero);
    const hasExplicitUltimate = abilities.some((ability) => this.hasUltimateSignal(ability));
    const ultimate = this.findPrimaryUltimate(abilities, hasExplicitUltimate);

    if (!ultimate) {
      return [];
    }

    return [
      {
        ability: ultimate,
        sourceDescription: this.cleanAbilityDescription(ultimate.description),
        strategy: this.buildUltimateStrategy(hero, role, ultimate),
      },
    ];
  }

  deadpoolUpgradeOrder(hero: Hero): DeadpoolUpgradeStep[] {
    if (hero.id !== 'deadpool') {
      return [];
    }

    const role = this.selectedAbilityKit(hero)?.role;

    if (!role || role === 'Multi-Role') {
      return this.deadpoolUpgradeOrders['Vanguard'];
    }

    return this.deadpoolUpgradeOrders[role];
  }

  deadpoolUpgradeRole(hero: Hero): HeroRole {
    return this.selectedAbilityKit(hero)?.role ?? 'Vanguard';
  }

  deadpoolVanguardAggressivePaths(hero: Hero): DeadpoolAggressivePath[] {
    if (hero.id !== 'deadpool' || this.deadpoolUpgradeRole(hero) !== 'Vanguard') {
      return [];
    }

    return this.deadpoolAggressivePaths;
  }

  activeDeadpoolAggressivePath(hero: Hero): DeadpoolAggressivePath | undefined {
    const paths = this.deadpoolVanguardAggressivePaths(hero);

    if (paths.length === 0) {
      return undefined;
    }

    const selectedId = this.activeAggressivePathId();

    return paths.find((path) => path.id === selectedId) ?? paths[0];
  }

  selectDeadpoolAggressivePath(pathId: string): void {
    this.activeAggressivePathId.set(pathId);
  }

  deadpoolVanguardUltimatePaths(hero: Hero): DeadpoolUltimatePath[] {
    if (hero.id !== 'deadpool' || this.deadpoolUpgradeRole(hero) !== 'Vanguard') {
      return [];
    }

    return this.deadpoolUltimatePaths;
  }

  activeDeadpoolUltimatePath(hero: Hero): DeadpoolUltimatePath | undefined {
    const paths = this.deadpoolVanguardUltimatePaths(hero);

    if (paths.length === 0) {
      return undefined;
    }

    const selectedName = this.activeUltimatePathName();

    return paths.find((path) => path.name === selectedName) ?? paths[0];
  }

  selectDeadpoolUltimatePath(pathName: string): void {
    this.activeUltimatePathName.set(pathName);
  }

  highlightedAbilityText(hero: Hero, text: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      this.highlightCombatTerms(this.linkAbilityText(hero, text)),
    );
  }

  highlightedOverviewText(hero: Hero, text: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.linkAbilityText(hero, text));
  }

  private linkAbilityText(hero: Hero, text: string): string {
    const abilities = [...this.displayedAbilities(hero)].sort(
      (a, b) => b.name.length - a.name.length,
    );
    const html = this.escapeHtml(text);
    let linkedHtml = html;

    if (abilities.length > 0) {
      const abilityLookup = new Map(
        abilities.map((ability) => [this.escapeHtml(ability.name).toLowerCase(), ability]),
      );
      const names = abilities.map((ability) => escapeRegExp(this.escapeHtml(ability.name)));
      const pattern = new RegExp(`(^|[^a-zA-Z0-9])(${names.join('|')})(?=[^a-zA-Z0-9]|$)`, 'gi');

      linkedHtml = html.replace(pattern, (match, prefix: string, abilityName: string) => {
        const ability = abilityLookup.get(abilityName.toLowerCase());

        if (!ability) {
          return match;
        }

        const anchor = this.abilityAnchorId(hero, ability);

        return `${prefix}<a class="ability-text-link" href="#${anchor}" data-ability-target="${anchor}">${abilityName}</a>`;
      });
    }

    return linkedHtml;
  }

  abilityAnchorId(hero: Hero, ability: HeroAbility): string {
    return `ability-${hero.id}-${slugify(ability.name)}`;
  }

  technicalDetailType(label: string): string {
    const normalized = label.toLowerCase();

    if (
      /boost|buff|debuff|vulnerability|damage reduction|movement|speed|slow|stun|knock|launch|pull|root|blind|reveal|scan|purify|cleanse/.test(
        normalized,
      )
    ) {
      return 'utility';
    }

    if (/damage|critical|vulnerability|boost/.test(normalized)) {
      return 'damage';
    }

    if (/cooldown|recharge|interval|rate/.test(normalized)) {
      return 'cooldown';
    }

    if (/duration|time/.test(normalized)) {
      return 'duration';
    }

    if (/heal|health|bonus health/.test(normalized)) {
      return 'healing';
    }

    if (/range|radius|distance|field|width|height/.test(normalized)) {
      return 'range';
    }

    if (/speed|movement|dash|projectile/.test(normalized)) {
      return 'speed';
    }

    if (/ammo|charge|energy|cost/.test(normalized)) {
      return 'resource';
    }

    return 'stat';
  }

  technicalDetailIcon(label: string): string {
    const iconClasses: Record<string, string> = {
      damage: '/icons/fontawesome/solid/burst.svg',
      cooldown: '/icons/fontawesome/solid/clock-rotate-left.svg',
      duration: '/icons/fontawesome/regular/hourglass-half.svg',
      healing: '/icons/fontawesome/solid/heart-pulse.svg',
      utility: '/icons/fontawesome/solid/wand-magic-sparkles.svg',
      range: '/icons/fontawesome/solid/crosshairs.svg',
      speed: '/icons/fontawesome/solid/gauge-high.svg',
      resource: '/icons/fontawesome/solid/battery-half.svg',
      stat: '/icons/fontawesome/solid/chart-simple.svg',
    };

    return iconClasses[this.technicalDetailType(label)] ?? iconClasses['stat'];
  }

  heroRoleLabel(hero: Hero): HeroRole {
    const role = this.selectedRole();

    return role !== 'All' && this.heroMatchesRole(hero, role) ? role : hero.role;
  }

  heroBuildValue(hero: Hero, type: HeroBuildType): number {
    return (hero.buildProfile ?? computeHeroBuildProfile(hero))[type];
  }

  heroBuildProfileRationale(hero: Hero): HeroBuildProfileRationale {
    return hero.buildProfileRationale ?? buildHeroBuildProfileRationale(hero);
  }

  strategyGuide(hero: Hero): HeroStrategyGuide {
    return (
      hero.strategyGuide ?? {
        sourceTitle: `${hero.name} coach strategy`,
        sourceUrl: this.fandomHeroUrl(hero),
        summary: this.displayedPlaystyle(hero),
        paragraphs: [
          this.displayedPlaystyle(hero),
          `${hero.name}'s fight plan should be built around ${
            this.displayedAbilities(hero)
              .slice(0, 2)
              .map((ability) => ability.name)
              .join(' and ') || 'their strongest cooldowns'
          }.`,
        ],
        situations: this.fallbackStrategySituations(hero),
      }
    );
  }

  strategyPlaystyleNotes(hero: Hero, strategy: HeroStrategyGuide): string[] {
    const seen = new Set([this.normalizeStrategyText(this.displayedPlaystyle(hero))]);

    return [strategy.summary, ...strategy.paragraphs].filter((paragraph) => {
      const normalized = this.normalizeStrategyText(paragraph);

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  fandomOverviewSections(hero: Hero): FandomOverviewSection[] {
    const overview = (hero.overview ?? hero.summary).trim();
    const headingPattern =
      /\b(Strengths|Weaknesses|Abilities|Tips|Strategy|Trivia|Lore|Overview)\s*:/g;
    const matches = [...overview.matchAll(headingPattern)];

    if (matches.length === 0) {
      return [
        {
          title: 'Overview',
          paragraphs: this.fandomOverviewParagraphs(hero, overview),
        },
      ];
    }

    return matches
      .map((match, index) => {
        const title = match[1];
        const bodyStart = (match.index ?? 0) + match[0].length;
        const bodyEnd = matches[index + 1]?.index ?? overview.length;
        const body = overview.slice(bodyStart, bodyEnd).trim();

        return {
          title,
          paragraphs: this.fandomOverviewParagraphs(hero, body),
        };
      })
      .filter((section) => section.paragraphs.length > 0);
  }

  fandomHeroUrl(hero: Hero): string {
    return `https://marvelrivals.fandom.com/wiki/${encodeURIComponent(hero.name.replaceAll(' ', '_'))}`;
  }

  heroByName(name: string): Hero | undefined {
    const normalizedName = this.normalizeHeroName(name);

    return this.heroes().find((hero) => this.normalizeHeroName(hero.name) === normalizedName);
  }

  synergyIcon(synergy: string): string {
    const normalized = synergy.toLowerCase();

    if (/heal|support|sustain|strategist|restore/.test(normalized)) {
      return '/icons/fontawesome/solid/heart-pulse.svg';
    }

    if (/shield|barrier|protect|vanguard|tank|frontline/.test(normalized)) {
      return '/icons/fontawesome/solid/shield-halved.svg';
    }

    if (/damage|duelist|burst|pressure|poke|finisher/.test(normalized)) {
      return '/icons/fontawesome/solid/burst.svg';
    }

    if (/dive|mobile|mobility|flank|speed|rotation/.test(normalized)) {
      return '/icons/fontawesome/solid/person-running.svg';
    }

    if (/control|stun|slow|root|trap|zone|setup/.test(normalized)) {
      return '/icons/fontawesome/solid/crosshairs.svg';
    }

    if (/ultimate|combo|team-up|team up/.test(normalized)) {
      return '/icons/fontawesome/solid/star.svg';
    }

    return '/icons/fontawesome/solid/handshake-angle.svg';
  }

  scoreTone(value: number, max = 10): string {
    const ratio = max > 0 ? value / max : 0;

    if (ratio >= 0.7) {
      return 'score-high';
    }

    if (ratio >= 0.4) {
      return 'score-mid';
    }

    return 'score-low';
  }

  private heroMatchesRole(hero: Hero, role: HeroRole): boolean {
    return hero.role === role || this.roleAbilityKits(hero).some((kit) => kit.role === role);
  }

  private tankpoolUltimateGuide(name: string): HeroUltimateGuide {
    const guide = HERO_GUIDES.find(
      (heroGuide) => heroGuide.heroId === 'deadpool' && heroGuide.role === 'Vanguard',
    );
    const ultimate = guide?.ultimates.find((path) => path.name === name);

    return (
      ultimate ?? {
        name,
        plan: 'Use this path when its fight job solves the current enemy pressure.',
        goodAgainst: [],
        avoidInto: [],
      }
    );
  }

  private normalizeHeroName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private isPassiveAbility(ability: HeroAbility): boolean {
    return ability.type === 'Passive';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private highlightCombatTerms(html: string): string {
    const termPattern =
      /\b(damage reduction|movement boost|attack speed|speed boost|knock back|launch up|damage over time|bonus damage|bonus health|life steal|damage|damaging|damages|damaged|burst|critical|crit|headshot|explosion|explode|detonate|vulnerability|heal|heals|healing|healed|restore|restores|restoring|regenerate|regeneration|recovery|recover|lifesteal|overhealth|utility|boost|boosts|boosted|buff|debuff|slow|stun|knockback|launch|root|blind|reveal|scan|purify|cleanse|shield|barrier|protect|invincibility|unstoppable)\b/gi;

    return html
      .split(/(<[^>]+>)/g)
      .map((part) => {
        if (part.startsWith('<')) {
          return part;
        }

        return part.replace(termPattern, (match) => {
          const className = this.combatHighlightClass(match);

          return `<span class="combat-highlight ${className}">${match}</span>`;
        });
      })
      .join('');
  }

  private combatHighlightClass(term: string): string {
    const normalized = term.toLowerCase();

    if (
      /heal|restore|regenerate|recovery|recover|lifesteal|life steal|bonus health|overhealth/.test(
        normalized,
      )
    ) {
      return 'healing-highlight';
    }

    if (
      /utility|boost|buff|debuff|damage reduction|attack speed|speed boost|movement boost|slow|stun|knock|launch|root|blind|reveal|scan|purify|cleanse|shield|barrier|protect|invincibility|unstoppable/.test(
        normalized,
      )
    ) {
      return 'utility-highlight';
    }

    return 'damage-highlight';
  }

  private fallbackStrategySituations(hero: Hero): HeroStrategyGuide['situations'] {
    switch (this.heroRoleLabel(hero)) {
      case 'Vanguard':
        return [
          {
            label: 'Bait cooldowns',
            description:
              'Show pressure, draw defensive tools or crowd control, then reset before the enemy can punish.',
          },
          {
            label: 'Take space',
            description:
              'Move first when teammates can follow so your pressure turns into a real team angle.',
          },
        ];
      case 'Duelist':
        return [
          {
            label: 'Finish windows',
            description: 'Commit after enemy mobility, shields, or sustain tools are unavailable.',
          },
          {
            label: 'Split attention',
            description:
              'Use off-angles to make the enemy look away from your frontline without taking a losing isolated duel.',
          },
        ];
      case 'Strategist':
        return [
          {
            label: 'Peel and stabilize',
            description:
              'Hold key utility for the enemy engage and keep line of sight on teammates under pressure.',
          },
          {
            label: 'Resource pacing',
            description: 'Spend burst healing or defensive tools when damage actually lands.',
          },
        ];
      default:
        return [
          {
            label: 'Choose the job',
            description:
              'Decide whether the fight needs engage, peel, damage, or sustain before committing your kit.',
          },
        ];
    }
  }

  private fandomOverviewParagraphs(hero: Hero, text: string): string[] {
    const abilityNames = this.displayedAbilities(hero)
      .map((ability) => ability.name)
      .sort((a, b) => b.length - a.length);

    if (abilityNames.length === 0) {
      return [text.trim()].filter(Boolean);
    }

    const abilityPattern = new RegExp(
      `(^|\\s)(?=(${abilityNames.map((name) => escapeRegExp(name)).join('|')})\\b)`,
      'g',
    );

    return text
      .replace(/\s+\*/g, ' ')
      .replace(abilityPattern, '\n$1')
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  private normalizeStrategyText(value: string): string {
    return value
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase()
      .replace(/[.!?]+$/, '');
  }

  private buildPlaystyle(hero: Hero, role: HeroRole, abilities: HeroAbility[]): string {
    if (hero.id === 'deadpool' && role === 'Vanguard') {
      return 'Force attention, make the enemy team uncomfortable, build style points, and cycle in and out of pressure without exploding.';
    }

    const primary = abilities[0]?.name ?? hero.name;
    const utility =
      abilities.find((ability) => ability.type === 'Ability')?.name ??
      abilities.find((ability) => ability.type !== 'Normal Attack' && ability.type !== 'Ultimate')
        ?.name ??
      abilities[1]?.name ??
      primary;
    const weakness = hero.weaknesses[0]?.replace(/\.$/, '').toLowerCase();

    switch (role) {
      case 'Vanguard':
        return `Anchor space with ${utility}, then use ${primary} to pressure targets that overcommit. Respect ${weakness ?? 'cooldown windows'} before taking extended trades.`;
      case 'Strategist':
        return `Play near cover and keep allies in your line of sight while cycling ${primary} and ${utility}. Save your escape or sustain tools for dive pressure instead of spending them early.`;
      case 'Duelist':
        return `Look for off-angles where ${primary} can pressure exposed targets, then commit with ${utility} after enemy peel is forced. Reset to cover before cooldowns are punished.`;
      default:
        return `Flex your role around the selected kit: use ${primary} for baseline pressure and ${utility} to swing the fight when enemies are already committed.`;
    }
  }

  private findPrimaryUltimate(
    abilities: HeroAbility[],
    hasExplicitUltimate: boolean,
  ): HeroAbility | undefined {
    const explicitUltimate = abilities.find((ability) => /ultimate/i.test(ability.type));

    if (explicitUltimate) {
      return explicitUltimate;
    }

    const energyCostUltimate = abilities.find((ability) => this.hasUltimateSignal(ability));

    if (energyCostUltimate) {
      return energyCostUltimate;
    }

    if (hasExplicitUltimate) {
      return undefined;
    }

    return abilities.find(
      (ability) =>
        ability.type !== 'Normal Attack' &&
        ability.type !== 'Mobility' &&
        ability.type !== 'Team-Up Ability' &&
        ability.type !== 'Passive',
    );
  }

  private hasUltimateSignal(ability: HeroAbility): boolean {
    const technicalDetails = ability.technicalDetails ?? [];

    return (
      /ultimate/i.test(ability.type) ||
      /ultimate/i.test(ability.description) ||
      technicalDetails.some((detail) => /energy cost/i.test(detail.label))
    );
  }

  private buildUltimateStrategy(hero: Hero, role: HeroRole, ability: HeroAbility): string {
    const description = this.cleanAbilityDescription(ability.description);
    const lowerText = `${ability.name} ${description}`.toLowerCase();
    const useCase = this.ultimateUseCaseLine(lowerText, ability.name);
    const timing = this.ultimateTimingLine(role, ability.name);

    return `${timing} ${useCase}`;
  }

  private cleanAbilityDescription(description: string): string {
    return description.replace(/\s+/g, ' ').trim();
  }

  private ultimateTimingLine(role: HeroRole, ultimateName: string): string {
    switch (role) {
      case 'Vanguard':
        return `Use ${ultimateName} as your team crosses space or when enemies commit into your frontline.`;
      case 'Strategist':
        return `Hold ${ultimateName} for the enemy engage, a teammate-saving swing, or the fight your team has already chosen to take.`;
      case 'Duelist':
        return `Look for ${ultimateName} after enemy mobility, shields, or defensive cooldowns are forced.`;
      default:
        return `Use ${ultimateName} only after choosing the role job you need to solve in the fight.`;
    }
  }

  private ultimateUseCaseLine(text: string, ultimateName: string): string {
    if (/revival|revive|resurrect/.test(text)) {
      return 'Stay alive before casting, catch multiple fallen allies in range, then call the re-engage as they return.';
    }

    if (/heal|healing|restore|sustain/.test(text)) {
      return 'Start it as burst damage begins, not after allies are already split, and keep cover close while the sustain value builds.';
    }

    if (/shield|barrier|boundary|aegis|protect/.test(text)) {
      return 'Place it to block the strongest enemy angle so your team can cross, stabilize, or finish a target.';
    }

    if (/stun|disable|prison|snare|taunt|seduction|control/.test(text)) {
      return 'Aim it at committed enemies or priority targets with limited escape routes so your team can collapse immediately.';
    }

    if (/transform|darkchild|goddess|legend|living chi|god of thunder|unleashed/.test(text)) {
      return 'Activate before the hard commit, then spend the empowered window aggressively while keeping one exit path.';
    }

    if (/zone|storm|hurricane|inferno|tsunami|rampage|spin|prison/.test(text)) {
      return 'Use the area pressure to split the enemy team, deny a doorway, or force them off the objective.';
    }

    if (/challenge|jackpot|taunt/.test(text)) {
      return 'Choose a target that must fight you or give space, then commit only when your movement route is planned.';
    }

    if (/damage|explode|blast|cannon|impact|meteor|judgement|erasure/.test(text)) {
      return 'Pair it with an off-angle, teammate crowd control, or a forced defensive cooldown so the burst lands before enemies spread.';
    }

    return `Set up the angle first, confirm your team can follow, then commit while enemy answers are limited.`;
  }

  private youtubeSearchUrl(query: string): string {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  private gefestRoleGuide(role: HeroRole): HeroVideoSearch {
    const roleVideos: Record<HeroRole, { id: string; title: string }> = {
      Vanguard: {
        id: 'TOZZRM5JnSM',
        title: 'How to Carry on Vanguard',
      },
      Duelist: {
        id: '6FGNkCvqhgA',
        title: 'How to Carry on Duelist',
      },
      Strategist: {
        id: 'K9Ce8VTHxuc',
        title: 'How to Carry on Strategist',
      },
      'Multi-Role': {
        id: 'rqxP_tKV2vc',
        title: 'Strategic Cover Usage in Marvel Rivals',
      },
    };
    const video = roleVideos[role];

    return {
      label: role === 'Duelist' ? 'Gefest DPS guide' : `Gefest ${role} guide`,
      query: video.title,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      embedUrl: this.youtubeVideoEmbedUrl(video.id),
    };
  }

  private pazGameplayVideo(hero: Hero): HeroVideoSearch {
    return this.pazVideo(hero, 'paz-gameplay');
  }

  private pazCountersCombosVideo(hero: Hero): HeroVideoSearch {
    return this.pazVideo(hero, 'paz-counters-combos');
  }

  private pazVideo(hero: Hero, videoType: HeroVideoType): HeroVideoSearch {
    const video = this.findHeroVideo(hero, videoType);
    const isHeroSpecific = video?.heroId === hero.id;
    const label =
      videoType === 'paz-gameplay'
        ? isHeroSpecific
          ? 'PAZ hero gameplay'
          : `PAZ ${hero.role} gameplay`
        : isHeroSpecific
          ? 'PAZ counters and combos'
          : `PAZ ${hero.role} counters and combos`;
    const query =
      video?.title ??
      `Marvel Rivals ${hero.name} ${videoType === 'paz-gameplay' ? 'PAZ gameplay' : 'counters combos'}`;

    if (!video) {
      return {
        label,
        query,
        url: this.youtubeSearchUrl(query),
      };
    }

    return {
      label,
      query: video.title,
      url: `https://www.youtube.com/watch?v=${video.youtubeId}`,
      embedUrl: this.youtubeVideoEmbedUrl(video.youtubeId),
    };
  }

  private findHeroVideo(hero: Hero, videoType: HeroVideoType): HeroVideo | undefined {
    const videos = this.heroVideos().filter((video) => video.videoType === videoType);

    return (
      videos.find((video) => video.heroId === hero.id) ??
      videos.find((video) => !video.heroId && video.role === hero.role)
    );
  }

  private youtubeVideoEmbedUrl(videoId: string): SafeResourceUrl {
    const url = `https://www.youtube.com/embed/${videoId}`;

    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
