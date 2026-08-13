# Aion 构建脚本与完整流程

本文档覆盖本仓库三个包的**本地构建**、**打包产物**和 **CI 发布**。命令以仓库根目录 `/Users/cl/Desktop/Aion` 为参照；实际执行时请先 `cd` 到对应子目录。

| 包 | 目录 | 产物 | 入口 |
| -- | ---- | ---- | ---- |
| AionCore | `aion-core/` | `aioncore` 后端二进制 | `just build` |
| AionUi | `aion-app/` | 桌面安装包 + Web CLI 包 | `just build` / `node scripts/build-with-builder.js` |
| OfficeCLI | `office-cli/` | `officecli` 单文件 CLI | `./build.sh` |

三者不是一次 `make` 打完。桌面安装包在打包时**下载或拷贝**已发布的 `aioncore`；`officecli` **不打进安装包**，由运行中的 AionCore 按需安装。

```
office-cli  ──独立发布──► GitHub Releases / npm
                              │
                              │  运行时按需安装（非打包期）
                              ▼
aion-core   ──发布二进制──► GitHub Releases / Manual Build artifacts
                              │
                              │  打包期 prepareAioncore.js
                              ▼
aion-app    ──electron-builder──► DMG / NSIS / Deb + web-cli tarball
```

---

## 1. 完整产品流程（从源码到可安装包）

日常开发只需构建正在改的那一包。要打一份能启动的桌面安装包，顺序如下。

### 1.1 推荐路径：用已发布的 AionCore

这是 CI 的默认路径，也是本地打安装包最稳的方式。

1. **AionCore 已有对应平台 Release**（或一次 Manual Build 的 artifact）。
2. 在 `aion-app/package.json` 的 `aioncoreVersion` 字段 pin 该 tag（当前为 `v0.1.63`）。
3. 在 `aion-app/` 安装依赖并打包：

```bash
cd aion-app
bun install
just preflight          # 检查 Node / bun / Python / native modules
just build              # 当前平台安装包；产物在 aion-app/out/
```

`just build` 会调用 `bun run build` → `node scripts/build-with-builder.js`。该脚本在 electron-builder 之前执行 `prepareAioncore`，按 pin 从 `iOfficeAI/AionCore` 的 GitHub Release 拉二进制，再让该二进制生成 `managed-resources`。

### 1.2 联调路径：用本地刚编好的 AionCore

先编 core，再告诉 app 用这份二进制（以及它生成的 managed-resources 目录）：

```bash
cd aion-core
just build              # target/release/aioncore

cd ../aion-app
# 方式 A：整包目录（二进制 + managed-resources）
export AIONUI_BACKEND_LOCAL_BUNDLE_DIR=/abs/path/to/complete-bundle
# 方式 B：仅二进制（脚本会再跑 aioncore prepare-managed-resources）
export AIONUI_BACKEND_LOCAL_BINARY=/abs/path/to/aioncore

bun install
just build
```

`AIONUI_BACKEND_LOCAL_BUNDLE_DIR` 必须同时包含 `aioncore[.exe]` 和 `managed-resources/`。

### 1.3 打包期内部步骤（aion-app）

`scripts/build-with-builder.js` 的实际顺序：

```
1. electron-vite build          # main + preload + renderer → out/
2. scripts/build-mcp-servers.js # 内置 MCP 打成独立 CJS，供外部 node 运行
3. prepareAioncore              # 下载/拷贝 aioncore，生成 managed-resources
4. prepareHubResources.js       # Hub index.json + 扩展 zip（离线回退）
5. electron-builder             # 按 electron-builder.yml 打安装包
     ├─ extraResources: bundled-aioncore / hub / public
     ├─ afterPack.js            # 校验 bundled 资源；跨架构时重建 native module
     └─ afterSign.js            # 仅 macOS：codesign + notarize
```

产物目录：`aion-app/out/`。常见文件名：

| 平台 | 产物 |
| ---- | ---- |
| macOS | `AionUi-<ver>-mac-<arch>.dmg`、`.zip` |
| Windows | `AionUi-<ver>-win-<arch>.exe`（NSIS） |
| Linux | `AionUi-<ver>-linux-<arch>.deb` |

