use std::path::{Path, PathBuf};

use semver::Version;

use crate::resolve_command_path;

use super::types::{NodeRuntimeError, NodeRuntimeSupport, NodeTool, ResolvedCommand, ResolvedNodeRuntime, ResolvedNodeSource};

/// Minimum supported system Node.js major version.
pub const MIN_SYSTEM_NODE_MAJOR: u64 = 24;

pub fn derive_runtime_root(node: &Path, windows: bool) -> Option<PathBuf> {
    if windows {
        if node.file_name()?.to_str()? == "node.exe" {
            return node.parent().map(Path::to_path_buf);
        }
        return None;
    }

    let bin = node.parent()?;
    let root = bin.parent()?;
    (bin.file_name()?.to_str()? == "bin" && node.file_name()?.to_str()? == "node").then(|| root.to_path_buf())
}

pub fn validate_same_root(node: &Path, npm: &Path, npx: &Path) -> Result<(), NodeRuntimeError> {
    let canonical_node = std::fs::canonicalize(node).map_err(NodeRuntimeError::io_system)?;
    let canonical_npm = std::fs::canonicalize(npm).map_err(NodeRuntimeError::io_system)?;
    let canonical_npx = std::fs::canonicalize(npx).map_err(NodeRuntimeError::io_system)?;

    let node_root = derive_runtime_root(&canonical_node, cfg!(windows))
        .ok_or_else(|| NodeRuntimeError::system_invalid("cannot derive runtime root from node path"))?;

    if !canonical_npm.starts_with(&node_root) || !canonical_npx.starts_with(&node_root) {
        return Err(NodeRuntimeError::system_invalid(
            "npm/npx do not belong to the same runtime root as node",
        ));
    }

    Ok(())
}

pub fn tool_command(tool: NodeTool, runtime: &ResolvedNodeRuntime) -> ResolvedCommand {
    match tool {
        NodeTool::Node => ResolvedCommand::plain(runtime.node_path.clone()),
        NodeTool::Npm => runtime.npm_command(),
        NodeTool::Npx => runtime.npx_command(),
    }
}

pub fn probe_support() -> NodeRuntimeSupport {
    match resolve_command_path("node") {
        Some(path) => NodeRuntimeSupport {
            supported: true,
            detail: format!("system node available ({})", path.display()),
        },
        None => NodeRuntimeSupport {
            supported: false,
            detail: format!(
                "node not found in PATH; install Node.js major version >= {MIN_SYSTEM_NODE_MAJOR}"
            ),
        },
    }
}

/// Resolve `node` / `npm` / `npx` from PATH.
///
/// Version is left as `0.0.0` — callers must run `validate_runtime` with
/// [`MIN_SYSTEM_NODE_MAJOR`] before using the runtime.
pub fn resolve_system_runtime_paths() -> Result<ResolvedNodeRuntime, NodeRuntimeError> {
    let node_path = resolve_command_path("node").ok_or_else(|| {
        NodeRuntimeError::system_invalid(format!(
            "node not found in PATH; install Node.js major version >= {MIN_SYSTEM_NODE_MAJOR}"
        ))
    })?;
    let npm_path = resolve_command_path("npm").ok_or_else(|| {
        NodeRuntimeError::system_invalid(format!(
            "npm not found in PATH; install a complete Node.js {MIN_SYSTEM_NODE_MAJOR}+ distribution"
        ))
    })?;
    let npx_path = resolve_command_path("npx").ok_or_else(|| {
        NodeRuntimeError::system_invalid(format!(
            "npx not found in PATH; install a complete Node.js {MIN_SYSTEM_NODE_MAJOR}+ distribution"
        ))
    })?;

    let root = derive_runtime_root(&node_path, cfg!(windows))
        .or_else(|| node_path.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."));

    // Enforce same-root only when the Node tree matches the classic layout.
    // Version managers that only put shims on PATH still work via PATH lookup.
    if derive_runtime_root(&node_path, cfg!(windows)).is_some() {
        validate_same_root(&node_path, &npm_path, &npx_path)?;
    }

    Ok(ResolvedNodeRuntime {
        source: ResolvedNodeSource::System,
        root,
        version: Version::new(0, 0, 0),
        node_path,
        npm_path,
        npm_args_prefix: vec![],
        npx_path,
        npx_args_prefix: vec![],
        env: vec![],
    })
}

/// Best-effort probe for doctor: PATH node without running `--version`.
pub fn probe_preferred_system_runtime() -> Option<ResolvedNodeRuntime> {
    resolve_system_runtime_paths().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_root_from_unix_bin_node() {
        let node = PathBuf::from("/opt/node-v24/bin/node");
        let root = derive_runtime_root(&node, false).expect("root");
        assert_eq!(root, PathBuf::from("/opt/node-v24"));
    }

    #[test]
    fn mixed_roots_are_rejected() {
        let root = tempfile::tempdir().unwrap();
        let node_root = root.path().join("node-a");
        let npm_root = root.path().join("node-b");

        std::fs::create_dir_all(node_root.join("bin")).unwrap();
        std::fs::create_dir_all(npm_root.join("bin")).unwrap();
        std::fs::write(node_root.join("bin/node"), b"").unwrap();
        std::fs::write(node_root.join("bin/npx"), b"").unwrap();
        std::fs::write(npm_root.join("bin/npm"), b"").unwrap();

        let err = validate_same_root(
            &node_root.join("bin/node"),
            &npm_root.join("bin/npm"),
            &node_root.join("bin/npx"),
        )
        .unwrap_err();

        assert!(err.to_string().contains("same runtime root"));
    }

    #[test]
    fn min_major_is_twenty_four() {
        assert_eq!(MIN_SYSTEM_NODE_MAJOR, 24);
    }
}
