import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import {
  JARVIS_EXCHANGES,
  JARVIS_STATES,
  OVERWOLF_APP_URL,
  type JarvisState,
} from './jarvis-console.data';
import { JarvisCoreRenderer } from './jarvis-core.renderer';

/** Fewer particles on a phone, where the core is drawn much smaller anyway. */
const NARROW_POINT_COUNT = 240;
const WIDE_POINT_COUNT = 360;
const NARROW_VIEWPORT = 600;

const TYPE_QUESTION_MS = 170;
const THINKING_MS = 1000;
const SPEAK_BASE_MS = 210;
const SPEAK_PER_CHARACTER_MS = 18;
const SETTLE_MS = 900;
/** Reduced motion still runs the script, just without the long theatrical pauses. */
const REDUCED_STEP_CAP_MS = 300;
const CAPTION_WINDOW = 14;

@Component({
  selector: 'app-jarvis-console',
  templateUrl: './jarvis-console.component.html',
  styleUrl: './jarvis-console.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JarvisConsoleComponent implements AfterViewInit {
  private readonly coreCanvas = viewChild<ElementRef<HTMLCanvasElement>>('coreCanvas');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  private renderer?: JarvisCoreRenderer;
  private reduceMotion = false;
  private nextExchange = 0;

  readonly states = JARVIS_STATES;
  readonly exchanges = JARVIS_EXCHANGES;

  readonly state = signal<JarvisState>('idle');
  readonly busy = signal(false);
  /** The question as it is typed out, shown before the answer replaces it. */
  readonly askedQuestion = signal('');
  readonly spokenWords = signal<readonly string[]>([]);
  readonly currentWord = signal('');

  /**
   * Empty until the overlay has an Overwolf listing. The template renders an
   * unlinked "coming soon" state rather than pointing at a URL that does not exist.
   */
  readonly appUrl = OVERWOLF_APP_URL;
  readonly hasAppUrl = OVERWOLF_APP_URL.length > 0;

  readonly coreHint = computed(() => (this.state() === 'idle' ? 'Tap to ask' : this.state()));
  readonly hasTranscript = computed(
    () =>
      this.askedQuestion().length > 0
      || this.spokenWords().length > 0
      || this.currentWord().length > 0,
  );

  /**
   * Announced once, after the answer finishes. The visible caption updates every
   * couple of hundred milliseconds, which a live region would read as a stream of
   * interruptions.
   */
  readonly announcement = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  ngAfterViewInit(): void {
    const canvas = this.coreCanvas()?.nativeElement;

    if (!this.isBrowser || !canvas) {
      return;
    }

    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const points = innerWidth < NARROW_VIEWPORT ? NARROW_POINT_COUNT : WIDE_POINT_COUNT;

    this.renderer = new JarvisCoreRenderer(canvas, this.reduceMotion, points);
    this.renderer.start();
  }

  /** Tapping the core walks through the scripted questions in turn. */
  onCoreClick(): void {
    if (this.busy()) {
      return;
    }

    void this.ask(this.nextExchange);
    this.nextExchange = (this.nextExchange + 1) % this.exchanges.length;
  }

  onPromptClick(index: number): void {
    void this.ask(index);
  }

  isActiveState(state: JarvisState): boolean {
    return this.state() === state;
  }

  private async ask(index: number): Promise<void> {
    const exchange = this.exchanges[index];

    if (this.busy() || !exchange) {
      return;
    }

    this.busy.set(true);
    this.spokenWords.set([]);
    this.currentWord.set('');
    this.announcement.set('');

    await this.typeQuestion(exchange.question);
    await this.think();
    await this.speak(exchange.answer);

    this.setState('idle');
    this.busy.set(false);
  }

  private async typeQuestion(question: string): Promise<void> {
    this.setState('listening');

    const words = question.split(' ');

    for (let index = 0; index < words.length; index++) {
      const spoken = words.slice(0, index + 1).join(' ');
      const closing = index === words.length - 1 ? '”' : '';

      this.askedQuestion.set(`“${spoken}${closing}`);
      this.renderer?.setLevel(0.5 + Math.random() * 0.5);
      await this.wait(TYPE_QUESTION_MS);
    }

    this.renderer?.setLevel(0);
  }

  private async think(): Promise<void> {
    this.setState('thinking');
    await this.wait(THINKING_MS);
  }

  private async speak(answer: string): Promise<void> {
    this.setState('speaking');
    this.askedQuestion.set('');

    const words = answer.split(' ');

    for (let index = 0; index < words.length; index++) {
      const word = words[index];

      this.spokenWords.set(words.slice(Math.max(0, index - CAPTION_WINDOW), index));
      this.currentWord.set(word);
      this.renderer?.setLevel(0.4 + Math.random() * 0.6);
      await this.wait(SPEAK_BASE_MS + word.length * SPEAK_PER_CHARACTER_MS);
    }

    this.spokenWords.set(words.slice(-(CAPTION_WINDOW + 1)));
    this.currentWord.set('');
    this.announcement.set(answer);
    this.renderer?.setLevel(0);
    await this.wait(SETTLE_MS);
  }

  private setState(state: JarvisState): void {
    this.state.set(state);
    this.renderer?.setState(state);
  }

  private wait(ms: number): Promise<void> {
    const duration = this.reduceMotion ? Math.min(ms, REDUCED_STEP_CAP_MS) : ms;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        resolve();
      }, duration);

      this.timers.add(timer);
    });
  }

  private teardown(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }

    this.timers.clear();
    this.renderer?.destroy();
    this.renderer = undefined;
  }
}
