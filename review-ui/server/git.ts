import { spawn } from 'node:child_process';
import path from 'node:path';

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function git(repoRoot: string, args: string[], opts: { stdin?: string } = {}): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd: repoRoot });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
    if (opts.stdin !== undefined) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }
  });
}

export async function headSha(repoRoot: string): Promise<string> {
  const r = await git(repoRoot, ['rev-parse', 'HEAD']);
  return r.stdout.trim();
}

export async function workingTreeDirty(repoRoot: string): Promise<string[]> {
  const r = await git(repoRoot, ['status', '--porcelain']);
  return r.stdout.split('\n').filter(Boolean);
}

/**
 * Try to apply a patch with --3way. Returns:
 *   ok: true if clean apply (no conflict markers left in tree)
 *   ok: false with conflictFiles if 3-way found conflicts (markers left in tree)
 *   ok: false with error if even 3-way failed entirely
 */
export async function applyPatch(
  repoRoot: string,
  patchPath: string,
): Promise<
  | { ok: true }
  | { ok: false; conflictFiles: string[] }
  | { ok: false; error: string }
> {
  const rel = path.relative(repoRoot, patchPath);

  // First, check if it applies cleanly (no conflicts at all).
  const check = await git(repoRoot, ['apply', '--check', rel]);
  if (check.code === 0) {
    const apply = await git(repoRoot, ['apply', rel]);
    if (apply.code === 0) return { ok: true };
    return { ok: false, error: apply.stderr || apply.stdout };
  }

  // Not clean — try 3-way merge.
  const threeway = await git(repoRoot, ['apply', '--3way', rel]);
  if (threeway.code === 0) {
    return { ok: true };
  }

  // 3-way may have partially applied and left conflict markers.
  // Identify files with conflict markers.
  const status = await git(repoRoot, ['status', '--porcelain']);
  const conflictFiles: string[] = [];
  for (const line of status.stdout.split('\n')) {
    if (!line) continue;
    const code = line.slice(0, 2);
    const file = line.slice(3);
    if (code.includes('U') || code === 'AA' || code === 'DD') {
      conflictFiles.push(file);
    }
  }

  // Also grep the patched files for markers as a fallback.
  if (conflictFiles.length === 0) {
    const grep = await git(repoRoot, ['grep', '-l', '-E', '^<{7}|^={7}$|^>{7}']);
    if (grep.stdout.trim()) {
      conflictFiles.push(...grep.stdout.split('\n').filter(Boolean));
    }
  }

  if (conflictFiles.length > 0) {
    return { ok: false, conflictFiles };
  }
  return { ok: false, error: threeway.stderr || threeway.stdout || 'apply failed' };
}
