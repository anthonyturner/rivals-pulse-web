import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-overview',
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent {}
