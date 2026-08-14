import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBinaryPath } from '@process/backend/binaryResolver';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

function setResourcesPath(resourcesPath: string | undefined): void {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: resourcesPath,
  });
}

function dirEntry(name: string, isDirectory = false): ReturnType<typeof readdirSync>[number] {
  return {
    name,
    isDirectory: () => isDirectory,
  } as unknown as ReturnType<typeof readdirSync>[number];
}

function binaryName(): string {
  return process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
}

function runtimeKey(): string {
  return `${process.platform}-${process.arch}`;
}

describe('resolveBinaryPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readdirSync).mockReturnValue([] as ReturnType<typeof readdirSync>);
  });

  afterEach(() => {
    setResourcesPath(originalResourcesPath);
  });

  it('prefers AIONUI_DEV_AIONCORE_BIN absolute path when unpackaged', () => {
    const envPath = '/tmp/custom-aioncore';
    vi.mocked(existsSync).mockImplementation((path) => path === envPath);
    vi.mocked(execSync).mockReturnValue('/usr/bin/aioncore\n');

    const result = resolveBinaryPath({
      isPackaged: false,
      env: { AIONUI_DEV_AIONCORE_BIN: envPath },
      cwd: '/repo/aion-app',
    });

    expect(result).toBe(resolve(envPath));
    expect(execSync).not.toHaveBeenCalled();
  });

  it('resolves AIONUI_DEV_AIONCORE_BIN relative to cwd when unpackaged', () => {
    const cwd = '/repo/aion-app';
    const relative = 'resources/bundled-aioncore/darwin-arm64/aioncore';
    const expected = resolve(cwd, relative);
    vi.mocked(existsSync).mockImplementation((path) => path === expected);

    const result = resolveBinaryPath({
      isPackaged: false,
      env: { AIONUI_DEV_AIONCORE_BIN: relative },
      cwd,
    });

    expect(result).toBe(expected);
  });

  it('throws when AIONUI_DEV_AIONCORE_BIN is set but missing (no fallthrough)', () => {
    const cwd = '/repo/aion-app';
    const relative = 'resources/missing/aioncore';
    const expected = resolve(cwd, relative);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(execSync).mockReturnValue('/usr/bin/aioncore\n');

    expect(() =>
      resolveBinaryPath({
        isPackaged: false,
        env: { AIONUI_DEV_AIONCORE_BIN: relative },
        cwd,
      })
    ).toThrow(`AIONUI_DEV_AIONCORE_BIN is set but binary not found at "${expected}"`);

    expect(execSync).not.toHaveBeenCalled();
  });

  it('ignores AIONUI_DEV_AIONCORE_BIN when packaged', () => {
    const resourcesPath = '/app/Contents/Resources';
    const packaged = join(resourcesPath, 'bundled-aioncore', runtimeKey(), binaryName());
    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockImplementation((path) => path === packaged);

    const result = resolveBinaryPath({
      isPackaged: true,
      env: { AIONUI_DEV_AIONCORE_BIN: '/tmp/custom-aioncore' },
      cwd: '/repo/aion-app',
    });

    expect(result).toBe(packaged);
  });

  it('uses cwd resources bundled path when unpackaged and env unset', () => {
    const cwd = '/repo/aion-app';
    const devBundled = join(cwd, 'resources', 'bundled-aioncore', runtimeKey(), binaryName());
    vi.mocked(existsSync).mockImplementation((path) => path === devBundled);
    vi.mocked(execSync).mockReturnValue(`${join('/home', '.cargo', 'bin', 'aioncore')}\n`);

    const result = resolveBinaryPath({
      isPackaged: false,
      env: {},
      cwd,
    });

    expect(result).toBe(devBundled);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('ignores cwd resources when packaged', () => {
    const cwd = '/repo/aion-app';
    const resourcesPath = '/app/Contents/Resources';
    const packaged = join(resourcesPath, 'bundled-aioncore', runtimeKey(), binaryName());
    const cwdBundled = join(cwd, 'resources', 'bundled-aioncore', runtimeKey(), binaryName());
    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockImplementation((path) => path === packaged || path === cwdBundled);

    const result = resolveBinaryPath({
      isPackaged: true,
      env: {},
      cwd,
    });

    expect(result).toBe(packaged);
  });

  it('falls back to PATH when bundled locations miss', () => {
    const fromPath = '/home/user/.cargo/bin/aioncore';
    setResourcesPath('/app/resources');
    vi.mocked(existsSync).mockImplementation((path) => path === fromPath);
    vi.mocked(execSync).mockReturnValue(`${fromPath}\n`);

    const result = resolveBinaryPath({
      isPackaged: false,
      env: {},
      cwd: '/repo/aion-app',
    });

    expect(result).toBe(fromPath);
  });

  it('attaches bundled path diagnostics when aioncore cannot be resolved', () => {
    const resourcesPath = '/app/resources';
    const key = runtimeKey();
    const name = binaryName();
    const bundledDir = join(resourcesPath, 'bundled-aioncore');
    const runtimeDir = join(bundledDir, key);
    const checkedBundledPath = join(runtimeDir, name);
    const cwd = '/repo/aion-app';
    const checkedDevBundledPath = join(cwd, 'resources', 'bundled-aioncore', key, name);

    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === resourcesPath) return [dirEntry('bundled-aioncore', true)];
      if (path === runtimeDir) return [dirEntry('manifest.json')];
      return [] as ReturnType<typeof readdirSync>;
    });
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found on PATH');
    });

    expect(() => resolveBinaryPath({ isPackaged: false, env: {}, cwd })).toThrow(
      'Cannot find "aioncore" binary'
    );

    try {
      resolveBinaryPath({ isPackaged: false, env: {}, cwd });
    } catch (error) {
      expect(error).toMatchObject({
        name: 'BackendBinaryResolveError',
        diagnostics: expect.objectContaining({
          resourcesPath,
          runtimeKey: key,
          binaryName: name,
          checkedDevBundledPath,
          devBundledExists: false,
          checkedBundledPath,
          bundledDirExists: false,
          runtimeDirExists: false,
          resourcesDirEntries: ['bundled-aioncore/'],
          runtimeDirEntries: ['manifest.json'],
          pathLookupCommand: process.platform === 'win32' ? 'where aioncore' : 'which aioncore',
          pathLookupError: expect.stringContaining('not found on PATH'),
        }),
      });
    }
  });
});
