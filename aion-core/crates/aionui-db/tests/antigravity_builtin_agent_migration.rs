//! Migration 034 seeded Antigravity; migration 038 removes it from the product catalog.

use aionui_db::init_database_memory;

#[tokio::test]
async fn antigravity_is_removed_from_trimmed_catalog() {
    let db = init_database_memory().await.expect("in-memory database");
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM agent_metadata
         WHERE id = 'a9f3c21e' OR agent_id = 'a9f3c21e' OR backend = 'antigravity'",
    )
    .fetch_one(db.pool())
    .await
    .unwrap();
    assert_eq!(count, 0, "Antigravity must be removed by migration 038");
}
