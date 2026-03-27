import { create } from 'zustand';
import { api } from '../lib/api';
import type { Entity, Relation, Tag, EntityTag, MapMarker, WorldMap, TimelineEvent, Folder } from '../lib/api';

interface AppState {
  entities: Entity[];
  relations: Relation[];
  loading: boolean;
  fetchEntities: () => Promise<void>;
  saveEntity: (entity: Entity) => Promise<void>;
  deleteEntity: (id: string) => Promise<void>;
  fetchRelations: () => Promise<void>;
  saveRelation: (relation: Relation) => Promise<void>;
  deleteRelation: (id: string) => Promise<void>;
  
  tags: Tag[];
  entityTags: EntityTag[];
  fetchTags: () => Promise<void>;
  fetchEntityTags: () => Promise<void>;
  addEntityTag: (entityId: string, tagName: string) => Promise<void>;
  removeEntityTag: (entityId: string, tagId: string) => Promise<void>;

  mapMarkers: MapMarker[];
  fetchMapMarkers: () => Promise<void>;
  saveMapMarker: (marker: MapMarker) => Promise<void>;
  deleteMapMarker: (id: string) => Promise<void>;

  maps: WorldMap[];
  fetchMaps: () => Promise<void>;
  saveMap: (map: WorldMap) => Promise<void>;
  deleteMap: (id: string) => Promise<void>;

  events: TimelineEvent[];
  fetchEvents: () => Promise<void>;
  saveEventDate: (entityId: string, numericDate: number) => Promise<void>;

  folders: Folder[];
  fetchFolders: () => Promise<void>;
  saveFolder: (folder: Folder) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  entities: [],
  loading: false,

  fetchEntities: async () => {
    set({ loading: true });
    try {
      const data = await api.getEntities();
      set({ entities: data, loading: false });
      
      // Also fetch tags automatically when entities load
      await get().fetchTags();
      await get().fetchEntityTags();
      await get().fetchFolders();
    } catch (err) {
      console.error(err);
      set({ loading: false });
    }
  },

  saveEntity: async (entity) => {
    try {
      await api.saveEntity(entity);

      // Auto-create relations based on [[Wiki-links]]
      if (entity.content) {
        const currentEntities = get().entities;
        const currentRelations = get().relations;
        
        // Regex to match [[Entity Name]]
        const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        
        while ((match = wikiLinkRegex.exec(entity.content)) !== null) {
          const matchedName = match[1].trim();
          
          // Find if an entity with this exact name exists
          const targetEntity = currentEntities.find(
            e => e.name.toLowerCase() === matchedName.toLowerCase() && e.id !== entity.id
          );
          
          if (targetEntity) {
            // Check if this relation already exists (in either direction)
            const relationExists = currentRelations.some(
              r => (r.source_entity_id === entity.id && r.target_entity_id === targetEntity.id) ||
                   (r.source_entity_id === targetEntity.id && r.target_entity_id === entity.id)
            );
            
            if (!relationExists) {
              const newRelation: Relation = {
                id: crypto.randomUUID(),
                source_entity_id: entity.id,
                target_entity_id: targetEntity.id,
                relation_type: 'mentioned',
                description: `Mentioned in ${entity.name}'s content`
              };
              await api.saveRelation(newRelation);
            }
          }
        }
      }

      await get().fetchEntities();
      await get().fetchRelations(); // Ensure relations are updated
    } catch (err) {
      console.error(err);
    }
  },

  deleteEntity: async (id) => {
    try {
      await api.deleteEntity(id);
      await get().fetchEntities(); // Relies on full refresh for now
    } catch (err) {
      console.error(err);
    }
  },

  relations: [],
  fetchRelations: async () => {
    try {
      const data = await api.getRelations();
      set({ relations: data });
    } catch (err) {
      console.error(err);
    }
  },

  saveRelation: async (relation) => {
    try {
      await api.saveRelation(relation);
      await get().fetchRelations();
    } catch (err) {
      console.error(err);
    }
  },

  deleteRelation: async (id) => {
    try {
      await api.deleteRelation(id);
      await get().fetchRelations();
    } catch (err) {
      console.error(err);
    }
  },

  tags: [],
  entityTags: [],

  fetchTags: async () => {
    try {
      const data = await api.getTags();
      set({ tags: data });
    } catch (err) {
      console.error(err);
    }
  },

  fetchEntityTags: async () => {
    try {
      const data = await api.getEntityTags();
      set({ entityTags: data });
    } catch (err) {
      console.error(err);
    }
  },

  addEntityTag: async (entityId, tagName) => {
    try {
      await api.addEntityTag({ entityId, tagName });
      await get().fetchTags();
      await get().fetchEntityTags();
    } catch (err) {
      console.error(err);
    }
  },

  removeEntityTag: async (entityId, tagId) => {
    try {
      await api.removeEntityTag({ entityId, tagId });
      await get().fetchEntityTags();
    } catch (err) {
      console.error(err);
    }
  },

  mapMarkers: [],

  fetchMapMarkers: async () => {
    try {
      const data = await api.getMapMarkers();
      set({ mapMarkers: data });
    } catch (err) {
      console.error(err);
    }
  },

  saveMapMarker: async (marker) => {
    try {
      await api.saveMapMarker(marker);
      await get().fetchMapMarkers();
    } catch (err) {
      console.error(err);
    }
  },

  deleteMapMarker: async (id) => {
    try {
      await api.deleteMapMarker(id);
      await get().fetchMapMarkers();
    } catch (err) {
      console.error(err);
    }
  },

  maps: [],

  fetchMaps: async () => {
    try {
      const data = await api.getMaps();
      set({ maps: data });
    } catch (err) {
      console.error(err);
    }
  },

  saveMap: async (map) => {
    try {
      await api.saveMap(map);
      await get().fetchMaps();
    } catch (err) {
      console.error(err);
    }
  },

  deleteMap: async (id) => {
    try {
      await api.deleteMap(id);
      await get().fetchMaps();
    } catch (err) {
      console.error(err);
    }
  },

  events: [],

  fetchEvents: async () => {
    try {
      const data = await api.getEvents();
      set({ events: data });
    } catch (err) {
      console.error(err);
    }
  },

  saveEventDate: async (entityId, numericDate) => {
    try {
      await api.saveEventDate({ entity_id: entityId, numeric_date: numericDate });
      await get().fetchEvents();
    } catch (err) {
      console.error(err);
    }
  },

  folders: [],

  fetchFolders: async () => {
    try {
      const data = await api.getFolders();
      set({ folders: data });
    } catch (err) {
      console.error(err);
    }
  },

  saveFolder: async (folder) => {
    try {
      await api.saveFolder(folder);
      await get().fetchFolders();
    } catch (err) {
      console.error(err);
    }
  },

  deleteFolder: async (id) => {
    try {
      await api.deleteFolder(id);
      await get().fetchFolders();
    } catch (err) {
      console.error(err);
    }
  }
}));
