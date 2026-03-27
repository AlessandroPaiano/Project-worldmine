export interface Entity {
  id: string;
  name: string;
  type: 'character' | 'place' | 'faction' | 'event';
  slug: string;
  summary?: string;
  content?: string;
  image_path?: string;
  folder_id?: string;
  map_data?: string;
  sheet_data?: string;
  updated_at?: string;
}

export interface Relation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  description?: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface EntityTag {
  entity_id: string;
  tag_id: string;
}

export interface MapMarker {
  id: string;
  map_id: string;
  entity_id: string | null;
  x: number;
  y: number;
  icon_type?: string;
  area_bounds?: string; // JSON string of [[lat,lng], ...] polygon coordinates
}

export interface WorldMap {
  id: string;
  name: string;
  image_path: string;
  level?: number;
  parent_map_id?: string;
}

export interface TimelineEvent {
  id: string;
  entity_id: string;
  title: string;
  numeric_date: number | null;
}

export interface Folder {
  id: string;
  name: string;
  type: 'character' | 'place' | 'faction' | 'event';
  parent_id?: string;
}

export const api = (window as any).api || {
  getEntities: async () => [],
  saveEntity: async () => {},
  deleteEntity: async () => {},
  getRelations: async () => [],
  saveRelation: async () => {},
  deleteRelation: async () => {},
  getTags: async () => [],
  getEntityTags: async () => [],
  addEntityTag: async () => {},
  removeEntityTag: async () => {},
  getMapMarkers: async () => [],
  saveMapMarker: async () => {},
  deleteMapMarker: async () => {},
  getMaps: async () => [],
  saveMap: async () => {},
  deleteMap: async () => {},
  getEvents: async () => [],
  saveEventDate: async () => {},
  getFolders: async () => [],
  saveFolder: async () => {},
  deleteFolder: async () => {}
};
