import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type PlayerRole = 'Flexible' | 'Vanguard' | 'Duelist' | 'Strategist';
type ChoiceQuality = 'strong' | 'situational' | 'risky';

interface LessonConcept {
  heading: string;
  body: string;
  beginnerMistake: string;
  coachTip: string;
}

interface ScenarioChoice {
  id: string;
  label: string;
  quality: ChoiceQuality;
  feedbackTitle: string;
  feedbackBody: string;
}

interface Scenario {
  prompt: string;
  context: string;
  choices: ScenarioChoice[];
}

interface BeginnerModule {
  id: string;
  title: string;
  shortGoal: string;
  roleFocus: PlayerRole[];
  heroImage: string;
  concept: LessonConcept;
  scenario: Scenario;
  cue: string;
}

interface PracticeDrill {
  id: string;
  role: PlayerRole;
  title: string;
  cue: string;
  setup: string;
  reps: string;
  review: string;
}

@Component({
  selector: 'app-beginner-guide-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './beginner-guide-page.component.html',
  styleUrl: './beginner-guide-page.component.css',
})
export class BeginnerGuidePageComponent {
  readonly roles: PlayerRole[] = ['Flexible', 'Vanguard', 'Duelist', 'Strategist'];

  readonly selectedRole = signal<PlayerRole>('Flexible');
  readonly currentModuleIndex = signal(0);
  readonly selectedAnswers = signal<Record<string, string>>({});

