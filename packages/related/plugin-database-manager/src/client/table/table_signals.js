import { signal } from "@preact/signals";
import { tableStore } from "./table_store.js";

const tableCountSignal = signal(null);
export const useTableCount = () => {
  return tableCountSignal.value;
};
export const setTableCount = (value) => {
  tableCountSignal.value = value;
};

export const useTableList = () => {
  return tableStore.arraySignal.value;
};
export const useTable = (tablename) => {
  return tableStore.select("tablename", tablename);
};

const activeTableIdSignal = signal(null);
export const useActiveTable = () => {
  const activeTableId = activeTableIdSignal.value;
  const activeTable = tableStore.select(activeTableId);
  return activeTable;
};
export const setActiveTable = (table) => {
  table = tableStore.upsert(table);
  activeTableIdSignal.value = table.oid;
};
const activeTableColumnsSignal = signal([]);
export const useActiveTableColumns = () => {
  return activeTableColumnsSignal.value;
};
export const setActiveTableColumns = (value) => {
  activeTableColumnsSignal.value = value;
};
