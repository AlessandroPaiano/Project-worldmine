import { IpcMain } from 'electron';
import Database from 'better-sqlite3';

export function setupIpcHandlers(ipcMain: IpcMain, db: Database.Database) {
  ipcMain.handle('get-entities', () => {
    return db.prepare('SELECT * FROM entities ORDER BY name ASC').all();
  });

  ipcMain.handle('save-entity', (_, entity) => {
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

  // --- Folders Handlers ---
  ipcMain.handle('get-folders', () => {
    return db.prepare('SELECT * FROM folders ORDER BY name ASC').all();
  });

  ipcMain.handle('save-folder', (_, folder) => {
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

  ipcMain.handle('delete-folder', (_, id) => {
    db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('delete-entity', (_, id) => {
    db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('get-relations', () => {
    return db.prepare('SELECT * FROM relations').all();
  });

  ipcMain.handle('save-relation', (_, relation) => {
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

  ipcMain.handle('delete-relation', (_, id) => {
    db.prepare('DELETE FROM relations WHERE id = ?').run(id);
    return true;
  });

  // --- Tags Handlers ---

  ipcMain.handle('get-tags', () => {
    return db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
  });

  ipcMain.handle('get-entity-tags', () => {
    return db.prepare('SELECT * FROM entity_tags').all();
  });

  ipcMain.handle('add-entity-tag', (_, { entityId, tagName }) => {
    // 1. Ensure tag exists
    let tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(tagName) as any;
    if (!tag) {
      const newTagId = crypto.randomUUID();
      db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(newTagId, tagName);
      tag = { id: newTagId, name: tagName };
    }

    // 2. Link tag to entity
    const linkStmt = db.prepare(`
      INSERT INTO entity_tags (entity_id, tag_id)
      VALUES (?, ?)
      ON CONFLICT(entity_id, tag_id) DO NOTHING
    `);
    linkStmt.run(entityId, tag.id);
    return true;
  });

  ipcMain.handle('remove-entity-tag', (_, { entityId, tagId }) => {
    db.prepare('DELETE FROM entity_tags WHERE entity_id = ? AND tag_id = ?').run(entityId, tagId);
    return true;
  });

  // --- Map Handlers ---

  ipcMain.handle('get-maps', () => {
    return db.prepare('SELECT * FROM maps ORDER BY name ASC').all();
  });

  ipcMain.handle('save-map', (_, map) => {
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

  ipcMain.handle('delete-map', (_, id) => {
    db.prepare('DELETE FROM maps WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('get-map-markers', () => {
    return db.prepare('SELECT * FROM map_markers').all();
  });

  ipcMain.handle('save-map-marker', (_, marker) => {
    const mapId = marker.map_id || 'main';
    
    // Ensure 'main' map exists
    db.prepare('INSERT OR IGNORE INTO maps (id, name, image_path) VALUES (?, ?, ?)').run('main', 'World Map', 'default');

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

  ipcMain.handle('delete-map-marker', (_, id) => {
    db.prepare('DELETE FROM map_markers WHERE id = ?').run(id);
    return true;
  });

  // --- Events Handlers ---

  ipcMain.handle('get-events', () => {
    return db.prepare('SELECT * FROM events').all();
  });

  ipcMain.handle('save-event-date', (_, { entity_id, numeric_date }) => {
    const title = db.prepare('SELECT name FROM entities WHERE id = ?').get(entity_id) as { name: string };
    if (!title) return false;

    const stmt = db.prepare(`
      INSERT INTO events (id, entity_id, title, numeric_date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        numeric_date=excluded.numeric_date,
        title=excluded.title
    `);
    
    // Use the entity_id as the event id for 1:1 mapping flexibility in MVP
    stmt.run(entity_id, entity_id, title.name, numeric_date);
    return true;
  });
}
