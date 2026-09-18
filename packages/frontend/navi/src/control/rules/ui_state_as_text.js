// The characters a ui state holds, for the rules that read a value as text
// (length, pattern, number, email…). `undefined` and `null` both hold none:
// `String(null)` would hand those rules the four letters "null" — a number
// field cleared with `value={null}` then reported "must be a number".
export const uiStateAsText = (uiState) => {
  if (uiState === undefined || uiState === null) {
    return "";
  }
  return String(uiState);
};