`officecli` 不在上述 extraResources 里。Office 预览由 AionCore 的 `aionui-office` 在运行时解析 / 安装 `officecli`。

---

## 2. 环境依赖

| 用途 | 工具 | 说明 |
| ---- | ---- | ---- |
| 三包通用 | `just` | app / core 的本地入口 |
| aion-app | Node.js ≥ 22、bun、Python 3 | native module（`better-sqlite3`）编译需要 Python |
| aion-app Windows | VS 2022 C++ 工作负载、Windows SDK 10.0.19041.0 | `MSVS_VERSION=2022` |
| aion-core | Rust **1.95.0**（`aion-core/rust-toolchain.toml`）、cargo | 可选 `cargo-nextest` |
| aion-core Linux ARM64 发布 | Docker + `cross` | 仅 CI 交叉编译 |
| office-cli | .NET **10** SDK | 产物自包含，运行时不需要 .NET |
| 拉 GitHub 产物 | `gh` 或 `GITHUB_TOKEN` / `GH_TOKEN` | `prepareAioncore` 下载 Release / Actions artifact |

本地桌面打包建议内存：`NODE_OPTIONS=--max-old-space-size=8192`（`just build` 已设置）。

---

## 3. aion-core

### 3.1 本地脚本

入口：`aion-core/justfile`。真正执行构建的是：

- Unix：`aion-core/scripts/just/build.sh`
- Windows：`aion-core/scripts/just/build.ps1`

`just _cargo` 走 `scripts/just/cargo.sh` / `cargo.ps1`，可叠加本地 aionrs SDK patch。

```bash
cd aion-core
just setup                 # git hooks → .githooks
just build                 # cargo build --release；先 lint-fix + fmt
just build --force         # 跳过 sha256 缓存判断
just build-debug
just install               # 拷到 ~/.cargo/bin/aioncore（macOS 会 ad-hoc codesign）
just run                   # cargo run --bin aioncore
just run-release
just test                  # cargo nextest run --workspace
just check                 # migration-check + lint + fmt-check + test
just push                  # 完整门禁后再 git push
just clean
```

发布二进制对应 crate：`crates/aionui-app`，二进制名 `aioncore`（`crates/aionui-app/Cargo.toml` 的 `[[bin]]`）。

开发中不要跑整个 workspace 的 clippy/test；按 crate：

```bash
cargo test -p aionui-<crate>
cargo clippy -p aionui-<crate> -- -D warnings
```

### 3.2 构建缓存

`build.sh` 在 `target/release/aioncore` 上算 sha256，写入 `target/.build-sum`。与上次相同则打印 `Build unchanged`。`--force` / `-f` 跳过该检查。

### 3.3 CI

| Workflow | 触发 | 做什么 |
| -------- | ---- | ------ |
| `.github/workflows/ci.yml` | `main` push / PR | migration 不可变、fmt、clippy、nextest、依赖变更时 audit |
| `.github/workflows/release-please.yml` | `main` 上 `chore: release` commit | 打 tag，再 `gh workflow run release.yml` |
| `.github/workflows/release.yml` | tag `v*` / 手动 | 六平台 release 二进制，上传 GitHub Release |
| `.github/workflows/build-manual.yml` | `workflow_dispatch` | 同矩阵，产物作为 Actions artifact（给 aion-app 用 `AIONUI_BACKEND_RUN_ID` 拉取） |

发布矩阵（`release.yml` / `build-manual.yml`）：

| 平台 | Runner | Target | 备注 |
| ---- | ------ | ------ | ---- |
| Linux x64 | ubuntu-22.04 | `x86_64-unknown-linux-gnu` | 原生编；GLIBC ≤ 2.34 |
| Linux ARM64 | ubuntu-latest | `aarch64-unknown-linux-gnu` | `cross`；GLIBC ≤ 2.30 |
| macOS x64 / ARM64 | macos-latest | `x86_64-apple-darwin` / `aarch64-apple-darwin` | |
| Windows x64 / ARM64 | windows-latest | `*-pc-windows-msvc` | `RUSTFLAGS=-C target-feature=+crt-static` |