  readonly modules: BeginnerModule[] = [
    {
      id: 'roles',
      title: 'Know Your Job',
      shortGoal: 'Understand what each role is trying to create for the team.',
      roleFocus: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
      heroImage: '/images/heroes/captain-america.png',
      concept: {
        heading: 'Hero shooters are team jobs, not six solo duels.',
        body: 'Vanguards claim space, Duelists create pressure and finish targets, and Strategists keep the team stable while adding utility.',
        beginnerMistake: 'Picking a hero and only asking, "How do I get kills?"',
        coachTip: 'Ask what your role should make easier for the rest of the team this fight.',
      },
      scenario: {
        prompt: 'Your team is grouped at a choke and nobody can walk through. What is the best first question?',
        context: 'You are about to start a fight and the enemy already sees the main doorway.',
        choices: [
          {
            id: 'role-value',
            label: 'What can my role do to create space, pressure, or safety?',
            quality: 'strong',
            feedbackTitle: 'Strong read',
            feedbackBody: 'That question turns the fight into a role job instead of a random damage race.',
          },
          {
            id: 'solo-kill',
            label: 'Can I sprint through and force a solo kill?',
            quality: 'risky',
            feedbackTitle: 'Too isolated',
            feedbackBody: 'A solo force can work after enemy resources are weak, but it is a rough first plan for a new player.',
          },
          {
            id: 'wait-only',
            label: 'Should I wait until someone else fixes it?',
            quality: 'situational',
            feedbackTitle: 'Only half a plan',
            feedbackBody: 'Waiting can be correct, but you still need to watch for the moment your role can help the team cross.',
          },
        ],
      },
      cue: 'Name your job before the doors open.',
    },
    {
      id: 'team-fights',
      title: 'Fight With Timing',
      shortGoal: 'Learn why entering with your team matters more than being first.',
      roleFocus: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
      heroImage: '/images/heroes/star-lord.png',
      concept: {
        heading: 'Good timing means pressure overlaps.',
        body: 'Most fights are won when multiple teammates threaten the enemy at the same time. Going early feeds; going late leaves teammates unsupported.',
        beginnerMistake: 'Using every cooldown the moment an enemy appears.',
        coachTip: 'Look for your team moving forward, an enemy cooldown being spent, or a target caught away from cover.',
      },
      scenario: {
        prompt: 'You found an off-angle and see the enemy Strategist. Your Vanguard is still rotating. What should you do?',
        context: 'You can shoot now, but your team cannot follow up for two seconds.',
        choices: [
          {
            id: 'hold-sync',
            label: 'Hold the angle, ping the target, and burst as your team engages.',
            quality: 'strong',
            feedbackTitle: 'Clean timing',
            feedbackBody: 'You keep the advantage and wait until your pressure can overlap with the team fight.',
          },
          {
            id: 'dump-now',
            label: 'Use every damage cooldown immediately.',
            quality: 'risky',
            feedbackTitle: 'Too early',
            feedbackBody: 'You may scare them, but you also reveal yourself before your team can convert the pressure.',
          },
          {
            id: 'leave-angle',
            label: 'Leave the angle and stand directly behind your team.',
            quality: 'situational',
            feedbackTitle: 'Sometimes safe, often passive',
            feedbackBody: 'Regrouping is fine if you are in danger, but giving up a strong angle for free lowers your threat.',
          },
        ],
      },
      cue: 'Pressure when your team can also pressure.',
    },
    {
      id: 'positioning',
      title: 'Play From Cover',
      shortGoal: 'Use cover, height, and exits so mistakes do not instantly become deaths.',
      roleFocus: ['Flexible', 'Duelist', 'Strategist'],
      heroImage: '/images/heroes/doctor-strange.png',
      concept: {
        heading: 'Your position decides how many mistakes you are allowed.',
        body: 'Cover breaks line of sight, high ground gives choices, and an exit lets you reset before the fight is lost.',
        beginnerMistake: 'Standing in the open because the enemy is currently looking somewhere else.',
        coachTip: 'Before shooting, know the cover you will duck behind and the route you will use if the fight turns.',
      },
      scenario: {
        prompt: 'You are about to peek the enemy team from main. What makes the peek beginner-safe?',
        context: 'The enemy has several heroes who can punish open sightlines.',
        choices: [
          {
            id: 'cover-exit',
            label: 'Peek from one step off cover with an exit already chosen.',
            quality: 'strong',
            feedbackTitle: 'Survivable pressure',
            feedbackBody: 'You can deal damage, break line of sight, and reset without needing a perfect reaction.',
          },
          {
            id: 'open-space',
            label: 'Walk into the open so you can see every enemy.',
            quality: 'risky',
            feedbackTitle: 'Too exposed',
            feedbackBody: 'Seeing everyone usually means everyone can see you. New players should make cover the default state.',
          },
          {
            id: 'never-peek',
            label: 'Avoid peeking until the objective is already contested.',
            quality: 'situational',
            feedbackTitle: 'Safe, but low impact',
            feedbackBody: 'Staying alive matters, but you still need useful pressure before the fight reaches crisis mode.',
          },
        ],
      },
      cue: 'Cover first, damage second.',
    },
    {
      id: 'objectives',
      title: 'Respect The Objective',
      shortGoal: 'Learn when to fight, touch, reset, and stop staggering.',
      roleFocus: ['Flexible', 'Vanguard', 'Strategist'],
      heroImage: '/images/heroes/mantis.png',
      concept: {
        heading: 'Objectives matter, but bad objective fights make the next fight worse.',
        body: 'Touching at the right time can save a round. Touching alone after the fight is lost often feeds ultimate charge and delays your team.',
        beginnerMistake: 'Running to point one by one because the objective icon is flashing.',
        coachTip: 'Count teammates first. If you cannot contest together, reset fast and take the next full fight.',
      },
      scenario: {
        prompt: 'Three teammates just died and you are near the objective alone. What is usually best?',
        context: 'The timer is not in overtime and your team can regroup for another fight.',
        choices: [
          {
            id: 'reset',
            label: 'Back out, stay alive, and regroup for a full fight.',
            quality: 'strong',
            feedbackTitle: 'Good reset',
            feedbackBody: 'You preserve time, cooldowns, and team structure for the next real contest.',
          },
          {
            id: 'solo-touch',
            label: 'Touch alone and hope the enemy ignores you.',
            quality: 'risky',
            feedbackTitle: 'Likely stagger',
            feedbackBody: 'Solo touches are for urgent overtime moments. Here, dying late delays the next team fight.',
          },
          {
            id: 'poke-exit',
            label: 'Poke once, then leave if the enemy turns.',
            quality: 'situational',
            feedbackTitle: 'Depends on safety',
            feedbackBody: 'A little safe poke is fine, but only if your exit is guaranteed and it will not delay your regroup.',
          },
        ],
      },
      cue: 'Full fights beat lonely hero moments.',
    },
  ];

