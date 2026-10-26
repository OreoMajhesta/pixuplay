import { Database } from "bun:sqlite";
import { DB_PATH } from "../config/env";

export const db = new Database(DB_PATH, { create: true });

// Optimize SQLite for high-concurrency read-write
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA synchronous = NORMAL;");
db.run("PRAGMA busy_timeout = 5000;");
db.run("PRAGMA temp_store = MEMORY;");
db.run("PRAGMA mmap_size = 300000000;");
db.run("PRAGMA cache_size = -20000;"); // ~20MB memory cache
