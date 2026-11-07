import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { GuideCardComponent } from '../../features/learning/guides/guide-card/guide-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { NavigationCategory } from './navigation-category.data';

@Component({
  selector: 'app-navigation-category-page',
  imports: [GuideCardComponent, PageHeaderComponent],
  templateUrl: './navigation-category-page.component.html',
  styleUrl: './navigation-category-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationCategoryPageComponent {
  readonly category = inject(ActivatedRoute).snapshot.data['category'] as NavigationCategory;
  readonly released = this.category.items.filter((item) => item.enabled);
  readonly comingSoon = this.category.items.filter((item) => !item.enabled);
}
