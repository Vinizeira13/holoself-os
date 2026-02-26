use rusqlite::{Connection, Result as SqlResult};
use std::path::Path;
use std::sync::Mutex;
use crate::commands::health::{SupplementEntry, VitalEntry, HealthTimelineEntry};

pub struct DbState(pub Mutex<Database>);

pub struct Database {
    conn: Connection,
}

const _CURRENT_SCHEMA_VERSION: i64 = 1;

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

        // Cleanup old agent_memory entries (>30 days)
        if let Err(e) = self.conn.execute(
            "DELETE FROM agent_memory WHERE timestamp < datetime('now', '-30 days')",
            [],
        ) {
            log::warn!("Failed to cleanup old agent_memory: {}", e);
        }

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

            -- Agent memory (voice inputs, context, RAG embeddings)
            CREATE TABLE IF NOT EXISTS agent_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                timestamp TEXT DEFAULT (datetime('now')),
                category TEXT,
                embedding BLOB
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_supplements_taken_at ON supplements(taken_at);
            CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at);
            CREATE INDEX IF NOT EXISTS idx_lab_results_marker ON lab_results(marker);
            CREATE INDEX IF NOT EXISTS idx_health_schedule_date ON health_schedule(scheduled_date);
            CREATE INDEX IF NOT EXISTS idx_agent_memory_key ON agent_memory(key, timestamp);

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
        let entries = stmt.query_map(rusqlite::params![from, to], |row| {
            Ok(HealthTimelineEntry {
                timestamp: row.get(0)?,
                event_type: row.get(1)?,
                label: row.get(2)?,
                value: row.get(3)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    /// Get distinct supplement names taken in last 90 days
    pub fn get_active_supplements(&self) -> SqlResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT name FROM supplements WHERE taken_at >= DATE('now', '-90 days') ORDER BY name"
        )?;
        let names = stmt.query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(names)
    }

    /// Get latest lab result date for each marker
    pub fn get_latest_labs(&self) -> SqlResult<Vec<(String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT marker, MAX(test_date) FROM lab_results GROUP BY marker"
        )?;
        let labs = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(labs)
    }

    /// Insert a scheduled exam
    pub fn insert_scheduled_exam(&self, exam: &crate::services::scheduler::ScheduledExam) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO health_schedule (exam_type, reason, scheduled_date, triggered_by) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![exam.exam_type, exam.reason, exam.scheduled_date, exam.triggered_by],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Get upcoming scheduled exams (not completed)
    /// Execute a raw SQL statement
    pub fn execute(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> SqlResult<usize> {
        self.conn.execute(sql, params)
    }

    /// Query a single row with raw SQL
    pub fn query_row<T, F>(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql], f: F) -> SqlResult<T>
    where
        F: FnOnce(&rusqlite::Row) -> SqlResult<T>,
    {
        self.conn.query_row(sql, params, f)
    }

    pub fn get_upcoming_exams(&self) -> SqlResult<Vec<(i64, String, String, String, bool)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, exam_type, reason, scheduled_date, completed FROM health_schedule WHERE completed = 0 ORDER BY scheduled_date ASC"
        )?;
        let exams = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, bool>(4)?,
            ))
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(exams)
    }
}
