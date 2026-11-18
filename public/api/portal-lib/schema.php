<?php
/**
 * Website Plan portal: database schema. SQLite, migrated on first use.
 * Add a new step to the list to change the schema; never edit a shipped one.
 */
declare(strict_types=1);

function px_migrate(PDO $db): void
{
    $steps = [
        1 => <<<SQL
        CREATE TABLE clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            business_name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            entity_type TEXT NOT NULL DEFAULT 'individual',
            registered_name TEXT,
            reg_number TEXT,
            debit_day TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_mandate',
            stage TEXT NOT NULL DEFAULT 'brief',
            preview_url TEXT,
            live_url TEXT,
            mandate_status TEXT NOT NULL DEFAULT 'none',
            mandate_ref TEXT,
            mandate_pdf TEXT,
            mandate_signed_at TEXT,
            first_debit_date TEXT,
            account_token_hash TEXT,
            account_token_expires TEXT,
            password_hash TEXT,
            review_round INTEGER NOT NULL DEFAULT 0,
            internal_notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT,
            cancelled_at TEXT
        );
        CREATE TABLE mandates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            purpose TEXT NOT NULL,
            agreement_ref TEXT NOT NULL,
            secret TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'sent',
            mandate_url TEXT,
            netcash_ref TEXT,
            pdf_link TEXT,
            reason TEXT,
            bank_summary TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT
        );
        CREATE TABLE briefs (
            client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
            data TEXT NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'draft',
            submitted_at TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            request_id INTEGER,
            orig_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            mime TEXT NOT NULL,
            size INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            page TEXT,
            details TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'received',
            team_note TEXT,
            month_key TEXT NOT NULL,
            counts INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT
        );
        CREATE TABLE care_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            month_key TEXT NOT NULL,
            category TEXT NOT NULL,
            text TEXT NOT NULL,
            metric_label TEXT,
            metric_value TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            amount_cents INTEGER NOT NULL,
            status TEXT NOT NULL,
            pay_date TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE password_resets (
            token_hash TEXT PRIMARY KEY,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL
        );
        CREATE TABLE rate_limits (
            k TEXT PRIMARY KEY,
            hits INTEGER NOT NULL,
            window_start INTEGER NOT NULL
        );
        CREATE INDEX idx_requests_client ON requests (client_id, month_key);
        CREATE INDEX idx_files_client ON files (client_id);
        CREATE INDEX idx_events_client ON events (client_id, id);
        CREATE INDEX idx_care_client ON care_log (client_id, month_key);
        CREATE INDEX idx_mandates_client ON mandates (client_id);
        SQL,
    ];

    $current = (int) $db->query('PRAGMA user_version')->fetchColumn();
    foreach ($steps as $version => $sql) {
        if ($version <= $current) {
            continue;
        }
        $db->beginTransaction();
        try {
            $db->exec($sql);
            $db->exec('PRAGMA user_version = ' . (int) $version);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }
}
