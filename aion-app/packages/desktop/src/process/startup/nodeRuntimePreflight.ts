/**
 * Preflight: require system Node.js major >= 24 before starting aioncore.
 *
 * When PATH contains multiple `node` binaries, pick the first that meets the
 * major requirement and prepend its directory to PATH so aioncore inherits it.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { getBrandDisplayName } from '@/common/brand';

export const MIN_SYSTEM_NODE_MAJOR = 24;

export type NodeRuntimePreflightResult =
  | { ok: true; version: string; major: number; nodePath: string }
  | { ok: false; reason: 'not_found' | 'version_too_old' | 'unreadable'; message: string };

function parseNodeMajor(versionOutput: string): { version: string; major: number } | null {
  const match = versionOutput.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { version: `${match[1]}.${match[2]}.${match[3]}`, major: Number(match[1]) };
}

function pathEnvKey(): 'PATH' | 'Path' {
  if (process.platform === 'win32' && process.env.Path !== undefined) return 'Path';
  return 'PATH';
}

/** Absolute paths to `node` / `node.exe` found on PATH, in PATH order. */
export function listNodeCandidatesFromPath(pathEnv = process.env[pathEnvKey()] || ''): string[] {
  const names = process.platform === 'win32' ? ['node.exe', 'node'] : ['node'];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
      } catch {
        continue;
      }
      let key = candidate;
      try {
        key = fs.realpathSync(candidate);
      } catch {
        // keep candidate path
      }
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
    }
  }

  return out;
}

function readNodeVersion(nodePath: string): { version: string; major: number } | null {
  const versionOutput = execFileSync(nodePath, ['-p', 'process.version'], {
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  return parseNodeMajor(versionOutput);
}

/** Ensure `binDir` is first on PATH so child processes (aioncore) resolve the same Node. */
export function preferNodeBinOnPath(binDir: string): void {
  const key = pathEnvKey();
  const current = process.env[key] || '';
  const parts = current.split(path.delimiter).filter(Boolean);
  const resolvedBin = path.resolve(binDir);
  const rest = parts.filter((p) => path.resolve(p) !== resolvedBin);
  process.env[key] = [resolvedBin, ...rest].join(path.delimiter);
}

/**
 * Resolve a system Node.js that satisfies `minMajor`.
 * Scans every `node` on PATH (not only the first), then pins that bin dir on PATH.
 */
export function checkSystemNodeRuntime(minMajor = MIN_SYSTEM_NODE_MAJOR): NodeRuntimePreflightResult {
  const candidates = listNodeCandidatesFromPath();
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: 'not_found',
      message: `Node.js not found in PATH. Install Node.js major >= ${minMajor}, then restart ${getBrandDisplayName()}.`,
    };
  }

  let oldestTooNew: { version: string; path: string } | null = null;
  let parseFailures = 0;

  for (const nodePath of candidates) {
    let parsed: { version: string; major: number } | null;
    try {
      parsed = readNodeVersion(nodePath);
    } catch {
      continue;
    }
    if (!parsed) {
      parseFailures += 1;
      continue;
    }
    if (parsed.major < minMajor) {
      if (!oldestTooNew) oldestTooNew = { version: parsed.version, path: nodePath };
      continue;
    }

    preferNodeBinOnPath(path.dirname(nodePath));
    return { ok: true, version: parsed.version, major: parsed.major, nodePath };
  }

  if (oldestTooNew) {
    return {
      ok: false,
      reason: 'version_too_old',
      message: `Node.js ${oldestTooNew.version} is below required major ${minMajor}. Install Node.js major >= ${minMajor}, then restart ${getBrandDisplayName()}.`,
    };
  }

  if (parseFailures > 0) {
    return {
      ok: false,
      reason: 'unreadable',
      message: `Unable to parse Node.js version. Install Node.js major >= ${minMajor}.`,
    };
  }

  return {
    ok: false,
    reason: 'not_found',
    message: `Node.js not found in PATH. Install Node.js major >= ${minMajor}, then restart ${getBrandDisplayName()}.`,
  };
}