命令：`cargo build --release --target <triple> -p aionui-app`（ARM64 Linux 为 `cross build …`）。

Release 资源命名：

```
aioncore-v<ver>-<rust-target>.tar.gz   # Unix
aioncore-v<ver>-<rust-target>.zip      # Windows
```

例如：`aioncore-v0.1.63-aarch64-apple-darwin.tar.gz`。这是 `prepareAioncore` 下载时用的文件名约定。

Linux 基线检查：`aion-core/scripts/check-glibc-baseline.sh`。

---

## 4. aion-app

### 4.1 本地入口

优先用 `aion-app/justfile`，与 CI 环境对齐。

```bash
cd aion-app
just install               # bun install
just setup                 # install + rebuild-native
just rebuild-native        # bunx electron-rebuild -f -w better-sqlite3
just preflight             # 构建前检查
just dev                   # Electron 开发（bun start）
just webui                 # WebUI 开发
just build                 # 当前平台完整安装包
just build-quick           # 可跳过 native rebuild
just build-package         # 只打包，不打安装包（--pack-only --skip-native）
just build-force           # clean 后全量
just build-mac / build-mac-arm64 / build-mac-x64
just build-win / build-win-x64 / build-win-arm64
just build-linux
just list-artifacts        # 列出 out/ 下安装包
just ci-local              # check + test + build
just push                  # lint + format + typecheck + i18n + test 后再 git push
```

等价 npm/bun 脚本（`aion-app/package.json`）：

```bash
bun run start              # Electron 开发
bun run package            # 仅 electron-vite，不打安装包
bun run dist               # node scripts/build-with-builder.js
bun run dist:mac | dist:win | dist:linux
bun run build-mac:arm64    # node scripts/build-with-builder.js arm64 --mac --arm64
bun run build-win:x64
bun run build-deb          # Linux
```

`build-with-builder.js` 常用开关：

| 参数 | 作用 |
| ---- | ---- |
| `auto` / `arm64` / `x64` | 目标架构；`auto` 跟随本机 |
| `--mac` `--win` `--linux` | 目标平台 |
| `--skip-vite` | `out/` 存在且源 hash 未变时可跳过 Vite |
| `--skip-native` | 跳过 native rebuild（just 的 quick/package 会带） |
| `--pack-only` | 只完成 Vite，不跑 electron-builder |
| `--force` | 强制全量 Vite |

### 4.2 打包脚本清单

| 脚本 | 角色 |
| ---- | ---- |
| `scripts/build-with-builder.js` | 总控：Vite → MCP → aioncore → hub → electron-builder |
| `scripts/build-mcp-servers.js` | esbuild 打包内置 MCP（imageGen / browser） |
| `scripts/prepareAioncore.js` | CLI 包装，读环境变量后调用 shared-scripts |
| `packages/shared-scripts/src/prepare-aioncore.js` | 解析/下载/拷贝 aioncore，跑 `prepare-managed-resources` |
| `scripts/resolveAioncoreVersion.js` | 版本：env → `package.json#aioncoreVersion` → `latest` |
| `scripts/prepareHubResources.js` | Hub 离线资源 |
| `scripts/rebuildNativeModules.js` | native module 重建（afterPack 使用） |
| `scripts/afterPack.js` | 校验 bundled-aioncore；跨架构 / Windows 重建 native |
| `scripts/afterSign.js` | macOS 公证 |
| `scripts/postinstall.js` | 本地 `electron-builder install-app-deps`；CI 跳过 |
| `scripts/pack-web-cli.js` | 独立 Web CLI：bun compile + 拷 renderer + bundled-aioncore |
| `packages/desktop/electron-builder.yml` | 安装包配置、`extraResources`、asarUnpack |
| `packages/desktop/electron.vite.config.ts` | Vite；构建时也会触发 MCP bundle |

`aion-app/scripts/README.md` 仍提到已删除的 `beforeBuild.js`。当前 `electron-builder.yml` 只挂了 `afterPack` / `afterSign`，且 `npmRebuild: false`。

### 4.3 aioncore 如何进安装包

解析顺序（`prepare-aioncore.js`）：

