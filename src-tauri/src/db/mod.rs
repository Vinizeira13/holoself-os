use rusqlite::{Connection, Result as SqlResult};
use std::path::Path;
use std::sync::Mutex;
use crate::commands::health::{SupplementEntry, VitalEntry, HealthTimelineEntry};

pub struct DbState(pub Mutex<Database>);

pub struct Database {
    conn: Connection,
}

const CURRENT_SCHEMA_VERSION: i64 = 1;

impl Database {
    pub fn new(path: &Path) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Self { conn })
    }

    pub fn run_migrations(&self) -> SqlResult<()> {
        // Migration versioning table
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT DEFAULT (datetime('now'))
            );"
        )?;

        let current_version: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )?;

        if current_version < 1 {
            self.apply_v1()?;
        }

        // Future: if current_version < 2 { self.apply_v2()?; }

        Ok(())
    }

    fn apply_v1(&self) -> SqlResult<()> {
        self.conn.execute_batch(
            "
            -- Supplement intake log
            CREATE TABLE IF NOT EXISTS supplements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                dosage TEXT NOT NULL,
                taken_at TEXT NOT NULL,
                category TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Vital signs / biometrics
            CREATE TABLE IF NOT EXISTS vitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vital_type TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                recorded_at TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Clinical lab results (from Gemini OCR)
            CREATE TABLE IF NOT EXISTS lab_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                marker TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                reference_range TEXT,
                status TEXT NOT NULL,
                lab_name TEXT,
                test_date TEXT,
                pdf_source TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Health scheduler (predictive exams)
            CREATE TABLE IF NOT EXISTS health_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exam_type TEXT NOT NULL,
                reason TEXT NOT NULL,
                scheduled_date TEXT NOT NULL,
                triggered_by TEXT,
                completed INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Agent memory / RAG embeddings (for sqlite-vec later)
            CREATE TABLE IF NOT EXISTS agent_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                embedding BLOB,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_supplements_taken_at ON supplements(taken_at);
            CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at);
            CREATE INDEX IF NOT EXISTS idx_lab_results_marker ON lab_results(marker);
            CREATE INDEX IF NOT EXISTS idx_health_schedule_date ON health_schedule(scheduled_date);

            -- Record migration
            INSERT INTO _migrations (version) VALUES (1);
            "
        )?;
        Ok(())
    }

    pub fn insert_supplement(&self, entry: &SupplementEntry) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO supplements (name, dosage, taken_at, category, notes) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![entry.name, entry.dosage, entry.taken_at, entry.category, entry.notes],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_supplements(&self, from: &str, to: &str) -> SqlResult<Vec<SupplementEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, dosage, taken_at, category, notes FROM supplements WHERE taken_at BETWEEN ?1 AND ?2 ORDER BY taken_at DESC"
        )?;
        let entries = stmt.query_map(rusqlite::params![from, to], |row| {
            Ok(SupplementEntry {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                dosage: row.get(2)?,
                taken_at: row.get(3)?,
                category: row.get(4)?,
                notes: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    pub fn insert_vital(&self, entry: &VitalEntry) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO vitals (vital_type, value, unit, recorded_at, source) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![entry.vital_type, entry.value, entry.unit, entry.recorded_at, entry.source],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn check_supplement_taken(&self, name: &str, date: &str) -> SqlResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM supplements WHERE name = ?1 AND DATE(taken_at) = DATE(?2)",
            rusqlite::params![name, date],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    /// Unified health timeline using UNION for single-query performance
    pub fn get_health_timeline(&self, from: &str, to: &str) -> SqlResult<Vec<HealthTimelineEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT timestamp, event_type, label, value FROM (
                SELECT taken_at AS timestamp, 'supplement' AS event_type,
                       name || ' (' || dosage || ')' AS label, NULL AS value
                FROM supplements WHERE taken_at BETWEEN ?1 AND ?2
                UNION ALL
                SELECT recorded_at AS timestamp, 'vital' AS event_type,
                       vital_type || ': ' || CAST(value AS TEXT) || ' ' || unit AS label, value
                FROM vitals WHERE recorded_at BETWEEN ?1 AND ?2
            ) ORDER BY timestamp DESC"
        )?;
        let entries = stmt.query_map(rusqlite::params![from, to, from, to], |row| {
            Ok(HealthTimelineEntry {
                timestamp: row.get(0)?,
                event_type: row.get(1)?,
                label: row.get(2)?,
                value: row.get(3)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }
}
