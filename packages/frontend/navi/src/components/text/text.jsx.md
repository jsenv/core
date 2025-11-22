# Text Component

The Text component is a flexible text rendering system that supports icons, overflow handling, and rich typography options. It's designed to handle complex text layouts while maintaining excellent performance and accessibility.

## Basic Usage

```jsx
import { Text } from "@jsenv/navi";

// Simple text
<Text>Hello world</Text>

// With layout features
<Text box>Text with layout capabilities</Text>

// With styling (when used with Box props)
<Text box bold color="blue">Important message</Text>
```

## Text with Icons

The Text component seamlessly integrates with the Icon component for rich text layouts.

### Basic Icon Integration

```jsx
import { Text, Icon } from "@jsenv/navi";

// Icon with text (automatic sizing and alignment)
<Text>
  <Icon>
    <HomeSvg />
  </Icon>
  Go to Home
</Text>

// Using box layout for more control
<Text box>
  <Icon>
    <CheckSvg />
  </Icon>
  Task completed
</Text>
```

### Icon with SVG Sprites

Icons support the `href` prop for referencing SVG sprites:

```jsx
<Text>
  <Icon href="#icon-home" />
  Home
</Text>
```

### Icon Positioning and Layout

```jsx
// Icon before text
<Text>
  <Icon>
    <CheckSvg />
  </Icon>
  Task completed
</Text>

// Icon after text
<Text>
  Download file
  <Icon>
    <DownloadSvg />
  </Icon>
</Text>

// Multiple icons with box layout
<Text box>
  <Icon>
    <HomeSvg />
  </Icon>
  Navigate between pages
  <Icon>
    <ArrowSvg />
  </Icon>
</Text>
```

### Icon Layout Control

Icons can use the `box` prop for advanced layout control:

```jsx
// Icon with box layout for custom styling
<Text>
  <Icon box padding="xs" backgroundColor="blue">
    <StarSvg />
  </Icon>
  Featured item
</Text>
```

## Text Overflow Handling

The Text component provides sophisticated overflow handling with ellipsis and pinned content support.

### Basic Ellipsis

```jsx
<Box width="200px">
  <Text overflowEllipsis>
    This is a very long text that will be truncated with ellipsis when it
    exceeds the container width
  </Text>
</Box>
```

### Pinned Content

The `overflowPinned` feature allows you to keep important content visible even when the main text is truncated:

```jsx
<Box width="250px">
  <Text overflowEllipsis>
    This long text will be truncated but the status remains visible
    <Text overflowPinned color="#4caf50">
      ✓ Completed
    </Text>
  </Text>
</Box>
```

### Pinned Content with Icons

Combine pinned content with icons for rich, informative displays:

```jsx
<Box width="300px">
  <Text overflowEllipsis>
    Very long filename that might be truncated in narrow containers
    <Text overflowPinned>
      <Icon>
        <FileSvg />
      </Icon>
    </Text>
  </Text>
</Box>
```

### Pinned Counts and Status

Perfect for displaying counts, badges, or status indicators:

```jsx
<Box width="200px">
  <Text overflowEllipsis>
    Long conversation title that exceeds container width
    <Text overflowPinned color="#666">
      (23 messages)
    </Text>
  </Text>
</Box>
```

## Content Spacing

Control spacing between text elements with the `contentSpacing` prop:

```jsx
// Default spacing with space character
<Text>
  <Icon><StarSvg /></Icon>
  Default spacing
</Text>

// Custom spacing
<Text contentSpacing=" • ">
  Item 1
  Item 2
  Item 3
</Text>

// Preserve exact spacing (useful for pre-formatted content)
<Text contentSpacing="pre">
  Exact   spacing   preserved
</Text>
```

## Foreground Overlays

Add foreground elements or colors over text content:

```jsx
// Foreground color overlay
<Text foregroundColor="rgba(255, 0, 0, 0.3)">
  Text with red overlay
</Text>

// Custom foreground element
<Text foregroundElement={<Icon><CheckSvg /></Icon>}>
  Text with check overlay
</Text>
```

## Component Usage Examples

### Navigation Links with Icons

```jsx
<Text as="a" href="/profile" box>
  <Icon>
    <UserSvg />
  </Icon>
  My Profile
</Text>
```

### Status Messages

```jsx
<Text>
  <Icon>
    <CheckSvg />
  </Icon>
  Password reset link sent to user@example.com
</Text>
```

### File Lists with Overflow

```jsx
<Box width="300px">
  <Text overflowEllipsis>
    <Icon>
      <DocumentSvg />
    </Icon>
    very-long-filename-that-might-be-truncated.pdf
    <Text overflowPinned color="#666">
      2.4 MB
    </Text>
  </Text>
</Box>
```

### Interactive Elements

```jsx
<Text as="button" box onClick={handleClick}>
  <Icon>
    <PlusSvg />
  </Icon>
  Add new item
</Text>
```

## CharSlot Component

The `CharSlot` component creates properly sized containers for icons and other elements:

