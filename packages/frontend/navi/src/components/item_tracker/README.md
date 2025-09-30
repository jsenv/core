# Item Tracker

A Preact hook system for tracking dynamic lists without infinite re-renders, designed for complex component hierarchies where item registration and consumption are separated.

## The Problem

In React/Preact, you can compose components beautifully:

```jsx
// Simple composition works great
<Table>
  <TableRow>
    <TableCell>Name</TableCell>
    <TableCell>Email</TableCell>
  </TableRow>
</Table>
```

But when components need to share state across complex hierarchies, traditional approaches break down. Consider HTML tables where structure matters:

```jsx
<table>
  <colgroup>
    <col style={{ width: "200px" }} /> {/* Column definitions */}
    <col style={{ width: "300px" }} />
  </colgroup>
  <tbody>
    <tr>
      <td>John</td> {/* Cells need column metadata */}
      <td>john@example.com</td>
    </tr>
  </tbody>
</table>
```

**The core problem**: `<col>` elements define column metadata, but `<td>` elements (which aren't descendants of `<col>`) need access to that same metadata for styling, accessibility, and behavior.

This creates a challenge: How do you share data between components that aren't in a parent-child relationship?

## Common Solutions (And Their Problems)

### Option 1: Lift State Up

Move all data to a common parent:

```jsx
function Table({ columns, data }) {
  return (
    <table>
      <colgroup>
        {columns.map(col => <col key={col.id} style={{ width: col.width }} />)}
      </colgroup>
      <tbody>
        {data.map(row => (
          <tr key={row.id}>
            {columns.map(col => (
              <td key={col.id} className={col.cellClass}>
                {row[col.id]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Problems:**
- Kills composition - everything must be configured through props
- Complex APIs with render props or configuration objects
- Difficult to customize individual cells or columns
- No flexibility for conditional rendering or dynamic behavior

### Option 2: Context with State

Use React Context to share state:

```jsx
const ColumnContext = createContext();

function Table({ children }) {
  const [columns, setColumns] = useState([]);
  return (
    <ColumnContext.Provider value={{ columns, setColumns }}>
      <table>{children}</table>
    </ColumnContext.Provider>
  );
}

function Column({ width, ...props }) {
  const { setColumns } = useContext(ColumnContext);
  
  // ❌ This causes infinite re-renders!
  setColumns(prev => [...prev, { width, ...props }]);
  
  return <col style={{ width }} />;
}
```

**Problems:**
- **Infinite re-render loops**: Calling state setters during render creates endless cycles
- Context updates trigger re-renders of all consumers
- No control over when synchronization happens
- Difficult to handle dynamic lists (add/remove items)

## Our Solution: Producer/Consumer Architecture

We provide two complementary systems:

### 1. Simple Item Tracker (Colocated)

For scenarios where registration and consumption happen in the same component tree:

```jsx
import { createItemTracker } from "./use_item_tracker.jsx";

const [useRowTrackerProvider, useRegisterRow, useRow, useRows] = createItemTracker();

function App() {
  const RowTrackerProvider = useRowTrackerProvider();
  
  return (
    <RowTrackerProvider>
      <table>
        <tbody>
          {rows.map(data => (
            <TableRow key={data.id} data={data}>
              <TableCell column="name" />
              <TableCell column="email" />
            </TableRow>
          ))}
        </tbody>
      </table>
    </RowTrackerProvider>
  );
}

function TableRow({ data, children }) {
  const rowIndex = useRegisterRow(data);
  return (
    <RowContext.Provider value={rowIndex}>
      <tr>{children}</tr>
    </RowContext.Provider>
  );
}

function TableCell({ column }) {
  const rowIndex = useContext(RowContext);
  const rowData = useRow(rowIndex);
  return <td>{rowData[column]}</td>;
}
```

### 2. Isolated Item Tracker (Separated Trees)

For complex scenarios where registration and consumption are in completely separate component trees:

```jsx
import { createIsolatedItemTracker } from "./use_item_tracker_isolated.jsx";

const [useColumnTrackerProviders, useRegisterColumn, useColumn, useColumns] = 
  createIsolatedItemTracker();

function App() {
  const [ColumnProducerProvider, ColumnConsumerProvider] = useColumnTrackerProviders();
  
  return (
    <div>
      {/* Producer tree: Registers column data */}
      <ColumnProducerProvider>
        <table>
          <colgroup>
            {columns.map(col => (
              <ColumnDefinition key={col.id} {...col} />
            ))}
          </colgroup>
          {/* Table content */}
        </table>
      </ColumnProducerProvider>
      
      {/* Consumer tree: Reads column data */}
      <ColumnConsumerProvider>
        <TableControls />
        <ColumnSummary />
      </ColumnConsumerProvider>
    </div>
  );
}

function ColumnDefinition({ id, label, width, sortable }) {
  const columnIndex = useRegisterColumn({ id, label, width, sortable });
  return <col style={{ width }} />;
}

function TableControls() {
  const columns = useColumns(); // Access all columns
  return (
    <div>
      {columns.map((col, index) => (
        <ColumnToggle key={col.id} columnIndex={index} />
      ))}
    </div>
  );
}

function ColumnToggle({ columnIndex }) {
  const column = useColumn(columnIndex); // Access specific column
  return (
    <button>
      Toggle {column.label} ({column.width})
    </button>
  );
}
```

## Key Architecture Benefits

### ✅ No Infinite Re-renders

**Producer side uses refs** - Item registration doesn't trigger re-renders:
```jsx
// This is safe - no state updates during render
const index = useRegisterItem(data);
```

**Consumer side uses state** - Only consumers re-render when data changes:
```jsx
// Only this component re-renders when items change
const items = useTrackedItems();
```

### ✅ True Component Composition

Register items anywhere in the producer tree:
```jsx
<ColumnProducerProvider>
  <div>
    <SomeWrapper>
      <ColumnDefinition id="name" width="200px" />
    </SomeWrapper>
  </div>
  <AnotherComponent>
    <ColumnDefinition id="email" width="300px" />
  </AnotherComponent>
</ColumnProducerProvider>
```

Consume items anywhere in the consumer tree:
```jsx
<ColumnConsumerProvider>
  <Header>
    <ColumnSummary /> {/* Reads all columns */}
  </Header>
  <Sidebar>
    <ColumnFilter columnIndex={0} /> {/* Reads specific column */}
  </Sidebar>
</ColumnConsumerProvider>
```

### ✅ Controlled Synchronization

The isolated tracker synchronizes data at controlled moments:
- After producer tree renders completely
- Before consumer tree renders
- No intermediate state or partial updates

### ✅ Handles Dynamic Lists

Add, remove, and reorder items without breaking:
```jsx
// Columns can be added/removed dynamically
{dynamicColumns.map(col => 
  <ColumnDefinition key={col.id} {...col} />
)}
```

## When to Use Which System

### Use Simple Item Tracker when:
- Registration and consumption happen in the same component tree
- Parent-child relationships exist between producers and consumers
- You need a straightforward, lightweight solution

**Examples:**
- Table rows registering themselves for cell access
- Navigation items registering for keyboard navigation
- Form fields registering for validation

### Use Isolated Item Tracker when:
- Registration and consumption happen in separate component trees
- No parent-child relationship exists between producers and consumers
- You need complex synchronization between distant components

**Examples:**
- HTML table colgroup → tbody communication
- Sidebar filters reading main content structure
- Toolbar controls accessing editor content
- Dashboard widgets reading data source definitions

## HTML Table Use Case (Primary Motivation)

The isolated tracker was specifically designed for HTML table structures:

```jsx
<table>
  {/* PRODUCER: Column definitions register metadata */}
  <ColumnProducerProvider>
    <colgroup>
      <ColumnDefinition 
        id="name" 
        label="Full Name" 
        width="200px" 
        sortable={true}
        filterable={true}
      />
      <ColumnDefinition 
        id="email" 
        label="Email Address" 
        width="300px" 
        sortable={true}
        filterable={false}
      />
    </colgroup>
  </ColumnProducerProvider>
  
  {/* CONSUMER: Table cells read column metadata */}
  <ColumnConsumerProvider>
    <thead>
      <tr>
        <TableHeader columnIndex={0} /> {/* Reads name column */}
        <TableHeader columnIndex={1} /> {/* Reads email column */}
      </tr>
    </thead>
    <tbody>
      {data.map(row => (
        <tr key={row.id}>
          <TableCell columnIndex={0} value={row.name} />
          <TableCell columnIndex={1} value={row.email} />
        </tr>
      ))}
    </tbody>
  </ColumnConsumerProvider>
</table>
```

This enables:
- **Semantic HTML structure** - Proper `<colgroup>` usage
- **Column metadata sharing** - Headers and cells access the same data
- **Dynamic column management** - Add/remove columns without breaking
- **Rich interactions** - Sorting, filtering, resizing based on column config
- **Accessibility** - ARIA attributes based on column metadata

## API Reference

### Simple Item Tracker

```jsx
const [
  useItemTrackerProvider,  // () => Provider component
  useTrackItem,           // (data) => index
  useTrackedItem,         // (index) => data
  useTrackedItems         // () => data[]
] = createItemTracker();
```

### Isolated Item Tracker

```jsx
const [
  useItemTrackerProviders, // () => [ProducerProvider, ConsumerProvider]
  useRegisterItem,        // (data) => index (use in producer)
  useTrackedItem,         // (index) => data (use in consumer)
  useTrackedItems         // () => data[] (use in consumer)
] = createIsolatedItemTracker();
```

## Performance Characteristics

- **Producer registration**: O(1) - No re-renders, direct ref updates
- **Consumer access**: O(1) - Direct array access by index
- **Synchronization**: O(n) - One-time copy from refs to state
- **Memory**: O(n) - Stores one copy in refs, one copy in state during sync

## Browser Support

Requires modern JavaScript features:
- ES Modules
- Preact/React hooks
- `useLayoutEffect` for synchronization timing

Compatible with all modern browsers and Node.js environments.