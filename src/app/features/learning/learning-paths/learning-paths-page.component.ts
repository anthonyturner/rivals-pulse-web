import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

type PathAudience = 'All' | 'Starter' | 'Vanguard' | 'Duelist' | 'Strategist' | 'Mindset' | 'Review';

interface LessonStep {
  title: string;
  focus: string;
  mediaUrl: string;
}

interface LearningPath {
  id: string;
  audience: Exclude<PathAudience, 'All'>;
  title: string;
  summary: string;
  outcome: string;
  duration: string;
  image: string;
  steps: LessonStep[];
}

interface PracticeDrill {
  id: string;
  category: Exclude<PathAudience, 'All'>;
  title: string;
  goal: string;
  setup: string;
  reps: string;
  review: string;
}

@Component({
  selector: 'app-learning-paths-page',
  imports: [CommonModule],
  templateUrl: './learning-paths-page.component.html',
  styleUrl: './learning-paths-page.component.css',
})
export class LearningPathsPageComponent {
  readonly audiences: PathAudience[] = [
    'All',
    'Starter',
    'Vanguard',
    'Duelist',
    'Strategist',
    'Mindset',
    'Review',
  ];

  readonly selectedAudience = signal<PathAudience>('All');
  readonly searchTerm = signal('');

  readonly paths: LearningPath[] = [
    {
      id: 'starter',
      audience: 'Starter',
      title: 'New to Marvel Rivals Fundamentals',
      summary: 'Start with the concepts that decide most fights: cover, high ground, rotations, timing, and target choice.',
      outcome: 'You should finish with a simple pre-fight routine: find cover, choose lane, time engage, name target, reset.',
      duration: '5 lessons',
      image: '/images/heroes/captain-america.png',
      steps: [
        {
          title: 'Strategic Cover Usage',
          focus: 'Make cover your default state before damage trading.',
          mediaUrl: 'https://youtu.be/rqxP_tKV2vc?si=9K2auPgj1OXjaD2y',
        },
        {
          title: 'High Ground Discipline',
          focus: 'Use height to choose fights, not to overstay.',
          mediaUrl: 'https://youtu.be/_PdmvN0s0ew?si=E8lcu1rTkWXSU3mi',
        },
        {
          title: 'Non-linear Rotations',
          focus: 'Take routes that change enemy attention.',
          mediaUrl: 'https://youtu.be/oAdjNFeiOrQ?si=ZQxCLxHa_fukSotJ',
        },
        {
          title: 'Timing in Marvel Rivals',
          focus: 'Enter when your team pressure can overlap.',
          mediaUrl: 'https://youtu.be/yftUQIsApMI?si=BkzIi2ynIWqEiaOD',
        },
        {
          title: 'Target Priority',
          focus: 'Attack isolated or resource-light enemies.',
          mediaUrl: 'https://youtu.be/HoiwKJLR_tA?si=_oS8swCV9MkR7aOt',
        },
      ],
    },
    {
      id: 'vanguard',
      audience: 'Vanguard',
      title: 'Vanguard Space Control Track',
      summary: 'A role path for players who need to stop standing on point and start deciding where the fight happens.',
      outcome: 'You should be able to spend cooldowns to create or hold space instead of reacting after it is gone.',
      duration: '4 lessons',
      image: '/images/heroes/magneto.png',
      steps: [
        {
          title: 'How to Carry on Vanguard',
          focus: 'Define useful space and take it with a plan.',
          mediaUrl: 'https://youtu.be/TOZZRM5JnSM?si=ODAVv83RtZxvguXr',
        },
        {
          title: 'Power Positions',
          focus: 'Anchor positions that pressure multiple lanes.',
          mediaUrl: 'https://youtu.be/FmfiDOyZmrQ?si=b8gXQdcpU1Y2vqfF',
        },
        {
          title: 'Magneto Positioning',
          focus: 'Avoid passive point play and hold a useful angle.',
          mediaUrl: 'https://youtu.be/9Whi3bO36Mk?si=_FtR2RxrzaCP9O8C',
        },
        {
          title: 'Killboxes',
          focus: 'Force enemies into overlapping pressure.',
          mediaUrl: 'https://youtu.be/9bp0D7R9zbg?si=flVjnb_HF0puZU-3',
        },
      ],
    },
    {
      id: 'duelist',
      audience: 'Duelist',
      title: 'Duelist Setup and Threat Track',
      summary: 'A path for turning raw mechanics into pressure through scouting, off-angles, timing, and target priority.',
      outcome: 'You should create threat before committing, then burst when the enemy is already split or distracted.',
      duration: '4 lessons',
      image: '/images/heroes/star-lord.png',
      steps: [
        {
          title: 'How to Carry on Duelist',
          focus: 'Build threat before chasing eliminations.',
          mediaUrl: 'https://youtu.be/6FGNkCvqhgA?si=FSi0vTdUwu3O86xG',
        },
        {
          title: 'Star-Lord Setup',
          focus: 'Scout and setup before the fight opens.',
          mediaUrl: 'https://youtu.be/YX2xq2RXV7o?si=1SxRqhS7w1LB4B6E',
        },
        {
          title: 'How to Take Angles',
          focus: 'Pressure from a lane that makes enemies choose.',
          mediaUrl: 'https://www.youtube.com/watch?v=SyYfpEgGLTA',
        },
        {
          title: 'Timing in Marvel Rivals',
          focus: 'Sync burst with your team instead of entering alone.',
          mediaUrl: 'https://youtu.be/yftUQIsApMI?si=BkzIi2ynIWqEiaOD',
        },
      ],
    },
    {
      id: 'strategist',
      audience: 'Strategist',
      title: 'Strategist Proactivity Track',
      summary: 'For supports who want to carry through utility timing, lane support, resource management, and proactive pressure.',
      outcome: 'You should enter each fight knowing the enemy win condition and which cooldown you are saving for it.',
      duration: '5 lessons',
      image: '/images/heroes/invisible-woman.png',
      steps: [
        {
          title: 'How to Carry on Strategist',
          focus: 'Turn resources into pressure, not just emergency healing.',
          mediaUrl: 'https://youtu.be/K9Ce8VTHxuc?si=0HDhL7-D9wkvjCsJ',
        },
        {
          title: 'How to Support Effectively',
          focus: 'Stabilize the right player while keeping useful pressure.',
          mediaUrl: 'https://youtu.be/-iBssvJkLXk?si=TdK-KchPCqEkt_Fb',
        },
        {
          title: 'Jeff Space Control',
          focus: 'Control lanes and tempo through positioning.',
          mediaUrl: 'https://youtu.be/veOh-WKr4Xw?si=_s1DeN9iMPJtgUh7',
        },
        {
          title: 'Rocket Raccoon Angles',
          focus: 'Use mobility and angles to keep uptime safely.',
          mediaUrl: 'https://youtu.be/F8hgSt10t_U?si=yVm3ZIM77CwD9FmX',
        },
        {
          title: 'Resource Management',
          focus: 'Spend cooldowns around enemy threats.',
          mediaUrl: 'https://www.youtube.com/watch?v=7MQjo7Iin3c',
        },
      ],
    },
    {
      id: 'mindset',
      audience: 'Mindset',
      title: 'Ranked Mental Reset Track',
      summary: 'Use the workbook mindset material to reduce autopilot, tilt, and random practice blocks.',
      outcome: 'You should have one focus cue per session and a reset habit after mistakes.',
      duration: '4 lessons',
      image: '/images/heroes/luna-snow.png',
      steps: [
        {
          title: 'Master Consistency',
          focus: 'Build repeatable performance instead of chasing perfect games.',
          mediaUrl: 'https://youtu.be/r-MDhF7li2s?si=R3DnPYsAr2gsA0iH',
        },
        {
          title: 'How to Deal with Tilt',
          focus: 'Recover quickly after frustrating fights.',
          mediaUrl: 'https://youtu.be/3leIrDmkHbs?si=oiLno2-O5oqqg9tT',
        },
        {
          title: 'How to Deal with Autopilot',
          focus: 'Use deliberate cues to stay present in fights.',
          mediaUrl: 'https://youtu.be/HUZttvb4XH4?si=4DvVVJi_s31CE0_7',
        },
        {
          title: 'Effective Practice',
          focus: 'Use interleaved practice and goal-setting.',
          mediaUrl: 'https://www.youtube.com/watch?v=AqUXRb-zglI',
        },
      ],
    },
    {
      id: 'review',
      audience: 'Review',
      title: 'Three-Death VOD Review Track',
      summary: 'A small review loop for finding repeatable issues without turning every VOD into homework.',
      outcome: 'You should identify one recurring decision error and one next-match correction.',
      duration: '3 lessons',
      image: '/images/heroes/rocket-raccoon.png',
      steps: [
        {
          title: 'How to Self-review',
          focus: 'Find the decision that made the death likely.',
          mediaUrl: 'https://youtu.be/qbjD4v91UOk',
        },
        {
          title: 'Community VOD Reviews',
          focus: 'Compare your review notes against coached examples.',
          mediaUrl: 'https://youtu.be/mXBQJ3ttUOA?si=j9LD6_i1xjPfEtAp',
        },
        {
          title: 'Communication Fundamentals',
          focus: 'Turn review findings into clearer fight calls.',
          mediaUrl: 'https://youtu.be/N5wdL40ti5Y?si=_Af0GroU5dt32yu5',
        },
      ],
    },
  ];

