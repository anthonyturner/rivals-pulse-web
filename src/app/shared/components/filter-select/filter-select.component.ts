import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface FilterOption {
  value: string;
  label: string;
}

/** A labelled drop-down for the filters on a page, such as the half-season or the game mode. */
@Component({
  selector: 'app-filter-select',
  templateUrl: './filter-select.component.html',
  styleUrl: './filter-select.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterSelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly FilterOption[]>();
  readonly value = input.required<string | undefined>();
  readonly valueChange = output<string>();

  protected choose(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
