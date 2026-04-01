// This file provides helpers that manage state living only in the UI.
// They are intended for demo purposes only.
//
// In a real application, the state lives outside the UI:
// in a backend, a browser API, a global store, or any other external source
// that is the source of truth. In that case the UI does not explicitly hold
// mutation methods — it only reflects an external state that it does not
// control directly. The helpers below are a shortcut to simulate that
// external state inside the UI when building isolated demos.

import { useRef, useState } from "preact/hooks";

export const useRowsState = (initialRows, properties) => {
  const [rows, setRows] = useState(initialRows);

  const methodsRef = useRef(null);
  const propertiesRef = useRef(properties);
  propertiesRef.current = properties;
  let methods = methodsRef.current;
  if (!methods) {
    const setCell = ({ rowIndex, columnIndex }, value) => {
      const properties = propertiesRef.current;
      const prop = properties[columnIndex];
      setRows((prev) => {
        const resolved = rowIndex < 0 ? prev.length + rowIndex : rowIndex;
        if (resolved < 0 || resolved >= prev.length) return prev;
        const result = [];
        let i = 0;
        while (i < prev.length) {
          if (i === resolved) {
            result.push({ ...prev[i], [prop]: value });
          } else {
            result.push(prev[i]);
          }
          i++;
        }
        return result;
      });
    };
    const addRow = (newRow, rowIndex = rows.length) => {
      setRows((prev) => {
        // negative counts from end, beyond length appends — like splice
        let insertAt = rowIndex < 0 ? prev.length + rowIndex : rowIndex;
        if (insertAt < 0) insertAt = 0;
        if (insertAt > prev.length) insertAt = prev.length;
        const result = [];
        let i = 0;
        while (i < prev.length) {
          if (i === insertAt) {
            result.push(newRow);
          }
          result.push(prev[i]);
          i++;
        }
        if (insertAt === prev.length) {
          result.push(newRow);
        }
        return result;
      });
    };
    const deleteRow = (rowIndex) => {
      setRows((prev) => {
        const resolved = rowIndex < 0 ? prev.length + rowIndex : rowIndex;
        if (resolved < 0 || resolved >= prev.length) return prev;
        const result = [];
        let i = 0;
        while (i < prev.length) {
          if (i !== resolved) {
            result.push(prev[i]);
          }
          i++;
        }
        return result;
      });
    };
    methods = methodsRef.current = {
      setCell,
      addRow,
      deleteRow,
    };
  }
  return [rows, methods];
};
