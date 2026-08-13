/**
 * Preflight: require system Node.js major >= 24 before starting aioncore.
 */

import { execFileSync } from 'node:child_process';

export const MIN_SYSTEM_NODE_MAJOR = 24;

export type NodeRuntimePreflightResult =
  | { ok: true; version: string; major: number; nodePath: string }
  | { ok: false; reason: 'not_found' | 'version_too_old' | 'unreadable'; message: string };

function parseNodeMajor(versionOutput: string): { version: string; major: number } | null {
  const match = versionOutput.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { version: `${match[1]}.${match[2]}.${match[3]}`, major: Number(match[1]) };
}

/**
 * Resolve `node` on PATH (honours PATHEXT on Windows via shell which/where is not used —
 * we invoke `node` directly and let the OS PATH resolve it).
 */
export function checkSystemNodeRuntime(minMajor = MIN_SYSTEM_NODE_MAJOR): NodeRuntimePreflightResult {
  try {
    const versionOutput = execFileSync('node', ['-p', 'process.version'], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
    });
    const parsed = parseNodeMajor(versionOutput);
    if (!parsed) {
      return {
        ok: false,
        reason: 'unreadable',
        message: `Unable to parse Node.js version from "${versionOutput.trim()}". Install Node.js major >= ${minMajor}.`,
      };
    }
    if (parsed.major < minMajor) {
      return {
        ok: false,
        reason: 'version_too_old',
        message: `Node.js ${parsed.version} is below required major ${minMajor}. Install Node.js major >= ${minMajor}, then restart AionUi.`,
      };
    }

    let nodePath = 'node';
    try {
      nodePath = execFileSync('node', ['-p', 'process.execPath'], {
        encoding: 'utf8',
        timeout: 10_000,
        windowsHide: true,
      }).trim();
    } catch {
      // keep default
    }

    return { ok: true, version: parsed.version, major: parsed.major, nodePath };
  } catch {
    return {
      ok: false,
      reason: 'not_found',
      message: `Node.js not found in PATH. Install Node.js major >= ${minMajor}, then restart AionUi.`,
    };
  }
}
