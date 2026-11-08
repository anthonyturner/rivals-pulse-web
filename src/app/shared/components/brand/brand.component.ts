import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The desktop app's Rival clash logo and RIVALS/PULSE wordmark, linking home. */
@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandComponent {}
