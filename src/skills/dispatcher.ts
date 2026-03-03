import { listSkills, resolveSkill, type ResolvedSkill } from './resolver.js';

export interface DispatchResult {
  skill: ResolvedSkill;
  prompt: string;
}

export interface DispatchOptions {
  skillsDir?: string;
}

export async function dispatchSkill(
  skillName: string,
  args: string[],
  options: DispatchOptions = {},
): Promise<DispatchResult | null> {
  const skill = await resolveSkill(skillName, options.skillsDir);

  if (!skill) {
    return null;
  }

  const prompt = args.length > 0 ? args.join(' ') : '';

  return { skill, prompt };
}

export { listSkills, resolveSkill };
export type { ResolvedSkill };
