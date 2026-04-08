export type DesignTemplateType = 'minimal' | 'full';

export function generateDesignTemplate(options: { template: DesignTemplateType }): string {
  if (options.template === 'minimal') {
    return `# DESIGN.md

## Visual Theme & Atmosphere

<!-- Describe the overall visual direction, mood, and aesthetic of your project -->
`;
  }

  return `# DESIGN.md

## Visual Theme & Atmosphere
<!-- Describe the overall visual direction, mood, and aesthetic -->

## Color Palette & Roles
<!-- Define primary, secondary, accent, neutral, semantic colors -->
<!-- Example: primary: #3B82F6, secondary: #10B981 -->

## Typography Rules
<!-- Font families, sizes, weights, line heights -->
<!-- Example: heading: Inter 700, body: Inter 400 -->

## Component Stylings
<!-- Button, input, card, modal, and other component styles -->

## Layout & Spacing
<!-- Grid system, spacing scale, container widths -->
<!-- Example: spacing-unit: 4px, grid-columns: 12 -->

## Depth & Elevation
<!-- Shadow levels, z-index scale, layering rules -->

## Do's / Don'ts
<!-- Design guidelines and anti-patterns -->
<!-- Do: Use consistent spacing multiples -->
<!-- Don't: Mix more than 3 font families -->

## Responsive Behavior
<!-- Breakpoints, mobile-first rules, adaptive patterns -->
<!-- Example: sm: 640px, md: 768px, lg: 1024px -->
`;
}
