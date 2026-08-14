/**
 * Resolve the aioncore binary path.
 *
 * Search order:
 *  1. AIONUI_DEV_AIONCORE_BIN (unpackaged / dev only; relative to cwd)
 *  2. {cwd}/resources/bundled-aioncore/... (unpackaged only)
 *  3. Bundled with app via process.resourcesPath (production)
 *  4. System PATH
 */

import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const BINARY_NAME = 'aioncore';
const DEV_AIONCORE_BIN_ENV = 'AIONUI_DEV_AIONCORE_BIN';
const MAX_DIR_ENTRIES = 20;
const MAX_LOOKUP_TEXT_LENGTH = 1000;

type BackendBinaryResolveDiagnostics = {
  resourcesPath?: string;
  runtimeKey: string;
  binaryName: string;
  checkedDevEnvPath?: string;
  devEnvExists?: boolean;
  checkedDevBundledPath?: string;
  devBundledExists?: boolean;
  checkedBundledPath?: string;
  bundledDirExists?: boolean;
  runtimeDirExists?: boolean;
  resourcesDirEntries?: string[];
  runtimeDirEntries?: string[];
  pathLookupCommand: string;
  pathLookupResult?: string;
  pathLookupError?: string;
};

class BackendBinaryResolveError extends Error {
  readonly diagnostics: BackendBinaryResolveDiagnostics;

  constructor(message: string, diagnostics: BackendBinaryResolveDiagnostics) {
    super(message);
    this.name = 'BackendBinaryResolveError';
    this.diagnostics = diagnostics;
  }
}

type ResolveBinaryPathOptions = {
  /** When true, skip dev env and cwd/resources candidates. Defaults to Electron app.isPackaged. */
  isPackaged?: boolean;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

function getBinaryName(): string {
  return process.platform === 'win32' ? `${BINARY_NAME}.exe` : BINARY_NAME;
}

function getRuntimeKey(): string {
  return `${process.platform}-${process.arch}`;
}

function listDirEntries(dirPath: string): string[] | undefined {
  try {
    return readdirSync(dirPath, { withFileTypes: true })
      .slice(0, MAX_DIR_ENTRIES)
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`);
  } catch {
    return undefined;
  }
}

function trimLookupText(text: string): string {
  return text.trim().slice(0, MAX_LOOKUP_TEXT_LENGTH);
}

function readDefaultIsPackaged(): boolean {
  try {
    // Lazy require keeps this module testable without an Electron runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { app?: { isPackaged?: boolean } };
    return electron.app?.isPackaged === true;
  } catch {
    return false;
  }
}

function resolveDevEnvBinary(
  env: NodeJS.ProcessEnv,
  cwd: string,
  diagnostics: BackendBinaryResolveDiagnostics
): string | null {
  const raw = env[DEV_AIONCORE_BIN_ENV]?.trim();
  if (!raw) return null;

  const candidate = isAbsolute(raw) ? resolve(raw) : resolve(cwd, raw);
  diagnostics.checkedDevEnvPath = candidate;
  const exists = existsSync(candidate);
  diagnostics.devEnvExists = exists;
  if (exists) return candidate;

  throw new BackendBinaryResolveError(
    `AIONUI_DEV_AIONCORE_BIN is set but binary not found at "${candidate}".`,
    diagnostics
  );
}

function resolveDevBundledPath(
  cwd: string,
  runtimeKey: string,
  binaryName: string,
  diagnostics: BackendBinaryResolveDiagnostics
): string | null {
  const candidate = join(cwd, 'resources', 'bundled-aioncore', runtimeKey, binaryName);
  diagnostics.checkedDevBundledPath = candidate;
  diagnostics.devBundledExists = existsSync(candidate);
  if (diagnostics.devBundledExists) return candidate;
  return null;
}

/**
 * Resolve the aioncore binary path.
 * Returns the absolute path to the binary, or throws if not found.
 */
export function resolveBinaryPath(options: ResolveBinaryPathOptions = {}): string {
  const runtimeKey = getRuntimeKey();
  const binaryName = getBinaryName();
  const isPackaged = options.isPackaged ?? readDefaultIsPackaged();
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const diagnostics: BackendBinaryResolveDiagnostics = {
    runtimeKey,
    binaryName,
    pathLookupCommand: process.platform === 'win32' ? `where ${BINARY_NAME}` : `which ${BINARY_NAME}`,
  };

  if (!isPackaged) {
    const fromDevEnv = resolveDevEnvBinary(env, cwd, diagnostics);
    if (fromDevEnv) return fromDevEnv;

    const fromDevBundled = resolveDevBundledPath(cwd, runtimeKey, binaryName, diagnostics);
    if (fromDevBundled) return fromDevBundled;
  }

  const bundled = bundledPath(runtimeKey, binaryName, diagnostics);
  if (bundled) return bundled;

  const fromPath = resolveFromSystemPATH(diagnostics);
  if (fromPath) return fromPath;

  throw new BackendBinaryResolveError(
    `Cannot find "${BINARY_NAME}" binary. Checked bundled location and system PATH.`,
    diagnostics
  );
}

/**
 * Check bundled binary in resources directory.
 * Layout: bundled-aioncore/{platform}-{arch}/aioncore[.exe]
 */
function bundledPath(
  runtimeKey: string,
  binaryName: string,
  diagnostics: BackendBinaryResolveDiagnostics
): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (!resourcesPath) return null;
  diagnostics.resourcesPath = resourcesPath;
  const bundledDir = join(resourcesPath, 'bundled-aioncore');
  const runtimeDir = join(bundledDir, runtimeKey);
  const candidate = join(runtimeDir, binaryName);
  diagnostics.checkedBundledPath = candidate;
  diagnostics.bundledDirExists = existsSync(bundledDir);
  diagnostics.runtimeDirExists = existsSync(runtimeDir);
  diagnostics.resourcesDirEntries = listDirEntries(resourcesPath);
  diagnostics.runtimeDirEntries = listDirEntries(runtimeDir);

  if (existsSync(candidate)) return candidate;
  return null;
}

/**
 * Try to find the binary on the system PATH.
 */
function resolveFromSystemPATH(diagnostics: BackendBinaryResolveDiagnostics): string | null {
  try {
    const result = execSync(diagnostics.pathLookupCommand, { encoding: 'utf-8', timeout: 5000 }).trim();
    diagnostics.pathLookupResult = trimLookupText(result);
    const firstMatch = result.split(/\r?\n/).find((line) => line.trim());
    if (firstMatch && existsSync(firstMatch.trim())) return firstMatch.trim();
  } catch (error) {
    diagnostics.pathLookupError = error instanceof Error ? trimLookupText(error.message) : String(error);
    return null;
  }
  return null;
}

export type { BackendBinaryResolveDiagnostics, ResolveBinaryPathOptions };
export { BackendBinaryResolveError };
