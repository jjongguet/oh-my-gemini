const UI_KEYWORDS: readonly string[] = [
  'UI',
  'frontend',
  'front-end',
  'design',
  'component',
  'layout',
  'CSS',
  'style',
  'Tailwind',
  'React',
  'Vue',
  'Svelte',
  'HTML',
  'Sass',
  'SCSS',
  'animation',
  'responsive',
  'theme',
  'dark mode',
  'icon',
  'button',
  'modal',
  'dialog',
  'form',
  'input',
  'dropdown',
  'sidebar',
  'navbar',
  'header',
  'footer',
  'card',
  'grid',
  'flex',
];

export function detectUiTask(taskContent: string): boolean {
  const lower = taskContent.toLowerCase();
  for (const keyword of UI_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function getDesignWarning(): string {
  return 'UI-related task detected but no DESIGN.md found. Run `omp design init` to create a design system for consistent styling.';
}
