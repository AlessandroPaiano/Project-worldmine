"use strict";
const electron = require("electron");
const api = {
  getEntities: () => electron.ipcRenderer.invoke("get-entities"),
  saveEntity: (entity) => electron.ipcRenderer.invoke("save-entity", entity),
  deleteEntity: (id) => electron.ipcRenderer.invoke("delete-entity", id),
  getRelations: () => electron.ipcRenderer.invoke("get-relations"),
  saveRelation: (relation) => electron.ipcRenderer.invoke("save-relation", relation),
  deleteRelation: (id) => electron.ipcRenderer.invoke("delete-relation", id),
  getTags: () => electron.ipcRenderer.invoke("get-tags"),
  getEntityTags: () => electron.ipcRenderer.invoke("get-entity-tags"),
  addEntityTag: (data) => electron.ipcRenderer.invoke("add-entity-tag", data),
  removeEntityTag: (data) => electron.ipcRenderer.invoke("remove-entity-tag", data),
  getMapMarkers: () => electron.ipcRenderer.invoke("get-map-markers"),
  saveMapMarker: (marker) => electron.ipcRenderer.invoke("save-map-marker", marker),
  deleteMapMarker: (id) => electron.ipcRenderer.invoke("delete-map-marker", id),
  getMaps: () => electron.ipcRenderer.invoke("get-maps"),
  saveMap: (map) => electron.ipcRenderer.invoke("save-map", map),
  deleteMap: (id) => electron.ipcRenderer.invoke("delete-map", id),
  getEvents: () => electron.ipcRenderer.invoke("get-events"),
  saveEventDate: (data) => electron.ipcRenderer.invoke("save-event-date", data),
  getFolders: () => electron.ipcRenderer.invoke("get-folders"),
  saveFolder: (folder) => electron.ipcRenderer.invoke("save-folder", folder),
  deleteFolder: (id) => electron.ipcRenderer.invoke("delete-folder", id)
};
electron.contextBridge.exposeInMainWorld("api", api);
