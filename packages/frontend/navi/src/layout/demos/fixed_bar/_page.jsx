// A few rows: enough for the bars to have something to sit over, short enough
// that a demo screen stays small.
export const rows = (count = 6) =>
  Array.from({ length: count }, (_, index) => (
    <div key={index} className="row">
      Row {index + 1}
    </div>
  ));
