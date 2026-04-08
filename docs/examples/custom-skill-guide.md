# Example: Creating and registering a custom skill

This guide shows the fastest way to add a project-specific skill that works with the repo-local `omp skill` command.

There is no separate `omp skill register` command today. In this repository, registration is file-based: you add a `SKILL.md` file under the appropriate skill catalog directory and then verify discovery through the CLI.

## Goal

Create a custom `release-check` skill that contributors can invoke when preparing a release or validating a release branch.

## 1) Create the skill directory and file

```bash
mkdir -p src/skills/release-check
cat > src/skills/release-check/SKILL.md <<'SKILL'
---
name: release-check
aliases: ["release prep", "/release-check"]
primaryRole: writer
description: Prepare a release checklist for this repository.
---

# Release Check

1. Confirm `npm run typecheck`
2. Confirm `npm run test`
3. Confirm `npm run verify`
4. Summarize blockers, owners, and next commands.

Task: {{ARGUMENTS}}
SKILL
```

## 2) Validate that OMP can discover the skill

The `omp skill` command renders the resolved skill content and prompt input. It helps contributors load and reuse the workflow, but it does not run the checklist commands for you.

```bash
npm run omp -- skill list
npm run omp -- skill release-check "prepare the next release candidate"
```

If you want a quick grep-style check:

```bash
npm run omp -- skill list | grep release-check
```

## 3) Make it available through the Gemini extension (optional)

If the skill should also ship through the extension surface, mirror it into the extension catalog:

```bash
mkdir -p skills/release-check
cp src/skills/release-check/SKILL.md skills/release-check/SKILL.md
gemini extensions link .
```

After relinking, rerun diagnostics if needed:

```bash
npm run doctor
```

## 4) Keep the metadata consistent

Use the same frontmatter structure as the built-in skills:

```yaml
---
name: release-check
aliases: ["release prep"]
primaryRole: writer
description: Prepare a release checklist for this repository.
---
```

Tips:

- Put the canonical skill name in `name`.
- Use short aliases people will actually type.
- Keep the `description` specific enough to show up clearly in `omp skill list`.
- Keep the body procedural and command-oriented.

## 5) Test the skill like a contributor would

```bash
npm run typecheck
npm run test
npm run omp -- skill release-check "validate the branch before merge"
```

## 6) Ship it in a PR

A typical commit and PR flow looks like this:

```bash
git checkout -b docs/custom-skill-guide
git add src/skills/release-check/SKILL.md skills/release-check/SKILL.md docs/examples/custom-skill-guide.md
git commit -m "docs: add custom skill walkthrough"
git push -u origin docs/custom-skill-guide
```

If you are documenting a real feature skill, also include validation output in the PR description:

```text
- npm run typecheck
- npm run test
- npm run omp -- skill release-check "validate the branch before merge"
```
