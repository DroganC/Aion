use aionui_db::{IAgentMetadataRepository, SqliteAgentMetadataRepository, init_database_memory};

/// Registry npx agents from 025/029/031 are removed by migration 038.
#[tokio::test]
async fn registry_npx_agents_are_removed_from_trimmed_catalog() {
    let db = init_database_memory().await.unwrap();
    let repo = SqliteAgentMetadataRepository::new(db.pool().clone());

    for backend in [
        "autohand",
        "deepagents",
        "dimcode",
        "dirac",
        "glm-acp-agent",
        "grok",
        "kilo",
        "mimo-code",
        "nova",
        "omp",
        "sigit",
    ] {
        assert!(
            repo.find_builtin_by_backend(backend).await.unwrap().is_none(),
            "{backend} must be removed by migration 038"
        );
    }
}
