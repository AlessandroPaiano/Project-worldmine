import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export function setupDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'worldmine_db.sqlite');
  const db = new Database(dbPath, { verbose: console.log });
  db.pragma('journal_mode = WAL');

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
    // Column might already exist, ignore
  }

  try {
    db.exec("ALTER TABLE entities ADD COLUMN map_data TEXT;");
  } catch {
    // Column might already exist, ignore
  }

  try {
    db.exec("ALTER TABLE map_markers ADD COLUMN area_bounds TEXT;");
  } catch {
    // Column might already exist, ignore
  }

  try {
    db.exec("ALTER TABLE entities ADD COLUMN sheet_data TEXT;");
  } catch {
    // Column might already exist, ignore
  }

  // Seed Data
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
  if (countStmt.count === 0) {
    const seed = () => {
      const insertEntity = db.prepare('INSERT INTO entities (id, name, type, slug, summary, content) VALUES (?, ?, ?, ?, ?, ?)');
      
      const data = [
        ['char1', 'Elaris Stormweaver', 'character', 'elaris-stormweaver', 'High mage of the Cobalt Tower.', '<p>Elaris is the foremost authority on arcane anomalies.</p>'],
        ['char2', 'Kaelen', 'character', 'kaelen', 'A rogue from the lower districts.', '<p>Known only as Kaelen, he specializes in acquiring rare artifacts.</p>'],
        ['char3', 'Lord Vane', 'character', 'lord-vane', 'Ruler of Aethelgard.', '<p>A stern but just ruler.</p>'],
        ['char4', 'Lyra', 'character', 'lyra', 'Captain of the Skyfleet.', '<p>Ace pilot and navigator.</p>'],
        ['char5', 'Thalor', 'character', 'thalor', 'Ancient dwarven smith.', '<p>Forged the legendary weapons of the first era.</p>'],
        ['pla1', 'Aethelgard', 'place', 'aethelgard', 'The capital city.', '<p>A sprawling metropolis built on the ruins of the Old Empire.</p>'],
        ['pla2', 'Cobalt Tower', 'place', 'cobalt-tower', 'Seat of magical learning.', '<p>A spire that reaches above the clouds.</p>'],
        ['pla3', 'The Whispering Woods', 'place', 'whispering-woods', 'A dangerous forest.', '<p>Many enter, few leave.</p>'],
        ['pla4', 'Sunken Ruins', 'place', 'sunken-ruins', 'Remnants of a forgotten age.', '<p>Rich in history and danger.</p>'],
        ['pla5', 'Sky Port', 'place', 'sky-port', 'Hub of aerial trade.', '<p>Bustling docks in the sky.</p>'],
        ['fac1', 'The Cobalt Order', 'faction', 'cobalt-order', 'Guild of mages.', '<p>They control the flow of magical knowledge.</p>'],
        ['fac2', 'Shadow Syndicate', 'faction', 'shadow-syndicate', 'Underground network.', '<p>Thieves and spies.</p>'],
        ['fac3', 'Royal Guard', 'faction', 'royal-guard', 'Defenders of the realm.', '<p>Elite soldiers.</p>'],
        ['evt1', 'The Great Cataclysm', 'event', 'cataclysm', 'The event that shattered the world.', '<p>Magic run amok.</p>'],
        ['evt2', 'Founding of Aethelgard', 'event', 'founding-aethelgard', 'Establishment of the new capital.', '<p>A new hope.</p>'],
        ['evt3', 'The Mage Rebellion', 'event', 'mage-rebellion', 'A civil war among magic users.', '<p>Led to the creation of the Cobalt Order.</p>']
      ];

      db.transaction(() => {
        for (const [id, name, type, slug, summary, content] of data) {
          insertEntity.run(id, name, type, slug, summary, content);
        }
      })();
    };
    seed();
  }

  // Ensure default map exists
  const mapCount = db.prepare('SELECT COUNT(*) as count FROM maps').get() as { count: number };
  if (mapCount.count === 0) {
    db.prepare('INSERT INTO maps (id, name, image_path, level) VALUES (?, ?, ?, ?)').run('main', 'World Map', '/maps/world_map.webp', 1);
  }

  return db;
}
