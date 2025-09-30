# Item Tracker

A Preact hook system for tracking dynamic lists without infinite re-renders, designed to enable true component composition where components work like native HTML elements.

## The Problem

In React/Preact, you can wrap up any elements into a component and then render the new component instead. It's beautiful:

```jsx
// Native HTML - you can style and configure each option individually
<select>
  <option>Eastern</option>
  <option>Central</option>
  <option disabled>Mountain</option>
  <option className="highlighted">Pacific</option>
</select>

// Component abstraction - same flexibility!
<TimezoneSelect>
  <TimezoneOption value="est">Eastern</TimezoneOption>
  <TimezoneOption value="cst">Central</TimezoneOption>
  <TimezoneOption value="mst" disabled>Mountain</TimezoneOption>
  <TimezoneOption value="pst" className="highlighted">Pacific</TimezoneOption>
</TimezoneSelect>
```

Everything works perfectly! You get the same composition and flexibility as native elements.

But when we want to create more sophisticated components that need to coordinate between children, we hit a wall.

Consider a data table where we want the same compositional freedom:

```jsx
// What we want to write (clean composition)
<DataTable>
  <Column id="name" width="200px" sortable>
    Name
  </Column>
  <Column id="email" width="300px" resizable>
    Email Address
  </Column>
  <Column id="status" width="100px" filterable={false}>
    Status
  </Column>
</DataTable>
```

The `DataTable` needs to know about its columns to render headers, handle sorting, manage column widths, etc. Each `Column` needs to be able to configure itself independently, just like native HTML elements.

But here's the problem: **how does the parent `DataTable` know what columns exist and what their properties are?**

### The Pain of Current Solutions

Most libraries force you to abandon composition and use configuration objects instead:

```jsx
// What we're forced to write (configuration hell)
<DataTable
  columns={[
    { id: "name", label: "Name", width: "200px", sortable: true },
    { id: "email", label: "Email Address", width: "300px", resizable: true },
    { id: "status", label: "Status", width: "100px", filterable: false },
  ]}
/>
```

This works, but you lose all the flexibility. What if you want to customize just one column?

```jsx
// Trying to customize individual columns leads to API hell
<DataTable
  columns={[
    { id: "name", label: "Name", width: "200px", sortable: true },
    {
      id: "email",
      label: "Email Address",
      width: "300px",
      resizable: true,
      // Need special styling for this one column? Tough luck!
      className: "email-column",
      onHeaderClick: handleEmailHeaderClick,
      cellRenderer: (value) => <EmailCell value={value} />,
      headerRenderer: () => <EmailHeader />,
    },
    { id: "status", label: "Status", width: "100px", filterable: false },
  ]}
/>
```

Soon you need escape hatches for everything:

```jsx
<DataTable
  columns={columns}
  columnClassNames={["", "email-column", ""]}
  onColumnHeaderClick={[null, handleEmailHeaderClick, null]}
  cellRenderers={[null, EmailCellRenderer, null]}
  headerRenderers={[null, EmailHeaderRenderer, null]}
  getColumnProps={(column, index) => {
    if (index === 1) return { "aria-label": "Email addresses" };
    return {};
  }}
  renderColumn={(column, index) => {
    if (index === 1) {
      return <SpecialEmailColumn {...column} />;
    }
    return <DefaultColumn {...column} />;
  }}
/>
```

**This is insane!** We went from simple, composable components to a configuration nightmare with dozens of escape hatches.

Compare this to what we want - the same simplicity as native HTML:

```jsx
// What we actually want (true composition)
<DataTable>
  <Column id="name" width="200px" sortable>
    Name
  </Column>
  <Column
    id="email"
    width="300px"
    resizable
    className="email-column"
    onHeaderClick={handleEmailHeaderClick}
    aria-label="Email addresses"
  >
    <EmailHeader />
    {/* Custom cell rendering */}
    {(value) => <EmailCell value={value} />}
  </Column>
  <Column id="status" width="100px" filterable={false}>
    Status
  </Column>
</DataTable>
```

**This is the goal:** Components that work like native elements, where you can configure each child individually without forcing the parent to know about every possible customization.

The problem is: how does the parent component (`DataTable`) discover its children (`Column`) and their properties without breaking React's rendering rules?

## Common Solutions (And Why They Fail)

### Option 1: Give Up on Composition (Most Common)

The solution most people turn to is to bail out of the element API and turn to configuration arrays:

```jsx
// Instead of composable elements...
<DataTable
  columns={[
    { id: "name", label: "Name", width: "200px", sortable: true },
    { id: "email", label: "Email Address", width: "300px", resizable: true },
    { id: "status", label: "Status", width: "100px", filterable: false },
  ]}
  data={tableData}
/>
```

This makes the implementation easier because a single owner controls all the state and rendering. It's way easier to know the column index and handle interactions when everything is in one place.

But you lose composition. What happens when you want to add a `className` to one column? Or custom rendering for just the email column? You end up with increasingly complex APIs:

