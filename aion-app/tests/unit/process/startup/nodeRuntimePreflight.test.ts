import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkSystemNodeRuntime,
  listNodeCandidatesFromPath,
  preferNodeBinOnPath,
} from '../../../../packages/desktop/src/process/startup/nodeRuntimePreflight';
import { getBrandDisplayName } from '@/common/brand';

const posixIt = process.platform === 'win32' ? it.skip : it;

function writeFakeNode(dir: string, version: string) {
  mkdirSync(dir, { recursive: true });
  const nodePath = join(dir, 'node');
  writeFileSync(
    nodePath,
    `#!/bin/sh
echo 'v${version}'
`
  );
  chmodSync(nodePath, 0o755);
  return nodePath;
}

describe('nodeRuntimePreflight', () => {
  const previousPath = process.env.PATH;

  afterEach(() => {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
  });

  posixIt('lists node binaries in PATH order', () => {
    const root = mkdtempSync(join(tmpdir(), 'aionui-node-preflight-'));
    try {
      const first = writeFakeNode(join(root, 'a'), '22.0.0');
      const second = writeFakeNode(join(root, 'b'), '24.1.0');
      process.env.PATH = `${join(root, 'a')}:${join(root, 'b')}`;
      expect(listNodeCandidatesFromPath()).toEqual([first, second]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  posixIt('skips older node and selects major >= minMajor', () => {
    const root = mkdtempSync(join(tmpdir(), 'aionui-node-preflight-'));
    try {
      writeFakeNode(join(root, 'old'), '22.22.3');
      const good = writeFakeNode(join(root, 'good'), '24.11.0');
      process.env.PATH = `${join(root, 'old')}:${join(root, 'good')}`;

      const result = checkSystemNodeRuntime(24);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.version).toBe('24.11.0');
      expect(result.nodePath).toBe(good);
      expect(process.env.PATH?.split(':')[0]).toBe(join(root, 'good'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  posixIt('reports version_too_old when every candidate is below minMajor', () => {
    const root = mkdtempSync(join(tmpdir(), 'aionui-node-preflight-'));
    try {
      writeFakeNode(join(root, 'old'), '22.22.3');
      process.env.PATH = join(root, 'old');
      const result = checkSystemNodeRuntime(24);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('version_too_old');
      expect(result.message).toContain('22.22.3');
      expect(result.message).toContain(getBrandDisplayName());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preferNodeBinOnPath moves bin to front without duplicating', () => {
    process.env.PATH = '/a:/b:/c';
    preferNodeBinOnPath('/b');
    expect(process.env.PATH?.split(':')[0]).toBe('/b');
    preferNodeBinOnPath('/b');
    expect(process.env.PATH?.split(':').filter((p) => p === '/b')).toHaveLength(1);
  });
});
