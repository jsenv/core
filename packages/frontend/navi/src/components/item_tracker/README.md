# Item Tracker

A Preact hook system for tracking dynamic lists, designed to prevent infinite re-renders while enabling component composition similar to native HTML elements.

## The Problem

In React/Preact, you can wrap elements into components while maintaining the same compositional flexibility:

```jsx
// Native HTML
<select>
  <option>Eastern</option>
  <option>Central</option>
  <option disabled>Mountain</option>
  <option className="highlighted">Pacific</option>
</select>

// Component abstraction - same flexibility
<TimezoneSelect>
  <TimezoneOption value="est">Eastern</TimezoneOption>
  <TimezoneOption value="cst">Central</TimezoneOption>
  <TimezoneOption value="mst" disabled>Mountain</TimezoneOption>
  <TimezoneOption value="pst" className="highlighted">Pacific</TimezoneOption>
</TimezoneSelect>
```

However, when building components that need to coordinate between children, the parent component needs to know about its children's properties.

Consider a table where column definitions need to be shared with table cells:

```jsx
// Desired API - clean composition
<Table>
  <colgroup>
    <Col id="name" width="200px" sortable />
    <Col id="email" width="300px" resizable />
    <Col id="status" width="100px" />
  </colgroup>
  <tbody>
    <tr>
      <Cell column="name">{user.name}</Cell>
      <Cell column="email">{user.email}</Cell>
      <Cell column="status">{user.status}</Cell>
    </tr>
  </tbody>
</Table>
```

The challenge: `<Cell>` components need access to column configuration defined by `<Col>` components, but they're not in a parent-child relationship.

## Alternative Approaches

Most libraries use configuration objects instead of components:

```jsx
<Table
  columns={[
    { id: "name", width: "200px", sortable: true },
    { id: "email", width: "300px", resizable: true },
    { id: "status", width: "100px" },
  ]}
  data={tableData}
/>
```

This approach works but requires complex APIs when you need to customize individual columns:

```jsx
<Table
  columns={columns}
  getColumnProps={(column, index) => {
    if (column.id === "email") return { className: "email-column" };
    return {};
  }}
  cellRenderers={{
    email: (value) => value.toLowerCase(),
  }}
/>
```

With component composition, the same customization is more straightforward:

```jsx
<Table>
  <Colgroup>
    <Col id="name" width="200px" sortable />
    <Col id="email" width="300px" resizable className="email-column" />
    <Col id="status" width="100px" />
  </Colgroup>
  <Tbody>
    <Tr>
      <TableCell column="name">{user.name}</TableCell>
      <TableCell column="email">{user.email.toLowerCase()}</TableCell>
      <TableCell column="status">{user.status}</TableCell>
    </Tr>
  </Tbody>
</Table>
```

The problem is: how does the parent component discover its children's properties without causing infinite re-renders?

## Our Solution

The Item Tracker provides hooks that enable component composition while preventing infinite re-renders. It offers two approaches depending on your component structure:

**For library authors**, the system provides hooks to build components with clean APIs:

```jsx
// Internal implementation
function Table({ children }) {
  const ColTrackerProvider = useItemTrackerProvider();

  return (
    <ColTrackerProvider>
      <Table>
        <TableHeaders /> {/* Reads column data */}
        <Tbody>{children}</Tbody>
      </Table>
    </ColTrackerProvider>
  );
}

function Col({ id, width, sortable, ...props }) {
  const colIndex = useTrackItem({ id, width, sortable, ...props });
  return <col style={{ width }} />;
}

function TableCell({ column, children }) {
  const columns = useTrackedItems();
  const colData = columns.find((col) => col.id === column);
  return <td style={{ width: colData.width }}>{children}</td>;
}
```

**For end users**, this enables clean, component-based APIs:

```jsx
// User-facing API
<Table>
  <Colgroup>
    <Col id="name" width="200px" sortable className="name-col" />
    <Col id="email" width="300px" resizable />
    <Col id="status" width="100px" />
  </Colgroup>
  <Tbody>
    <Tr>
      <TableCell column="name">{user.name}</TableCell>
      <TableCell column="email">{user.email}</TableCell>
      <TableCell column="status">{user.status}</TableCell>
    </Tr>
  </Tbody>
</Table>
```

Key features:

- **Prevents infinite re-renders** through ref-based item registration
- **Enables true composition** - items can be registered anywhere in the component tree
- **No configuration objects** - each component configures itself through props
- **Dynamic lists** - supports adding, removing, and reordering items

## Two Systems for Different Use Cases

We provide two complementary systems:

### 1. Simple Item Tracker (Colocated)

For scenarios where registration and consumption happen in the same component tree:

```jsx
import { createItemTracker } from "./use_item_tracker.jsx";

const [useRowTrackerProvider, useRegisterRow, useRow, useRows] =
  createItemTracker();

function App() {
  const RowTrackerProvider = useRowTrackerProvider();

  return (
    <RowTrackerProvider>
      <table>
        <tbody>
          {rows.map((data) => (
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
  const [ColumnProducerProvider, ColumnConsumerProvider] =
    useColumnTrackerProviders();

  return (
    <div>
      {/* Producer tree: Registers column data */}
      <Table>
        <Colgroup>
          <ColumnProducerProvider>
            {columns.map((col) => (
              <Col key={col.id} {...col} />
            ))}
          </ColumnProducerProvider>
        </Colgroup>
        {/* Table content */}
      </Table>

      {/* Consumer tree: Reads column data */}
      <ColumnConsumerProvider>
        <TableControls />
        <ColumnSummary />
      </ColumnConsumerProvider>
    </div>
  );
}

function Col({ id, label, width, sortable }) {
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
      <Col id="name" width="200px" />
    </SomeWrapper>
  </div>
  <AnotherComponent>
    <Col id="email" width="300px" />
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
{
  dynamicColumns.map((col) => <ColumnDefinition key={col.id} {...col} />);
}
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
<Table>
  {/* PRODUCER: Column definitions register metadata */}
  <ColumnProducerProvider>
    <Colgroup>
      <Col
        id="name"
        label="Full Name"
        width="200px"
        sortable={true}
        filterable={true}
      />
      <Col
        id="email"
        label="Email Address"
        width="300px"
        sortable={true}
        filterable={false}
      />
    </Colgroup>
  </ColumnProducerProvider>

  {/* CONSUMER: Table cells read column metadata */}
  <ColumnConsumerProvider>
    <Thead>
      <Tr>
        <TableCell columnIndex={0} /> {/* Reads name column */}
        <TableCell columnIndex={1} /> {/* Reads email column */}
      </Tr>
    </Thead>
    <Tbody>
      {data.map((row) => (
        <Tr key={row.id}>
          <TableCell columnIndex={0} value={row.name} />
          <TableCell columnIndex={1} value={row.email} />
        </Tr>
      ))}
    </Tbody>
  </ColumnConsumerProvider>
</Table>
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
  useItemTrackerProvider, // () => Provider component
  useTrackItem, // (data) => index
  useTrackedItem, // (index) => data
  useTrackedItems, // () => data[]
] = createItemTracker();
```

### Isolated Item Tracker

```jsx
const [
  useItemTrackerProviders, // () => [ProducerProvider, ConsumerProvider]
  useRegisterItem, // (data) => index (use in producer)
  useTrackedItem, // (index) => data (use in consumer)
  useTrackedItems, // () => data[] (use in consumer)
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
