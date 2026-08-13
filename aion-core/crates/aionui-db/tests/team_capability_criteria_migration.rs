use aionui_db::{IAgentMetadataRepository, SqliteAgentMetadataRepository, init_database_memory};

/// 033 retires the keys the Registry-sync workflow wrote that never meant what
/// they looked like. After 038 only the kept official rows remain; still assert
/// none of them carry the retired policy keys.
#[tokio::test]
async fn retired_team_policy_keys_are_stripped_from_every_seeded_policy() {
    let db = init_database_memory().await.unwrap();
    let repo = SqliteAgentMetadataRepository::new(db.pool().clone());

    let rows = repo.list_all().await.unwrap();
    assert!(!rows.is_empty(), "seeded agent metadata is present");

    for row in rows {
        let Some(policy) = row.behavior_policy.as_deref() else {
            continue;
        };
        let policy: serde_json::Value = serde_json::from_str(policy).unwrap();
        let backend = row.backend.as_deref().unwrap_or("<no backend>");
        assert!(
            policy.get("team_capable_override").is_none(),
            "{backend} still carries the retired team_capable_override"
        );
        assert_ne!(
            policy.get("supports_team"),
            Some(&serde_json::Value::Bool(false)),
            "{backend} still carries a no-op supports_team: false"
        );
    }
}

/// aionrs keeps its known-good team whitelist entry after the catalog trim.
#[tokio::test]
async fn aionrs_team_whitelist_survives_catalog_trim() {
    let db = init_database_memory().await.unwrap();
    let repo = SqliteAgentMetadataRepository::new(db.pool().clone());

    for backend in ["claude", "codex", "gemini", "codebuddy"] {
        assert!(
            repo.find_builtin_by_backend(backend).await.unwrap().is_none(),
            "{backend} must be removed by migration 038"
        );
    }

    let aionrs = repo
        .list_all()
        .await
        .unwrap()
        .into_iter()
        .find(|row| row.agent_type == "aionrs")
        .expect("aionrs row is seeded");
    let policy: serde_json::Value = serde_json::from_str(aionrs.behavior_policy.as_deref().unwrap()).unwrap();
    assert_eq!(policy.get("supports_team"), Some(&serde_json::Value::Bool(true)));
}

#[tokio::test]
async fn registry_agents_with_seeded_auth_or_mcp_are_removed() {
    let db = init_database_memory().await.unwrap();
    let repo = SqliteAgentMetadataRepository::new(db.pool().clone());

    for backend in [
        "autohand",
        "deepagents",
        "dirac",
        "glm-acp-agent",
        "grok",
        "kilo",
        "mimo-code",
        "nova",
        "omp",
        "sigit",
        "corust-agent",
        "devin",
        "harn",
        "stakpak",
        "cortex-code",
        "dimcode",
        "poolside",
        "vtcode",
        "junie",
    ] {
        assert!(
            repo.find_builtin_by_backend(backend).await.unwrap().is_none(),
            "{backend} must be removed by migration 038"
        );
    }
}
