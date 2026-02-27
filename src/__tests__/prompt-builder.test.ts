/**
 * prompt-builder.test.ts
 * Tests for the prompt builder using real parsed diff data.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseDiff } from '../diff-parser.js';
import { buildPrompt } from '../prompt-builder.js';
import { extractReadmeIntro } from '../context-reader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../fixtures');

const bugfixDiff = readFileSync(join(fixturesDir, 'bugfix.diff'), 'utf-8');
const newFeatureDiff = readFileSync(join(fixturesDir, 'new-feature.diff'), 'utf-8');
const docsOnlyDiff = readFileSync(join(fixturesDir, 'docs-only.diff'), 'utf-8');

describe('buildPrompt - commit mode (bugfix.diff)', () => {
  const parsed = parseDiff(bugfixDiff);

  it('starts with the commit mode header', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    expect(prompt.startsWith('# Commit Message Request')).toBe(true);
  });

  it('contains the changed file name from the real diff', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    expect(prompt).toContain('src/error-extractor.ts');
  });

  it('contains the ## Changed Files section', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    expect(prompt).toContain('## Changed Files');
  });

  it('contains the ## Diff Summary section', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    expect(prompt).toContain('## Diff Summary');
  });

  it('contains the ## Instructions section', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    expect(prompt).toContain('## Instructions');
  });

  it('includes commit-specific instructions (conventional commit format)', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    expect(prompt).toContain('conventional commit message');
    expect(prompt).toContain('<type>(<scope>): <description>');
    expect(prompt).toContain('feat, fix, docs, refactor, test, chore, ci, perf');
  });

  it('has sections in the correct order: header -> files -> diff -> instructions', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    const headerIdx = prompt.indexOf('# Commit Message Request');
    const filesIdx = prompt.indexOf('## Changed Files');
    const diffIdx = prompt.indexOf('## Diff Summary');
    const instrIdx = prompt.indexOf('## Instructions');
    expect(headerIdx).toBeLessThan(filesIdx);
    expect(filesIdx).toBeLessThan(diffIdx);
    expect(diffIdx).toBeLessThan(instrIdx);
  });

  it('includes additions/deletions count in file list', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit');
    expect(prompt).toContain('+50');
    expect(prompt).toContain('-14');
  });

  it('trims diff when maxLines is set to a small value', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit', 10);
    expect(prompt).toContain('(diff truncated)');
  });
});

describe('buildPrompt - pr mode (new-feature.diff)', () => {
  const parsed = parseDiff(newFeatureDiff);

  it('starts with the PR mode header', () => {
    const prompt = buildPrompt(parsed, newFeatureDiff, 'pr');
    expect(prompt.startsWith('# PR Description Request')).toBe(true);
  });

  it('contains the changed file from the real diff', () => {
    const prompt = buildPrompt(parsed, newFeatureDiff, 'pr');
    expect(prompt).toContain('integration.test.ts');
  });

  it('includes PR-specific instructions', () => {
    const prompt = buildPrompt(parsed, newFeatureDiff, 'pr');
    expect(prompt).toContain('Pull Request description');
    expect(prompt).toContain('What changed');
    expect(prompt).toContain('Why');
    expect(prompt).toContain('How to test');
  });

  it('does not include commit-specific instructions', () => {
    const prompt = buildPrompt(parsed, newFeatureDiff, 'pr');
    expect(prompt).not.toContain('conventional commit message');
  });
});

describe('buildPrompt - changelog mode (docs-only.diff)', () => {
  const parsed = parseDiff(docsOnlyDiff);

  it('starts with the changelog mode header', () => {
    const prompt = buildPrompt(parsed, docsOnlyDiff, 'changelog');
    expect(prompt.startsWith('# Changelog Entry Request')).toBe(true);
  });

  it('contains the changed file from the real diff', () => {
    const prompt = buildPrompt(parsed, docsOnlyDiff, 'changelog');
    expect(prompt).toContain('STATUS.md');
  });

  it('includes changelog-specific instructions', () => {
    const prompt = buildPrompt(parsed, docsOnlyDiff, 'changelog');
    expect(prompt).toContain('Keep a Changelog format');
    expect(prompt).toContain('Added / Changed / Fixed / Removed');
    expect(prompt).toContain('user-facing');
  });

  it('does not include PR-specific instructions', () => {
    const prompt = buildPrompt(parsed, docsOnlyDiff, 'changelog');
    expect(prompt).not.toContain('Pull Request description');
  });
});

describe('buildPrompt - context parameter', () => {
  const parsed = parseDiff(bugfixDiff);

  it('includes a ## Context section when context is provided', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit', 120, 'Project: my-app\nA tool for things.');
    expect(prompt).toContain('## Context');
    expect(prompt).toContain('Project: my-app');
    expect(prompt).toContain('A tool for things.');
  });

  it('places ## Context between header and ## Changed Files', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit', 120, 'Project: test');
    const headerIdx = prompt.indexOf('# Commit Message Request');
    const contextIdx = prompt.indexOf('## Context');
    const filesIdx = prompt.indexOf('## Changed Files');
    expect(contextIdx).toBeGreaterThan(headerIdx);
    expect(contextIdx).toBeLessThan(filesIdx);
  });

  it('omits ## Context when context is undefined', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit', 120, undefined);
    expect(prompt).not.toContain('## Context');
  });

  it('omits ## Context when context is empty string', () => {
    const prompt = buildPrompt(parsed, bugfixDiff, 'commit', 120, '');
    expect(prompt).not.toContain('## Context');
  });
});

describe('extractReadmeIntro', () => {
  it('extracts the first paragraph after the title', () => {
    const readme = '# My Project\n\nThis is the intro paragraph.\n\n## Installation\n';
    expect(extractReadmeIntro(readme)).toBe('This is the intro paragraph.');
  });

  it('handles multi-line first paragraph', () => {
    const readme = '# My Project\n\nFirst line.\nSecond line.\n\n## Next\n';
    expect(extractReadmeIntro(readme)).toBe('First line. Second line.');
  });

  it('returns empty string when README has no paragraph', () => {
    const readme = '# Title Only\n';
    expect(extractReadmeIntro(readme)).toBe('');
  });

  it('works without a title line', () => {
    const readme = 'This is a README without a title heading.\n\n## Section\n';
    expect(extractReadmeIntro(readme)).toBe('This is a README without a title heading.');
  });

  it('stops at the next heading', () => {
    const readme = '# Title\n\nIntro text.\n## Next heading\nMore text.\n';
    expect(extractReadmeIntro(readme)).toBe('Intro text.');
  });

  it('extracts the real commitprompt README intro', () => {
    const realReadme = readFileSync(join(fixturesDir, '../../README.md'), 'utf-8');
    const intro = extractReadmeIntro(realReadme);
    expect(intro).toContain('git diff');
    expect(intro.length).toBeGreaterThan(10);
  });
});
