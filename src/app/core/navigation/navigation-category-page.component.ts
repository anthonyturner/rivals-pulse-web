import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { NavigationCategory } from './navigation-category.data';

@Component({
  selector: 'app-navigation-category-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './navigation-category-page.component.html',
  styleUrl: './navigation-category-page.component.css',
})
export class NavigationCategoryPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly category = this.route.snapshot.data['category'] as NavigationCategory;
}
