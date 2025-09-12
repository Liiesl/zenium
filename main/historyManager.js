// historyManager.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(require('electron').app.getPath('userData'), 'history.db');
let db;

class HistoryManager {
    constructor() {
        db = new Database(dbPath);
        this.init();
    }

    init() {
        const createTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        createTable.run();
    }

    add(entry) {
        const insert = db.prepare('INSERT INTO history (url, title) VALUES (?, ?)');
        insert.run(entry.url, entry.title);
    }

    getAll() {
        const select = db.prepare('SELECT * FROM history ORDER BY timestamp DESC');
        return select.all();
    }
}

module.exports = { HistoryManager };
/*

### 2. Integrate `HistoryManager` into `main.js`

Now, I'll update the `main.js` file to use the new `HistoryManager`. I'll create an instance of it and then call its `add` method from the `ViewManager` when a page finishes navigating.

*   **File:** `main.js`
*   **Modifications:**
    *   Import `HistoryManager`.
    *   Create a `historyManager` instance.
    *   Pass the `historyManager` instance to the `ViewManager`.
    *   Add a new IPC handler for `get-history`.
*/
