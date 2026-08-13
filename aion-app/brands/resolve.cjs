/**
 * Resolve the active brand from brands/export.js (or BRAND env override).
 * Shared by electron.vite.config.ts and scripts/build-with-builder.js.
 */

const fs = require('fs');
const path = require('path');

const brandsRoot = __dirname;
const repoRoot = path.resolve(brandsRoot, '..');

const DEFAULT_ICON_RELS = {
  icns: 'icons/app.icns',
  ico: 'icons/app.ico',
  png: 'icons/app.png',
  devPng: 'icons/app_dev.png',
  login: 'icons/login.png',
};

function defaultIconPaths() {
  return {
    icns: path.join(repoRoot, 'resources', 'app.icns'),
    ico: path.join(repoRoot, 'resources', 'app.ico'),
    png: path.join(repoRoot, 'resources', 'app.png'),
    devPng: path.join(repoRoot, 'resources', 'app_dev.png'),
    login: path.join(repoRoot, 'packages/desktop/src/renderer/assets/logos/brand/app.png'),
  };
}

/**
 * @param {string} brandId
 * @param {Record<string, string> | undefined} rawIcons
 */
function resolveIconPaths(brandId, rawIcons) {
  const defaults = defaultIconPaths();
  const brandDir = path.join(brandsRoot, brandId);
  const icons = rawIcons && typeof rawIcons === 'object' ? rawIcons : {};

  /** @param {keyof typeof DEFAULT_ICON_RELS} key */
  const resolveOne = (key) => {
    const rel = String(icons[key] || DEFAULT_ICON_RELS[key] || '').trim();
    if (rel) {
      const abs = path.resolve(brandDir, rel);
      if (fs.existsSync(abs)) {
        return abs;
      }
    }
    return defaults[key];
  };

  return {
    icns: resolveOne('icns'),
    ico: resolveOne('ico'),
    png: resolveOne('png'),
    devPng: resolveOne('devPng'),
    login: resolveOne('login'),
  };
}

/**
 * Copy resolved brand icons into resources/.brand/ for electron-builder + dev tray.
 * @param {{ icns: string, ico: string, png: string, devPng: string }} icons
 */
function syncBrandIcons(icons) {
  const destDir = path.join(repoRoot, 'resources', '.brand');
  fs.mkdirSync(destDir, { recursive: true });
  const copies = [
    ['app.icns', icons.icns],
    ['app.ico', icons.ico],
    ['app.png', icons.png],
    ['app_dev.png', icons.devPng],
  ];
  for (const [name, src] of copies) {
    if (!src || !fs.existsSync(src)) {
      throw new Error(`Brand icon missing for ${name}: ${src}`);
    }
    fs.copyFileSync(src, path.join(destDir, name));
  }
  return destDir;
}

/**
 * @returns {{
 *   id: string,
 *   displayName: string,
 *   productName: string,
 *   icons: { icns: string, ico: string, png: string, devPng: string, login: string },
 *   brandDir: string,
 * }}
 */
function resolveBrand() {
  const exported = require(path.join(brandsRoot, 'export.js'));
  const id = String(process.env.BRAND || exported.brand || 'aionui').trim();
  if (!id) {
    throw new Error('Brand id is empty (set brands/export.js or BRAND)');
  }

  const brandPath = path.join(brandsRoot, id, 'brand.json');
  if (!fs.existsSync(brandPath)) {
    throw new Error(`Unknown brand "${id}": missing ${brandPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
  const displayName = String(raw.displayName || '').trim();
  const productName = String(raw.productName || displayName).trim();
  if (!displayName || !productName) {
    throw new Error(`Brand "${id}" must define displayName (and optionally productName)`);
  }

  const icons = resolveIconPaths(id, raw.icons);
  return {
    id: String(raw.id || id),
    displayName,
    productName,
    icons,
    brandDir: path.join(brandsRoot, id),
  };
}

/**
 * Resolve brand and sync icons into resources/.brand/.
 */
function resolveAndSyncBrand() {
  const brand = resolveBrand();
  syncBrandIcons(brand.icons);
  return brand;
}

module.exports = {
  resolveBrand,
  resolveAndSyncBrand,
  syncBrandIcons,
  repoRoot,
  brandsRoot,
};
