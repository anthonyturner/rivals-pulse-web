export class StringUtility {
  static escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  static heroSlug(value: string): string {
    return StringUtility.cleanText(value)
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/['.]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  static heroImagePath(heroName: string): string {
    return `/images/heroes/${StringUtility.heroSlug(heroName) || 'default-hero'}.png`;
  }

  static truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;

    return `${value.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
  }

  static formatList(values: readonly string[]): string {
    if (values.length < 2) return values[0] ?? '';
    if (values.length === 2) return `${values[0]} and ${values[1]}`;

    return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
  }

  static extractByClass(html: string, className: string): string {
    const escapedClassName = StringUtility.escapeRegExp(className);
    const match = html.match(
      new RegExp(`<[^>]*class="${escapedClassName}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'),
    );

    return match?.[1] ?? '';
  }

  static firstImage(html: string, baseUrl?: string): string | undefined {
    const match = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i);

    return match
      ? StringUtility.absoluteUrl(StringUtility.decodeHtml(match[1]), baseUrl)
      : undefined;
  }

  static parseAttributes(value: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrPattern = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
    let match: RegExpExecArray | null;

    while ((match = attrPattern.exec(value))) {
      attrs[match[1]] = StringUtility.decodeHtml(match[2]);
    }

    return attrs;
  }

  static absoluteUrl(value: string, baseUrl?: string): string {
    if (value.startsWith('//')) {
      return `https:${value}`;
    }

    if (baseUrl && value.startsWith('/')) {
      return new URL(value, baseUrl).toString();
    }

    return value;
  }

  static cleanText(value: string): string {
    return StringUtility.decodeHtml(value)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static decodeHtml(value: string): string {
    return value
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  static titleCase(value: string): string {
    return StringUtility.cleanText(value)
      .toLowerCase()
      .split(/(\s+|-|&)/)
      .map((part) => (/^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
      .join('')
      .replace(/\bAnd\b/g, '&');
  }
}
