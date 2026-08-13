use aionui_db::{IAgentMetadataRepository, SqliteAgentMetadataRepository, init_database_memory};

/// Registry binary agents from 025 are removed by migration 038.
#[tokio::test]
async fn registry_binary_agents_are_removed_from_trimmed_catalog() {
    let db = init_database_memory().await.unwrap();
    let repo = SqliteAgentMetadataRepository::new(db.pool().clone());

    for backend in [
        "amp-acp",
        "cortex-code",
        "corust-agent",
        "devin",
        "harn",
        "junie",
        "poolside",
        "stakpak",
        "vtcode",
    ] {
        assert!(
            repo.find_builtin_by_backend(backend).await.unwrap().is_none(),
            "{backend} must be removed by migration 038"
        );
    }
}
