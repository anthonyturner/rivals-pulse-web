import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * What the boards do and do not cover. These are the claims the privacy notes make about Pulse Records
 * (ADR-0006), so the two are changed together.
 */
@Component({
  selector: 'app-records-coverage',
  imports: [RouterLink],
  template: `
    <section class="coverage" aria-labelledby="records-coverage-title">
      <h2 id="records-coverage-title">What these records cover</h2>
      <ul>
        <li>
          Records come only from matches the Rivals Pulse desktop app uploaded in Quick Match and
          Competitive, so they are the best of those matches, not of every match played.
        </li>
        <li>
          Damage, healing and damage blocked come only from the uploader's own line, because the app
          uploads those figures for nobody else. Those lists hold only players who chose to show their
          name.
        </li>
        <li>
          A name appears only when the player linked their account and chose to show it. A line from a
          player with no linked account reads &quot;Anonymous&quot;. The apps report the names and the
          figures, so a record is not proof that the match happened as shown.
        </li>
        <li>
          Each player and each uploader appears once per list. The hero is the one the game recorded
          for that player in the match, so a player who switched heroes shows one icon.
        </li>
      </ul>
      <p>
        How entries are published, and how to be taken off, is in the
        <a routerLink="/privacy" fragment="pulse-records">privacy notes</a>.
      </p>
    </section>
  `,
  styleUrl: './records-coverage.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordsCoverageComponent {}
