---
name: web-design
aliases: ["/design", "design brief", "web design", "UI design", "create design"]
primaryRole: designer
description: Activate when the user requests web/UI design work, design briefs, wireframe specs, or wants to create/update a DESIGN.md file. Produces structured design artifacts following the DESIGN.md pattern.
---

# Web Design Skill (oh-my-product)

Use this skill when a user requests web design, UI design, or project design work.
Follows the DESIGN.md artifact pattern from the Gemini CLI ecosystem.

## Core Artifact Pattern

This skill produces and maintains three linked documents:

1. **DESIGN.md** — Living design specification (9 sections)
2. **IMPLEMENTATION.md** — 3-5 phase execution plan
3. **MODIFICATION_PLAN.md** — Change tracking for existing designs

## DESIGN.md Template (9 Required Sections)

When creating a new DESIGN.md, include ALL of the following:

### 1. Visual Theme & Atmosphere
- Site density, mood, design philosophy
- Overall aesthetic direction

### 2. Color Palette & Roles
- Semantic color names with hex codes
- Functional roles: background, text, border, accent, error, success
- CSS variable or Tailwind class mappings

### 3. Typography Rules
- Font families, size scale, weight hierarchy
- Line-height and letter-spacing standards

### 4. Component Stylings
- Button, card, input, navigation, modal patterns
- State definitions: hover, active, disabled, focus, loading, error

### 5. Layout Principles
- Grid system, spacing scale, whitespace philosophy
- Container widths and breakpoint strategy

### 6. Depth & Elevation
- Shadow system, z-index layers, surface hierarchy

### 7. Do's and Don'ts
- Design guardrails and anti-patterns to avoid

### 8. Responsive Behavior
- Breakpoints, touch targets, component collapse strategy
- Mobile-first vs desktop-first approach

### 9. Agent Prompt Guide
- Quick reference for AI agents to apply the design system consistently

## Workflow

1. **Clarify** — Gather requirements: target users, brand tone, platform targets
2. **Design** — Create DESIGN.md with all 9 sections
3. **Plan** — Generate IMPLEMENTATION.md with 3-5 execution phases
4. **Review** — Validate against accessibility (WCAG), responsiveness, brand consistency
5. **Iterate** — Update via MODIFICATION_PLAN.md for changes

## Rules

- ALWAYS create DESIGN.md before writing any UI code
- DESIGN.md is the single source of truth for visual decisions
- Every component must reference DESIGN.md tokens (no hardcoded values)
- Validate accessibility: ARIA labels, keyboard nav, color contrast (4.5:1 minimum)
- Test responsive behavior at mobile (375px), tablet (768px), desktop (1280px)

## Output Format

Return structured markdown artifacts. For new projects:
1. DESIGN.md (full 9-section spec)
2. IMPLEMENTATION.md (phased execution plan)

For modifications:
1. MODIFICATION_PLAN.md (change scope + impact analysis)
2. Updated DESIGN.md sections