1. `AIONUI_BACKEND_RUN_ID` → 下 AionCore **Manual Build** artifact  
2. GitHub Release（tag 来自 `AIONUI_BACKEND_VERSION` 或 `aioncoreVersion`）  
3. `AIONUI_BACKEND_LOCAL_BUNDLE_DIR`（完整目录）  
4. `AIONUI_BACKEND_LOCAL_BINARY`（单文件；随后执行 `aioncore prepare-managed-resources`）

落到：

```
aion-app/resources/bundled-aioncore/{darwin|linux|win32}-{arm64|x64}/
  aioncore[.exe]
  manifest.json
  managed-resources/
```

electron-builder 再把它拷到应用 `Resources/bundled-aioncore/`。运行时由 `packages/desktop/src/process/backend/binaryResolver.ts` 解析。

下载 Release 时需要能访问 `https://github.com/iOfficeAI/AionCore`。CI 使用 `GH_TOKEN` / `GITHUB_TOKEN`。

### 4.4 Web CLI 包

与桌面安装包同频（dev 分支 / 正式 tag）：

```
electron-vite 产出 out/renderer
        +
prepareAioncore
        +
bun build --compile packages/web-cli/src/index.ts
        ↓
dist-web-cli/aionui-web-<ver>-<os>-<arch>.tar.gz
```

本地：`node scripts/pack-web-cli.js`（需先有 renderer 构建产物）。CI：`.github/workflows/pack-web-cli.yml`。

### 4.5 CI

| Workflow | 触发 | 做什么 |
| -------- | ---- | ------ |
| `pr-checks.yml` | PR → `main`/`dev` | 质量检查；可选构建测试 |
| `_build-reusable.yml` | 被其它 workflow 调用 | 质量检查 + 平台矩阵打包 |
| `build-and-release.yml` | `dev` push / tag（且 `PUBLISH_RELEASE=true`） | 六平台桌面包 + web-cli；失败自动重试一次 |
| `build-manual.yml` | 手动 | 选平台 / 分支；可传 `aioncore_run_id` |
| `pack-web-cli.yml` | 被调用或手动 | Web CLI tarball |
| `release-distribute.yml` | Release published | 安装包镜像到 S3 |

桌面矩阵（与 `_build-reusable.yml` 调用方一致）：

| platform | runner | 命令 |
| -------- | ------ | ---- |
| macos-arm64 | macos-14 | `node scripts/build-with-builder.js arm64 --mac --arm64` |
| macos-x64 | macos-14 | `node scripts/build-with-builder.js x64 --mac --x64` |
| windows-x64 | windows-2022 | `… x64 --win --x64` |
| windows-arm64 | windows-11-arm | `… arm64 --win --arm64` |
| linux-x64 | ubuntu-latest | `… x64 --linux --x64` |
| linux-arm64 | ubuntu-24.04-arm | `… arm64 --linux --arm64` |

CI 在跑 electron-builder 之前会显式执行 `node scripts/prepareAioncore.js`，并用 `AIONUI_BACKEND_ARCH` 对齐矩阵 arch。

macOS 签名 / 公证 secrets：`BUILD_CERTIFICATE_BASE64`、`P12_PASSWORD`、`APPLE_ID`、`APPLE_ID_PASSWORD`、`TEAM_ID`、`IDENTITY`。缺证书则打未签名包；缺 Apple ID 则跳过公证。

---

## 5. office-cli

### 5.1 本地

```bash
cd office-cli
./build.sh            # 当前平台 Release（默认）
./build.sh debug      # 当前平台 Debug
./build.sh all        # 全平台 Release
```

工程：`src/officecli/officecli.csproj`。`dotnet publish -c Release -r <RID>`，自包含单文件。

当前平台产物：

```
bin/release/officecli-mac-arm64          # 本机 Darwin arm64 示例
```

`all` 的 RID 与输出名：

| RID | 文件名 |
| --- | ------ |
| osx-arm64 | `officecli-mac-arm64` |
| osx-x64 | `officecli-mac-x64` |
| linux-x64 | `officecli-linux-x64` |
| linux-arm64 | `officecli-linux-arm64` |
| linux-musl-x64 | `officecli-linux-alpine-x64` |
| linux-musl-arm64 | `officecli-linux-alpine-arm64` |
| win-x64 | `officecli-win-x64.exe` |
| win-arm64 | `officecli-win-arm64.exe` |