```jsx
<DataTable
  columns={columns}
  // More and more escape hatches...
  columnClassNames={["", "email-special", ""]}
  getColumnProps={(column, index) => {
    if (index === 1) return { "aria-label": "Email addresses" };
    return {};
  }}
  cellRenderers={{
    email: (value) => <EmailCell value={value} />,
  }}
  headerRenderers={{
    email: () => <CustomEmailHeader />,
  }}
  // The API keeps growing...
  onColumnResize={handleColumnResize}
  onColumnSort={handleColumnSort}
  renderColumnFilter={(column) => <ColumnFilter column={column} />}
/>
```

Because the rendering is in the same owner as the state, we have to poke holes in the component to change anything about how it renders.

All that complexity, just so the `DataTable` knows what columns exist!

Had we stuck to elements, we could have done this:

```jsx
<DataTable>
  <Column id="name" width="200px" sortable>
    Name
  </Column>
  <Column
    id="email"
    width="300px"
    resizable
    className="email-special"
    aria-label="Email addresses"
  >
    <CustomEmailHeader />
    {(value) => <EmailCell value={value} />}
  </Column>
  <Column id="status" width="100px" filterable={false}>
    Status
  </Column>
</DataTable>
```

But how will the `DataTable` know about its columns?

### Option 2: `cloneElement` and Type Checking

We can use `React.cloneElement` to keep composition while passing data to children:

```jsx
function DataTable({ children }) {
  const [sortedColumn, setSortedColumn] = useState(null);

  return (
    <table>
      <thead>
        <tr>
          {React.Children.map(children, (child, index) =>
            React.cloneElement(child, {
              index,
              sortedColumn,
              onSort: setSortedColumn,
            }),
          )}
        </tr>
      </thead>
    </table>
  );
}

function Column({ index, sortedColumn, onSort, children, ...props }) {
  const isSorted = index === sortedColumn;
  return (
    <th onClick={() => onSort(index)} data-sorted={isSorted}>
      {children}
    </th>
  );
}
```

This preserves composition, but it's fragile. What if you want to wrap a column?

```jsx
<DataTable>
  <div className="column-group">
    <Column>Name</Column> {/* This breaks - we clone the div, not the Column */}
  </div>
  <Column>Email</Column>
</DataTable>
```

You could recurse down and type-check, but it gets complex fast and limits composition.

### Option 3: Context with State (Infinite Re-renders)

Use React Context to let children register themselves:

```jsx
const ColumnContext = createContext();

function DataTable({ children }) {
  const [columns, setColumns] = useState([]);

  return (
    <ColumnContext.Provider value={{ columns, setColumns }}>
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.id}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{/* ... */}</tbody>
      </table>
      {children} {/* Columns register themselves */}
    </ColumnContext.Provider>
  );
}

function Column({ id, label, width }) {
  const { setColumns } = useContext(ColumnContext);

  // ❌ This creates infinite re-render loops!
  setColumns((prev) => [...prev, { id, label, width }]);

  return null; // Or maybe <col style={{ width }} />
}
```

**Problem:** Calling state setters during render causes infinite re-render loops. The state update triggers a re-render, which calls the setter again, forever.

## Our Solution: Enable True Component Composition

The Item Tracker system solves this by providing the infrastructure that UI library authors need to build components that work like native HTML elements.

**For end users**, this means they can write clean, composable code:

```jsx
// End users write simple, native-like component code
<DataTable>
  <Column id="name" width="200px" sortable className="name-col">
    Name
  </Column>
  <Column id="email" width="300px" resizable onHeaderClick={handleEmailClick}>
    Email Address
  </Column>
  <Column id="status" width="100px">
    Status
  </Column>
</DataTable>
```

**For library authors**, the Item Tracker provides the hooks to make this work internally:

```jsx
// Library implementation (internal)
function DataTable({ children }) {
  const ColumnTrackerProvider = useItemTrackerProvider();

  return (
    <ColumnTrackerProvider>
      <table>
        <thead>
          <tr>
            <TableHeaders />
          </tr>
        </thead>
        <tbody>{/* ... */}</tbody>
      </table>
      {children} {/* Columns register themselves safely */}
    </ColumnTrackerProvider>
  );
}

function Column({ id, label, width, sortable, className, ...props }) {
  const columnIndex = useTrackItem({
    id,
    label,
    width,
    sortable,
    className,
    ...props,
  });
  return <col style={{ width }} />;
}

function TableHeaders() {
  const columns = useTrackedItems();
  return (
    <>
      {columns.map((col, index) => (
        <th key={col.id} className={col.className}>
          {col.label}
          {col.sortable && <SortIcon />}
        </th>
      ))}
    </>
  );
}
```

The magic is that:

1. **No infinite re-renders** - Item registration uses refs, not state
2. **True composition** - Columns can be anywhere in the tree, wrapped in any elements
3. **Clean APIs** - No configuration objects or escape hatches needed
4. **Native-like behavior** - Components work just like HTML elements

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
      <table>
        <colgroup>
          <ColumnProducerProvider>
            {columns.map((col) => (
              <ColumnDefinition key={col.id} {...col} />
            ))}
          </ColumnProducerProvider>
        </colgroup>
        {/* Table content */}
      </table>

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
      {data.map((row) => (
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
