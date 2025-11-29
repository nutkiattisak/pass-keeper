use crate::crypto;
use crate::models::PasswordEntry;
use rusqlite::{params, Connection, Result};

pub fn initialize_database(db_path: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS master_password (
            id INTEGER PRIMARY KEY,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS passwords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            url TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

pub fn check_master_password_exists(db_path: &str) -> Result<bool> {
    let conn = Connection::open(db_path)?;
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM master_password")?;
    let count: i64 = stmt.query_row([], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn setup_master_password(db_path: &str, password: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM master_password", [], |row| {
        row.get(0)
    })?;

    if count > 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    let password_hash = crypto::hash_password(password)
        .map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

    let created_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO master_password (password_hash, created_at) VALUES (?1, ?2)",
        params![password_hash, created_at],
    )?;

    Ok(())
}

pub fn verify_master_password(db_path: &str, password: &str) -> Result<bool> {
    let conn = Connection::open(db_path)?;
    let mut stmt = conn.prepare("SELECT password_hash FROM master_password LIMIT 1")?;

    let hash: String = stmt.query_row([], |row| row.get(0))?;

    Ok(crypto::verify_password(password, &hash).unwrap_or(false))
}

pub fn add_password(
    db_path: &str,
    key: &[u8],
    title: String,
    username: String,
    password: String,
    url: Option<String>,
    notes: Option<String>,
) -> Result<i64> {
    let conn = Connection::open(db_path)?;

    let encrypted_password = crypto::encrypt(&password, key)
        .map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO passwords (title, username, password, url, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![title, username, encrypted_password, url, notes, now, now],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn get_all_passwords(db_path: &str, key: &[u8]) -> Result<Vec<PasswordEntry>> {
    let conn = Connection::open(db_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, title, username, password, url, notes, created_at, updated_at
         FROM passwords
         ORDER BY updated_at DESC",
    )?;

    let passwords = stmt
        .query_map([], |row| {
            let encrypted_password: String = row.get(3)?;
            let password = crypto::decrypt(&encrypted_password, key).unwrap_or_default();

            Ok(PasswordEntry {
                id: row.get(0)?,
                title: row.get(1)?,
                username: row.get(2)?,
                password,
                url: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(passwords)
}

pub fn get_password(db_path: &str, key: &[u8], id: i64) -> Result<PasswordEntry> {
    let conn = Connection::open(db_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, title, username, password, url, notes, created_at, updated_at
         FROM passwords
         WHERE id = ?1",
    )?;

    stmt.query_row([id], |row| {
        let encrypted_password: String = row.get(3)?;
        let password = crypto::decrypt(&encrypted_password, key).unwrap_or_default();

        Ok(PasswordEntry {
            id: row.get(0)?,
            title: row.get(1)?,
            username: row.get(2)?,
            password,
            url: row.get(4)?,
            notes: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })
}

pub fn update_password(
    db_path: &str,
    key: &[u8],
    id: i64,
    title: String,
    username: String,
    password: String,
    url: Option<String>,
    notes: Option<String>,
) -> Result<()> {
    let conn = Connection::open(db_path)?;

    let encrypted_password = crypto::encrypt(&password, key)
        .map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE passwords
         SET title = ?1, username = ?2, password = ?3, url = ?4, notes = ?5, updated_at = ?6
         WHERE id = ?7",
        params![title, username, encrypted_password, url, notes, now, id],
    )?;

    Ok(())
}

pub fn delete_password(db_path: &str, id: i64) -> Result<()> {
    let conn = Connection::open(db_path)?;
    conn.execute("DELETE FROM passwords WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn search_passwords(db_path: &str, key: &[u8], query: &str) -> Result<Vec<PasswordEntry>> {
    let conn = Connection::open(db_path)?;
    let search_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(
        "SELECT id, title, username, password, url, notes, created_at, updated_at
         FROM passwords
         WHERE title LIKE ?1 OR username LIKE ?1 OR url LIKE ?1
         ORDER BY updated_at DESC",
    )?;

    let passwords = stmt
        .query_map([&search_pattern], |row| {
            let encrypted_password: String = row.get(3)?;
            let password = crypto::decrypt(&encrypted_password, key).unwrap_or_default();

            Ok(PasswordEntry {
                id: row.get(0)?,
                title: row.get(1)?,
                username: row.get(2)?,
                password,
                url: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(passwords)
}
