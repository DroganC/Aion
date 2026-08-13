use aionui_db::{IAgentMetadataRepository, SqliteAgentMetadataRepository, init_database_memory};

/// Post-038 catalog: only Pi remains among the verified launch-contract cases.
#[tokio::test]
async fn kept_pi_launch_contract_matches_registry_entry() {
    let db = init_database_memory().await.unwrap();
    let repo = SqliteAgentMetadataRepository::new(db.pool().clone());

    let pi = repo
        .find_builtin_by_backend("pi")
        .await
        .unwrap()
        .expect("pi must remain in the trimmed catalog");
    assert_eq!(pi.command.as_deref(), Some("npx"));
    assert_eq!(pi.args.as_deref(), Some(r#"["-y","pi-acp"]"#));
    assert_eq!(pi.yolo_id.as_deref(), None);

    for backend in ["gemini", "qwen", "droid", "cursor", "codebuddy", "goose", "auggie", "kimi", "copilot"] {
        assert!(
            repo.find_builtin_by_backend(backend).await.unwrap().is_none(),
            "{backend} must be removed by migration 038"
        );
    }
}