  readonly practiceDrills: PracticeDrill[] = [
    {
      id: 'flexible-foundation',
      role: 'Flexible',
      title: 'Three-Fight Foundation',
      cue: 'Job, cover, timing.',
      setup: 'Before each fight, name your role job and the cover you will use.',
      reps: 'Play one match where you delay every hard engage until at least one teammate can help.',
      review: 'After the match, write one death caused by role confusion, open space, or early timing.',
    },
    {
      id: 'vanguard-space',
      role: 'Vanguard',
      title: 'Space Before Point',
      cue: 'Take useful space, then touch.',
      setup: 'Choose the corner, doorway, or lane your team needs before walking to objective.',
      reps: 'For three fights, spend your first major cooldown to help your team cross or hold space.',
      review: 'Mark whether the cooldown gained space, saved a teammate, or only delayed your death.',
    },
    {
      id: 'duelist-timing',
      role: 'Duelist',
      title: 'Setup Before Burst',
      cue: 'Angle first, burst second.',
      setup: 'Start each fight from an off-angle with cover and an exit.',
      reps: 'Only commit burst when your team engages, an enemy turns away, or a target loses mobility.',
      review: 'Clip one fight where your timing overlapped and one where you entered alone.',
    },
    {
      id: 'strategist-stability',
      role: 'Strategist',
      title: 'Stable And Useful',
      cue: 'Safe enough to help.',
      setup: 'Pick a position that can see your team while staying near cover.',
      reps: 'For one match, keep one key cooldown ready for the enemy engage instead of spending it on poke.',
      review: 'Track whether your saved cooldown stopped pressure or sat unused too long.',
    },
  ];

  readonly currentModule = computed(() => this.modules[this.currentModuleIndex()]);

  readonly answeredCount = computed(() => Object.keys(this.selectedAnswers()).length);

  readonly progressPercent = computed(() => Math.round((this.answeredCount() / this.modules.length) * 100));

  readonly selectedChoice = computed(() => {
    const module = this.currentModule();
    const selectedChoiceId = this.selectedAnswers()[module.id];

    return module.scenario.choices.find((choice) => choice.id === selectedChoiceId);
  });

  readonly strongAnswerCount = computed(() =>
    this.modules.filter((module) => {
      const selectedChoiceId = this.selectedAnswers()[module.id];
      const selectedChoice = module.scenario.choices.find((choice) => choice.id === selectedChoiceId);

      return selectedChoice?.quality === 'strong';
    }).length,
  );

  readonly guideComplete = computed(() => this.answeredCount() === this.modules.length);

  readonly recommendedPlan = computed(() => {
    const selectedRole = this.selectedRole();
    return (
      this.practiceDrills.find((drill) => drill.role === selectedRole) ??
      this.practiceDrills[0]
    );
  });

  selectRole(role: PlayerRole): void {
    this.selectedRole.set(role);
  }

  selectAnswer(moduleId: string, choiceId: string): void {
    this.selectedAnswers.update((answers) => ({
      ...answers,
      [moduleId]: choiceId,
    }));
  }

  nextModule(): void {
    this.currentModuleIndex.update((index) => Math.min(index + 1, this.modules.length - 1));
  }

  previousModule(): void {
    this.currentModuleIndex.update((index) => Math.max(index - 1, 0));
  }

  resetGuide(): void {
    this.selectedAnswers.set({});
    this.currentModuleIndex.set(0);
  }
}
