import { dispatchSkill, listSkills } from '../../skills/index.js';
import type { CliIo } from '../types.js';

export interface SkillCommandContext {
  cwd: string;
  io: CliIo;
}

export async function executeSkillCommand(
  argv: string[],
  context: SkillCommandContext,
): Promise<{ exitCode: number }> {
  const { io } = context;

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return printSkillHelp(io);
  }

  const [subcommand, ...rest] = argv;

  if (subcommand === 'list') {
    return listAvailableSkills(io);
  }

  // skill <name> [args...]
  // subcommand is defined here: argv.length > 0 is guaranteed above and 'list' is already handled
  const skillName = subcommand as string;
  const skillArgs = rest;

  const result = await dispatchSkill(skillName, skillArgs);

  if (!result) {
    io.stderr(`Skill "${skillName}" not found.`);
    io.stderr('Run `omg skill list` to see available skills.');
    return { exitCode: 2 };
  }

  const { skill, prompt } = result;

  io.stdout(`## Skill: ${skill.name}`);
  io.stdout(`Role: ${skill.primaryRole}`);
  io.stdout(`Description: ${skill.description}`);
  io.stdout('');

  if (prompt) {
    io.stdout(`## Input: ${prompt}`);
    io.stdout('');
  }

  io.stdout(skill.content);
  return { exitCode: 0 };
}

async function listAvailableSkills(io: CliIo): Promise<{ exitCode: number }> {
  const skills = await listSkills();

  if (skills.length === 0) {
    io.stdout('No skills found.');
    return { exitCode: 0 };
  }

  io.stdout('Available skills:');
  io.stdout('');

  for (const skill of skills) {
    const aliasStr = skill.aliases.length > 0 ? ` (aliases: ${skill.aliases.join(', ')})` : '';
    io.stdout(`  ${skill.name}${aliasStr}`);
    if (skill.description) {
      io.stdout(`    ${skill.description}`);
    }
  }

  return { exitCode: 0 };
}

function printSkillHelp(io: CliIo): { exitCode: number } {
  io.stdout([
    'Usage: omg skill <name> [args...]',
    '       omg skill list',
    '',
    'Commands:',
    '  omg skill list              List all available skills',
    '  omg skill <name> [args...]  Invoke a skill by name or alias',
    '',
    'Examples:',
    '  omg skill list',
    '  omg skill deep-interview "clarify requirements for team orchestration"',
    '  omg skill plan "implement feature X"',
    '  omg skill review --scope src/team/',
    '  omg skill verify',
    '  omg skill handoff --task "OmG parity"',
  ].join('\n'));

  return { exitCode: 0 };
}
