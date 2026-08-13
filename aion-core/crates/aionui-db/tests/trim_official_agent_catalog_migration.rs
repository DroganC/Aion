//! Migration 038 trims the official agent catalog to Aion CLI + OpenCode + Pi.
//! Custom / extension rows must survive.

use aionui_db::{IAgentMetadataRepository, SqliteAgentMetadataRepository, init_database_memory};
use sqlx::Row;

#[tokio::test]
async fn official_catalog_keeps_only_aion_cli_opencode_and_pi() {
    let db = init_database_memory().await.expect("in-memory database");
    let pool = db.pool();
    let repo = SqliteAgentMetadataRepository::new(pool.clone());

    let official = sqlx::query(
        "SELECT id FROM agent_metadata
         WHERE agent_source IN ('builtin', 'internal')
         ORDER BY id",
    )
    .fetch_all(pool)
    .await
    .expect("list official agents");

    let mut ids: Vec<String> = official.iter().map(|row| row.get::<String, _>("id")).collect();
    ids.sort();
    assert_eq!(
        ids,
        vec![
            "484e4bf2".to_string(), // Pi
            "53861a53".to_string(), // OpenCode
            "632f31d2".to_string(), // Aion CLI
        ]
    );

    assert!(repo.find_builtin_by_backend("opencode").await.unwrap().is_some());
    assert!(repo.find_builtin_by_backend("pi").await.unwrap().is_some());
    assert!(repo.find_builtin_by_backend("claude").await.unwrap().is_none());
    assert!(repo.find_builtin_by_backend("codex").await.unwrap().is_none());
    assert!(repo.find_builtin_by_backend("amp-acp").await.unwrap().is_none());
    assert!(repo.find_builtin_by_backend("antigravity").await.unwrap().is_none());

    let aionrs = repo
        .list_all()
        .await
        .unwrap()
        .into_iter()
        .find(|row| row.agent_type == "aionrs")
        .expect("Aion CLI must remain");
    assert_eq!(aionrs.agent_source, "internal");
    assert_eq!(aionrs.id, "632f31d2");
}

#[tokio::test]
async fn custom_agents_survive_catalog_trim_sql() {
    let db = init_database_memory().await.expect("in-memory database");
    let pool = db.pool();

    sqlx::query(
        "INSERT INTO agent_metadata (
             id, agent_id, user_id, name, backend, agent_type, agent_source,
             enabled, sort_order, created_at, updated_at
         ) VALUES (
             'custom-keep-me', 'custom-keep-me', 'system_default_user', 'My Custom',
             'custom-cli', 'acp', 'custom', 1, 9000, 1, 1
         )",
    )
    .execute(pool)
    .await
    .expect("insert custom agent");

    // Re-apply the same predicate as 038 to prove custom/extension rows are out of scope.
    sqlx::query(
        "DELETE FROM agent_metadata
         WHERE agent_source IN ('builtin', 'internal')
           AND id NOT IN ('632f31d2', '53861a53', '484e4bf2')
           AND agent_id NOT IN ('632f31d2', '53861a53', '484e4bf2')",
    )
    .execute(pool)
    .await
    .unwrap();

    let custom: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM agent_metadata WHERE id = 'custom-keep-me' AND agent_source = 'custom'",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    assert_eq!(custom, 1, "custom agent must survive catalog trim SQL");

    let kept: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM agent_metadata
         WHERE agent_source IN ('builtin', 'internal')",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    assert_eq!(kept, 3, "kept official rows must remain");
}
