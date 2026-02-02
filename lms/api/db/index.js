/**
 * Database Connection Module
 * Provides access to SQLite database with prepared statements
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'lms.db');
const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

module.exports = db;