  readonly drills: PracticeDrill[] = [
    {
      id: 'cover-before-damage',
      category: 'Starter',
      title: 'Cover Before Damage',
      goal: 'Stop taking duels from open space.',
      setup: 'Before each fight, name the cover piece you will play around.',
      reps: 'Play 3 matches where every first peek starts within one dodge, dash, or step of cover.',
      review: 'Count deaths where your nearest cover was more than one second away.',
    },
    {
      id: 'height-hold',
      category: 'Starter',
      title: 'High Ground Hold',
      goal: 'Avoid dropping from strong positions too early.',
      setup: 'Pick one high-ground position before the fight opens.',
      reps: 'Hold height until your team commits, an enemy spends mobility on you, or the fight is already won.',
      review: 'Mark each drop as forced, fight-winning, or unnecessary.',
    },
    {
      id: 'space-cooldown-ledger',
      category: 'Vanguard',
      title: 'Cooldown Space Ledger',
      goal: 'Make each defensive or mobility cooldown create space, hold space, or save a teammate.',
      setup: 'Choose one key cooldown before queueing.',
      reps: 'After each use, say what it gained: angle, doorway, teammate save, objective control, or reset.',
      review: 'If the cooldown gained nothing, write the earlier position that would have made it useful.',
    },
    {
      id: 'duelist-setup',
      category: 'Duelist',
      title: 'Setup Before Burst',
      goal: 'Create threat before committing damage cooldowns.',
      setup: 'Start fights from an off-angle or flank lane with an exit.',
      reps: 'Delay your first hard commit until the enemy turns, uses mobility, or your team engages.',
      review: 'Clip one fight where your setup split attention and one where you entered too early.',
    },
    {
      id: 'strategist-reserve',
      category: 'Strategist',
      title: 'Reserved Utility',
      goal: 'Keep one answer for the enemy fight-winning cooldown.',
      setup: 'Before each fight, predict the enemy engage tool or dive target.',
      reps: 'Hold your selected utility until that threat appears, unless a teammate would otherwise die.',
      review: 'Track whether the reserved cooldown denied pressure or sat unused too long.',
    },
    {
      id: 'three-death-review',
      category: 'Review',
      title: 'Three-Death Review',
      goal: 'Find one repeatable mistake quickly.',
      setup: 'Pick the first three deaths from a replay.',
      reps: 'For each death, write the first decision that made it likely: route, cooldown, target, timing, or position.',
      review: 'Choose the most repeated cause and turn it into one cue for the next session.',
    },
    {
      id: 'mental-reset',
      category: 'Mindset',
      title: 'One-Cue Reset',
      goal: 'Prevent tilt and autopilot from changing your next fight.',
      setup: 'Choose a single cue such as cover first, wait for engage, or save escape.',
      reps: 'After every death, say the cue before leaving spawn.',
      review: 'End the block by rating how often the cue changed your next decision.',
    },
  ];

  readonly filteredPaths = computed(() => {
    const audience = this.selectedAudience();
    const searchTerm = this.searchTerm().trim().toLowerCase();

    return this.paths.filter((path) => {
      const matchesAudience = audience === 'All' || path.audience === audience;
      const matchesSearch =
        searchTerm.length === 0 ||
        path.title.toLowerCase().includes(searchTerm) ||
        path.summary.toLowerCase().includes(searchTerm) ||
        path.steps.some((step) => step.title.toLowerCase().includes(searchTerm));

      return matchesAudience && matchesSearch;
    });
  });

  readonly filteredDrills = computed(() => {
    const audience = this.selectedAudience();
    const searchTerm = this.searchTerm().trim().toLowerCase();

    return this.drills.filter((drill) => {
      const matchesAudience = audience === 'All' || drill.category === audience;
      const matchesSearch =
        searchTerm.length === 0 ||
        drill.title.toLowerCase().includes(searchTerm) ||
        drill.goal.toLowerCase().includes(searchTerm) ||
        drill.setup.toLowerCase().includes(searchTerm);

      return matchesAudience && matchesSearch;
    });
  });

  selectAudience(audience: PathAudience): void {
    this.selectedAudience.set(audience);
  }

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }
}