macOS 本地构建会对 staged `.new` 文件做 ad-hoc `codesign`，再原子 `mv`，避免覆盖正在运行的二进制。

### 5.2 CI

| Workflow | 触发 | 做什么 |
| -------- | ---- | ------ |
| `.github/workflows/build.yml` | tag `v*` / 手动 | 八角矩阵 publish、macOS Developer ID 签名 + notarize、smoke test、上传 Release |
| `publish-npm.yml` | Release **published** | `@officecli/officecli`、`@aionui/officecli`（OIDC trusted publishing） |
| `publish-pypi.yml` / `publish-sdk.yml` | 发布相关 | Python / SDK |
| `sdk-smoke.yml` / `skill-parity.yml` | 检查 | SDK smoke、skill 一致性 |

CI 签名用 `build/officecli.entitlements`（Hardened Runtime + `allow-jit`，CoreCLR 需要）。本地 `build.sh` 只做 ad-hoc 签。

OfficeCLI **不**由 aion-app / aion-core 在打包期嵌入。AionCore 的 `aionui-office` 在运行时查找或安装（官方 install 脚本 / GitHub Releases）。

---

## 6. 环境变量（打包相关）

| 变量 | 谁读 | 作用 |
| ---- | ---- | ---- |
| `AIONUI_BACKEND_VERSION` | prepareAioncore | 覆盖 `package.json#aioncoreVersion` |
| `AIONUI_BACKEND_RUN_ID` | prepareAioncore | 改用 AionCore Manual Build artifact |
| `AIONUI_BACKEND_ARCH` | prepareAioncore | 目标 arch；默认 `npm_config_target_arch` 或 `process.arch` |
| `AIONUI_BACKEND_LOCAL_BUNDLE_DIR` | prepareAioncore | 本地完整 bundle 目录 |
| `AIONUI_BACKEND_LOCAL_BINARY` | prepareAioncore | 本地 `aioncore` 路径 |
| `GH_TOKEN` / `GITHUB_TOKEN` | prepareAioncore、CI | GitHub API / 下载 |
| `NODE_OPTIONS` | Vite / electron-builder | 建议 `--max-old-space-size=8192` |
| `FORCE_NATIVE_REBUILD` | afterPack.js | 同架构也重建 native |
| `PACK_PLATFORM` / `PACK_ARCH` | pack-web-cli.js | 交叉打包 Web CLI |
| `SENTRY_*` | CI 构建 | DSN / sourcemap；linux-x64 负责上传 |
| `IS_DISCONTINUED_BUILD` | CI | tag 含 `-final` 时为 true |

---

## 7. 最小命令速查

只改 UI / 桌面：

```bash
cd aion-app && bun install && bun start
```

只改后端：

```bash
cd aion-core && just run
```

只改 OfficeCLI：

```bash
cd office-cli && ./build.sh
```

打当前 Mac 安装包（用 pin 的 AionCore）：

```bash
cd aion-app && bun install && just build-mac-arm64
```

打当前平台 AionCore 并装到 PATH：

```bash
cd aion-core && just install
```

打全平台 OfficeCLI：

```bash
cd office-cli && ./build.sh all
```

---

## 8. 相关文件

| 文件 | 内容 |
| ---- | ---- |
| `AGENTS.md` | 仓库路由与日常命令 |
| `aion-app/justfile` | 桌面开发 / 构建 / 测试 |
| `aion-app/scripts/README.md` | native rebuild 细节（部分历史描述已过时） |
| `aion-app/packages/desktop/electron-builder.yml` | 安装包与 extraResources |
| `aion-core/justfile` | 后端构建 / 测试 / push 门禁 |
| `aion-core/ARCHITECTURE.md` | 运行时与 managed-resources |
| `office-cli/README.md` | 从源码构建一节 |
| `office-cli/CONTRIBUTING.md` | 贡献与 PR 粒度 |