```jsx
import { CharSlot } from "@jsenv/navi";

// Basic icon slot (1 character width)
<CharSlot decorative>
  <MyIcon />
</CharSlot>

// Custom width slot
<CharSlot charWidth={2} baseChar="W">
  <WideIcon />
</CharSlot>

// With accessibility
<CharSlot aria-label="Settings" role="img">
  <SettingsIcon />
</CharSlot>
```

## Paragraph Component

The `Paragraph` component provides semantic paragraph text with automatic spacing:

```jsx
import { Paragraph } from "@jsenv/navi";

<Paragraph>
  This is a paragraph with proper spacing and text flow.
  <Icon><StarSvg /></Icon>
  Icons are automatically spaced correctly.
</Paragraph>

<Paragraph marginTop="lg" contentSpacing=" • ">
  Custom spacing between elements
</Paragraph>
```

## Typography with Box Props

When using `box={true}`, the Text component supports Box layout and styling props:

```jsx
// Layout properties
<Text box expandX selfAlignX="center" gap="sm">
  <Icon><StarSvg /></Icon>
  Centered expanding text
</Text>

// Spacing and borders
<Text box margin="md" padding="sm" border="1px solid #ccc">
  Text with spacing and border
</Text>

// Background and styling
<Text box backgroundColor="blue" color="white" borderRadius="md">
  Styled text container
</Text>
```

## Best Practices

### When to Use `box={true}`

- When you need layout control (spacing, alignment, expansion, flex behavior)
- For interactive text elements (buttons, links with complex styling)
- When combining with Box layout props (margins, padding, backgrounds)

### Icon Guidelines

- Icons automatically size to match text and align properly
- Use `href` prop for SVG sprite icons to improve performance
- Icons inherit text color by default but can be styled independently with Box props when using `box={true}`
- Use `CharSlot` for precise icon sizing and accessibility

### Overflow Handling

- Use `overflowEllipsis` for content that might exceed container width
- Use `overflowPinned` for essential information that should always be visible
- Test overflow behavior at different screen sizes
- Ensure pinned content remains readable and doesn't overwhelm the main text

### Content Spacing

- Default spacing with space character works for most use cases
- Use `contentSpacing="pre"` to preserve exact whitespace formatting
- Custom spacing characters can create lists or formatted displays
- The spacing system automatically detects existing whitespace to avoid double spacing

### Accessibility

- Use `CharSlot` with proper ARIA attributes for meaningful icons
- Set `decorative={true}` on `CharSlot` for purely visual icons
- Use semantic HTML elements via the `as` prop when appropriate
- Ensure sufficient color contrast for text and overlays

## Component API

### Text Props

| Prop                | Type      | Default  | Description                                          |
| ------------------- | --------- | -------- | ---------------------------------------------------- |
| `as`                | `string`  | `"span"` | HTML element to render                               |
| `box`               | `boolean` | `false`  | Enable Box layout features and props                 |
| `overflowEllipsis`  | `boolean` | `false`  | Enable text truncation with ellipsis                 |
| `overflowPinned`    | `boolean` | `false`  | Keep this content visible when parent text overflows |
| `contentSpacing`    | `string`  | `" "`    | Character(s) inserted between child elements         |
| `foregroundColor`   | `string`  | -        | Background color for foreground overlay              |
| `foregroundElement` | `element` | -        | Element to render as foreground overlay              |
| `noWrap`            | `boolean` | `false`  | Prevent text wrapping (used with overflow)           |
| `pre`               | `boolean` | -        | Preserve whitespace formatting                       |

When `box={true}`, all Box component props are also available (layout, spacing, styling, etc.).

### Icon Props

| Prop   | Type      | Default | Description                          |
| ------ | --------- | ------- | ------------------------------------ |
| `href` | `string`  | -       | SVG sprite reference (e.g., "#icon") |
| `box`  | `boolean` | `false` | Enable Box layout features           |

When `box={false}` (default), Icon uses CharSlot and supports:

- `charWidth`: Width in characters (default: 1)
- `baseChar`: Character used for sizing (default: "W")
- `decorative`: Mark as decorative for accessibility
- `aria-label`, `role`: Accessibility attributes

When `box={true}`, all Box component props are available.

### CharSlot Props

| Prop         | Type      | Default | Description                           |
| ------------ | --------- | ------- | ------------------------------------- |
| `charWidth`  | `number`  | `1`     | Width in character units              |
| `baseChar`   | `string`  | `"W"`   | Character used for size calculation   |
| `decorative` | `boolean` | `false` | Mark as decorative (adds aria-hidden) |
| `aria-label` | `string`  | -       | Accessibility label                   |
| `role`       | `string`  | -       | ARIA role                             |

### Paragraph Props

| Prop             | Type     | Default | Description                    |
| ---------------- | -------- | ------- | ------------------------------ |
| `contentSpacing` | `string` | `" "`   | Spacing between child elements |
| `marginTop`      | `string` | `"md"`  | Top margin using spacing scale |

Plus all Box component props for styling and layout.
