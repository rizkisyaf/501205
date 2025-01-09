import { tables } from "./sqliteTables";
import { sqlite_vec } from "./sqlite_vec";
import { DatabaseAdapter, IDatabaseCacheAdapter, elizaLogger } from "@elizaos/core";
import { Database } from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";

export * from "./sqliteTables";
export * from "./sqlite_vec";

export class SQLiteAdapter extends DatabaseAdapter implements IDatabaseCacheAdapter {
    protected db: Database;
    private dbPath: string;

    constructor(dbPath: string) {
        super();
        this.dbPath = dbPath;
        this.db = new BetterSqlite3(dbPath);
        sqlite_vec.load(this.db);
    }
}
