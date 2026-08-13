use std::process::ExitCode;

use crate::cli::PrepareManagedResourcesArgs;
use crate::commands::error::{CliBoundaryCode, CliBoundaryError};

const SUBCOMMAND: &str = "prepare-managed-resources";

/// `prepare-managed-resources` is removed.
///
/// aioncore no longer downloads or bundles a Node.js runtime. Packaged and
/// local runs both resolve `node` / `npm` / `npx` from the host PATH and
/// require major version >= 24.
pub async fn run_prepare_managed_resources(_args: PrepareManagedResourcesArgs) -> Result<ExitCode, CliBoundaryError> {
    Err(prepare_managed_resources_removed())
}

fn prepare_managed_resources_removed() -> CliBoundaryError {
    CliBoundaryError::new(
        CliBoundaryCode::CliPrepareManagedResourcesRemoved,
        SUBCOMMAND,
        "prepare-managed-resources is removed; aioncore uses the system Node.js runtime (major >= 24)",
    )
    .with_field("stage", "deprecated")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removed_error_uses_stable_code_without_raw_path() {
        let err = prepare_managed_resources_removed();
        assert_eq!(err.code(), CliBoundaryCode::CliPrepareManagedResourcesRemoved);
        let line = err.stderr_line();
        assert!(line.contains("CLI_PREPARE_MANAGED_RESOURCES_REMOVED"));
        assert!(line.contains("stage=deprecated"));
        assert!(!line.contains("/Users/secret/bundle"));
    }
}
