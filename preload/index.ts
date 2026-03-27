import { contextBridge, ipcRenderer } from 'electron';

export const api = {
  getEntities: () => ipcRenderer.invoke('get-entities'),
  saveEntity: (entity: any) => ipcRenderer.invoke('save-entity', entity),
  deleteEntity: (id: string) => ipcRenderer.invoke('delete-entity', id),
  getRelations: () => ipcRenderer.invoke('get-relations'),
  saveRelation: (relation: any) => ipcRenderer.invoke('save-relation', relation),
  deleteRelation: (id: string) => ipcRenderer.invoke('delete-relation', id),
  getTags: () => ipcRenderer.invoke('get-tags'),
  getEntityTags: () => ipcRenderer.invoke('get-entity-tags'),
  addEntityTag: (data: { entityId: string, tagName: string }) => ipcRenderer.invoke('add-entity-tag', data),
  removeEntityTag: (data: { entityId: string, tagId: string }) => ipcRenderer.invoke('remove-entity-tag', data),
  getMapMarkers: () => ipcRenderer.invoke('get-map-markers'),
  saveMapMarker: (marker: any) => ipcRenderer.invoke('save-map-marker', marker),
  deleteMapMarker: (id: string) => ipcRenderer.invoke('delete-map-marker', id),
  getMaps: () => ipcRenderer.invoke('get-maps'),
  saveMap: (map: any) => ipcRenderer.invoke('save-map', map),
  deleteMap: (id: string) => ipcRenderer.invoke('delete-map', id),
  getEvents: () => ipcRenderer.invoke('get-events'),
  saveEventDate: (data: { entity_id: string, numeric_date: number }) => ipcRenderer.invoke('save-event-date', data),
  getFolders: () => ipcRenderer.invoke('get-folders'),
  saveFolder: (folder: any) => ipcRenderer.invoke('save-folder', folder),
  deleteFolder: (id: string) => ipcRenderer.invoke('delete-folder', id),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
