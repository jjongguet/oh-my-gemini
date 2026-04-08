---
name: design-system
aliases: ["/design-system", "extract tokens", "sync design", "design tokens", "color palette"]
primaryRole: designer
description: Activate when the user wants to extract, sync, or manage design system tokens. Pulls color palettes, typography scales, spacing tokens from URLs or existing code and updates DESIGN.md.
---

# Design System Skill (oh-my-product)

Use this skill when the user wants to extract, create, or synchronize design system tokens.

## Capabilities

1. **Token Extraction** — Extract design tokens from:
   - Live URLs (color palette, typography, spacing from computed styles)
   - Existing CSS/SCSS/Tailwind config files
   - Figma exports or design specs
   - Screenshot images (via multimodal analysis)

2. **DESIGN.md Sync** — Update DESIGN.md sections:
   - Color Palette & Roles (Section 2)
   - Typography Rules (Section 3)
   - Layout Principles (Section 5)
   - Depth & Elevation (Section 6)

3. **Token Format Generation** — Output tokens as:
   - CSS custom properties (`--color-primary: #hex`)
   - Tailwind config extensions
   - SCSS variables
   - JSON token files (Style Dictionary compatible)

## Workflow

1. **Source** — Identify where tokens come from (URL, file, image, manual spec)
2. **Extract** — Parse and normalize token values
3. **Map** — Assign semantic roles (primary, secondary, accent, surface, etc.)
4. **Write** — Update DESIGN.md and/or generate token config files
5. **Verify** — Check contrast ratios, validate completeness

## Token Categories

| Category | Required Tokens |
|----------|----------------|
| Colors | primary, secondary, accent, background, surface, text, border, error, success, warning |
| Typography | heading (h1-h6), body, caption, overline font specs |
| Spacing | scale from 4px base (4, 8, 12, 16, 24, 32, 48, 64, 96) |
| Elevation | shadow-sm, shadow-md, shadow-lg, shadow-xl |
| Radius | sm (4px), md (8px), lg (16px), full (9999px) |

## Rules

- Always output tokens with semantic names, never raw values only
- Validate color contrast ratios (WCAG AA: 4.5:1 for text, 3:1 for large text)
- Preserve existing DESIGN.md sections when updating — only modify relevant sections
- Generate both human-readable (DESIGN.md) and machine-readable (CSS/JSON) outputs
