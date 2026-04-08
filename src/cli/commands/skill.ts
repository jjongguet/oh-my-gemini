import { dispatchSkill, listSkills } from '../../skills/index.js';
import type { CliIo } from '../types.js';
import { findUnknownOptions, hasFlag, parseCliArgs } from './arg-utils.js';

export interface SkillCommandContext {
  cwd: string;
  io: CliIo;
}

export async function executeSkillCommand(
  argv: string[],
  context: SkillCommandContext,
): Promise<{ exitCode: number }> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (argv.length === 0 || hasFlag(parsed.options, ['help', 'h'])) {
    return printSkillHelp(io);
  }

  const unknownOptions = findUnknownOptions(parsed.options, ['help', 'h']);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return printSkillHelp(io, 2);
  }

  if (parsed.positionals.length === 0) {
    return printSkillHelp(io);
  }

  const [subcommand, ...rest] = parsed.positionals;

  if (subcommand === 'list') {
    return listAvailableSkills(io);
  }

  // skill <name> [args...]
  // subcommand is defined here: argv.length > 0 is guaranteed above and 'list' is already handled
  const skillName = subcommand as string;
  const skillArgs = rest;

  if (skillName.toLowerCase().startsWith('/prompts:')) {
    io.stderr(`"${skillName}" is not a skill. Use the prompts catalog directly instead of omp skill.`);
    io.stderr('Use the prompts catalog directly, or run `omp skill list` to see supported skills.');
    return { exitCode: 2 };
  }

  const result = await dispatchSkill(skillName, skillArgs);

  if (!result) {
    io.stderr(`Skill "${skillName}" not found.`);
    io.stderr('Run `omp skill list` to see available skills.');
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

function printSkillHelp(io: CliIo, exitCode: number = 0): { exitCode: number } {
  io.stdout([
    'Usage: omp skill <name> [args...]',
    '       omp skill list',
    '',
    'Commands:',
    '  omp skill list              List all available skills',
    '  omp skill <name> [args...]  Invoke a skill by name or alias',
    '',
    'Examples:',
    '  omp skill list',
    '  omp skill deep-interview "clarify requirements for team orchestration"',
    '  omp skill plan "implement feature X"',
    '  omp skill review --scope src/team/',
    '  omp skill verify',
    '  omp skill execute "wire the missing command"',
    '  omp skill status',
    '  omp skill cancel',
    '  omp skill debug "why is team resume failing?"',
    '  omp skill help',
    '  omp skill handoff --task "OMP parity"',
  ].join('\n'));

  return { exitCode };
}
