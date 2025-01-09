import * as sqliteVec from "sqlite-vec";
import { Database } from "better-sqlite3";
import { elizaLogger } from "@elizaos/core";

// Loads the sqlite-vec extensions into the provided SQLite database
function loadVecExtensions(db: Database): void {
    try {
        // Load sqlite-vec extensions
        sqliteVec.load(db);
        elizaLogger.log("sqlite-vec extensions loaded successfully.");
    } catch (error) {
        elizaLogger.error("Failed to load sqlite-vec extensions:", error);
        throw error;
    }
}

/**
 * @param db - An instance of better - sqlite3 Database
 */
function load(db: Database): void {
    loadVecExtensions(db);
}

export const sqlite_vec = {
    loadVecExtensions,
    load
};
