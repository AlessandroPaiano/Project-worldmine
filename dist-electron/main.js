import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
function setupDatabase() {
  const dbPath = path.join(app.getPath("userData"), "worldmine_db.sqlite");
  const db = new Database(dbPath, { verbose: console.log });
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parent_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        summary TEXT,
        content TEXT,
        image_path TEXT,
        folder_id TEXT,
        map_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS entity_fields (
        entity_id TEXT,
        field_key TEXT,
        field_value TEXT,
        PRIMARY KEY (entity_id, field_key),
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT,
        target_entity_id TEXT,
        relation_type TEXT NOT NULL,
        description TEXT,
        FOREIGN KEY (source_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (target_entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS maps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        image_path TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        parent_map_id TEXT
    );

    CREATE TABLE IF NOT EXISTS map_markers (
        id TEXT PRIMARY KEY,
        map_id TEXT,
        entity_id TEXT,
        x REAL NOT NULL,
        y REAL NOT NULL,
        icon_type TEXT,
        FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        title TEXT NOT NULL,
        date_label TEXT,
        numeric_date INTEGER,
        description TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entity_tags (
        entity_id TEXT,
        tag_id TEXT,
        PRIMARY KEY (entity_id, tag_id),
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);
  try {
    db.exec("ALTER TABLE entities ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;");
  } catch {
  }
  try {
    db.exec("ALTER TABLE entities ADD COLUMN map_data TEXT;");
  } catch {
  }
  try {
    db.exec("ALTER TABLE map_markers ADD COLUMN area_bounds TEXT;");
  } catch {
  }
  try {
    db.exec("ALTER TABLE entities ADD COLUMN sheet_data TEXT;");
  } catch {
  }
  const countStmt = db.prepare("SELECT COUNT(*) as count FROM entities").get();
  if (countStmt.count === 0) {
    const seed = () => {
      const insertEntity = db.prepare("INSERT INTO entities (id, name, type, slug, summary, content) VALUES (?, ?, ?, ?, ?, ?)");
      const data = [
        ["char1", "Elaris Stormweaver", "character", "elaris-stormweaver", "High mage of the Cobalt Tower.", "<p>Elaris is the foremost authority on arcane anomalies.</p>"],
        ["char2", "Kaelen", "character", "kaelen", "A rogue from the lower districts.", "<p>Known only as Kaelen, he specializes in acquiring rare artifacts.</p>"],
        ["char3", "Lord Vane", "character", "lord-vane", "Ruler of Aethelgard.", "<p>A stern but just ruler.</p>"],
        ["char4", "Lyra", "character", "lyra", "Captain of the Skyfleet.", "<p>Ace pilot and navigator.</p>"],
        ["char5", "Thalor", "character", "thalor", "Ancient dwarven smith.", "<p>Forged the legendary weapons of the first era.</p>"],
        ["pla1", "Aethelgard", "place", "aethelgard", "The capital city.", "<p>A sprawling metropolis built on the ruins of the Old Empire.</p>"],
        ["pla2", "Cobalt Tower", "place", "cobalt-tower", "Seat of magical learning.", "<p>A spire that reaches above the clouds.</p>"],
        ["pla3", "The Whispering Woods", "place", "whispering-woods", "A dangerous forest.", "<p>Many enter, few leave.</p>"],
        ["pla4", "Sunken Ruins", "place", "sunken-ruins", "Remnants of a forgotten age.", "<p>Rich in history and danger.</p>"],
        ["pla5", "Sky Port", "place", "sky-port", "Hub of aerial trade.", "<p>Bustling docks in the sky.</p>"],
        ["fac1", "The Cobalt Order", "faction", "cobalt-order", "Guild of mages.", "<p>They control the flow of magical knowledge.</p>"],
        ["fac2", "Shadow Syndicate", "faction", "shadow-syndicate", "Underground network.", "<p>Thieves and spies.</p>"],
        ["fac3", "Royal Guard", "faction", "royal-guard", "Defenders of the realm.", "<p>Elite soldiers.</p>"],
        ["evt1", "The Great Cataclysm", "event", "cataclysm", "The event that shattered the world.", "<p>Magic run amok.</p>"],
        ["evt2", "Founding of Aethelgard", "event", "founding-aethelgard", "Establishment of the new capital.", "<p>A new hope.</p>"],
        ["evt3", "The Mage Rebellion", "event", "mage-rebellion", "A civil war among magic users.", "<p>Led to the creation of the Cobalt Order.</p>"]
      ];
      db.transaction(() => {
        for (const [id, name, type, slug, summary, content] of data) {
          insertEntity.run(id, name, type, slug, summary, content);
        }
      })();
    };
    seed();
  }
  const mapCount = db.prepare("SELECT COUNT(*) as count FROM maps").get();
  if (mapCount.count === 0) {
    db.prepare("INSERT INTO maps (id, name, image_path, level) VALUES (?, ?, ?, ?)").run("main", "World Map", "/maps/world_map.webp", 1);
  }
  return db;
}
function setupIpcHandlers(ipcMain2, db) {
  ipcMain2.handle("get-entities", () => {
    return db.prepare("SELECT * FROM entities ORDER BY name ASC").all();
  });
  ipcMain2.handle("save-entity", (_, entity) => {
    const stmt = db.prepare(`
      INSERT INTO entities (id, name, type, slug, summary, content, image_path, folder_id, map_data, sheet_data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        slug=excluded.slug,
        summary=excluded.summary,
        content=excluded.content,
        image_path=excluded.image_path,
        folder_id=excluded.folder_id,
        map_data=excluded.map_data,
        sheet_data=excluded.sheet_data,
        updated_at=CURRENT_TIMESTAMP
    `);
    stmt.run(
      entity.id,
      entity.name,
      entity.type,
      entity.slug,
      entity.summary || null,
      entity.content || null,
      entity.image_path || null,
      entity.folder_id || null,
      entity.map_data || null,
      entity.sheet_data || null
    );
    return true;
  });
  ipcMain2.handle("get-folders", () => {
    return db.prepare("SELECT * FROM folders ORDER BY name ASC").all();
  });
  ipcMain2.handle("save-folder", (_, folder) => {
    const stmt = db.prepare(`
      INSERT INTO folders (id, name, type, parent_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        parent_id=excluded.parent_id
    `);
    stmt.run(folder.id, folder.name, folder.type, folder.parent_id || null);
    return true;
  });
  ipcMain2.handle("delete-folder", (_, id) => {
    db.prepare("DELETE FROM folders WHERE id = ?").run(id);
    return true;
  });
  ipcMain2.handle("delete-entity", (_, id) => {
    db.prepare("DELETE FROM entities WHERE id = ?").run(id);
    return true;
  });
  ipcMain2.handle("get-relations", () => {
    return db.prepare("SELECT * FROM relations").all();
  });
  ipcMain2.handle("save-relation", (_, relation) => {
    const stmt = db.prepare(`
      INSERT INTO relations (id, source_entity_id, target_entity_id, relation_type, description)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_entity_id=excluded.source_entity_id,
        target_entity_id=excluded.target_entity_id,
        relation_type=excluded.relation_type,
        description=excluded.description
    `);
    stmt.run(
      relation.id,
      relation.source_entity_id,
      relation.target_entity_id,
      relation.relation_type,
      relation.description
    );
    return true;
  });
  ipcMain2.handle("delete-relation", (_, id) => {
    db.prepare("DELETE FROM relations WHERE id = ?").run(id);
    return true;
  });
  ipcMain2.handle("get-tags", () => {
    return db.prepare("SELECT * FROM tags ORDER BY name ASC").all();
  });
  ipcMain2.handle("get-entity-tags", () => {
    return db.prepare("SELECT * FROM entity_tags").all();
  });
  ipcMain2.handle("add-entity-tag", (_, { entityId, tagName }) => {
    let tag = db.prepare("SELECT * FROM tags WHERE name = ?").get(tagName);
    if (!tag) {
      const newTagId = crypto.randomUUID();
      db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(newTagId, tagName);
      tag = { id: newTagId, name: tagName };
    }
    const linkStmt = db.prepare(`
      INSERT INTO entity_tags (entity_id, tag_id)
      VALUES (?, ?)
      ON CONFLICT(entity_id, tag_id) DO NOTHING
    `);
    linkStmt.run(entityId, tag.id);
    return true;
  });
  ipcMain2.handle("remove-entity-tag", (_, { entityId, tagId }) => {
    db.prepare("DELETE FROM entity_tags WHERE entity_id = ? AND tag_id = ?").run(entityId, tagId);
    return true;
  });
  ipcMain2.handle("get-maps", () => {
    return db.prepare("SELECT * FROM maps ORDER BY name ASC").all();
  });
  ipcMain2.handle("save-map", (_, map) => {
    const stmt = db.prepare(`
      INSERT INTO maps (id, name, image_path, level, parent_map_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        image_path=excluded.image_path,
        level=excluded.level,
        parent_map_id=excluded.parent_map_id
    `);
    stmt.run(map.id, map.name, map.image_path, map.level || 1, map.parent_map_id || null);
    return true;
  });
  ipcMain2.handle("delete-map", (_, id) => {
    db.prepare("DELETE FROM maps WHERE id = ?").run(id);
    return true;
  });
  ipcMain2.handle("get-map-markers", () => {
    return db.prepare("SELECT * FROM map_markers").all();
  });
  ipcMain2.handle("save-map-marker", (_, marker) => {
    const mapId = marker.map_id || "main";
    db.prepare("INSERT OR IGNORE INTO maps (id, name, image_path) VALUES (?, ?, ?)").run("main", "World Map", "default");
    const stmt = db.prepare(`
      INSERT INTO map_markers (id, map_id, entity_id, x, y, icon_type, area_bounds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        x=excluded.x,
        y=excluded.y,
        icon_type=excluded.icon_type,
        entity_id=excluded.entity_id,
        area_bounds=excluded.area_bounds
    `);
    stmt.run(
      marker.id,
      mapId,
      marker.entity_id,
      marker.x,
      marker.y,
      marker.icon_type,
      marker.area_bounds || null
    );
    return true;
  });
  ipcMain2.handle("delete-map-marker", (_, id) => {
    db.prepare("DELETE FROM map_markers WHERE id = ?").run(id);
    return true;
  });
  ipcMain2.handle("get-events", () => {
    return db.prepare("SELECT * FROM events").all();
  });
  ipcMain2.handle("save-event-date", (_, { entity_id, numeric_date }) => {
    const title = db.prepare("SELECT name FROM entities WHERE id = ?").get(entity_id);
    if (!title) return false;
    const stmt = db.prepare(`
      INSERT INTO events (id, entity_id, title, numeric_date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        numeric_date=excluded.numeric_date,
        title=excluded.title
    `);
    stmt.run(entity_id, entity_id, title.name, numeric_date);
    return true;
  });
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
let mainWindow = null;
const isDev = process.env.NODE_ENV !== "production";
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname$1, "index.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#1e1e1e",
      symbolColor: "#74b1be"
    }
  });
  const db = setupDatabase();
  setupIpcHandlers(ipcMain, db);
  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        webPreferences: {
          preload: path.join(__dirname$1, "index.mjs"),
          contextIsolation: true,
          nodeIntegration: false
        }
      }
    };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
