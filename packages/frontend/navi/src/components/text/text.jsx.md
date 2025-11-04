# Text Component

The Text component is a powerful, flexible text rendering system that supports icons, overflow handling, and rich typography options. It's designed to handle complex text layouts with ease while maintaining excellent performance and accessibility.

## Basic Usage

```jsx
import { Text } from "@jsenv/navi";

// Simple text
<Text>Hello world</Text>

// With styling
<Text textBold textColor="blue">Important message</Text>
```

## Text with Icons

One of the most powerful features is the ability to seamlessly integrate icons within text. The `box` prop is **required** when using icons to ensure proper positioning and alignment.

### Basic Icon Integration

```jsx
import { Text, Icon } from "@jsenv/navi";

<Text box>
  <Icon>
    <HomeSvg />
  </Icon>
  Go to Home
</Text>;
```

### Icon Positioning

Icons can be positioned before, after, or between text content:

```jsx
// Icon before text
<Text box>
  <Icon textColor="green">
    <CheckSvg />
  </Icon>
  Task completed
</Text>

// Icon after text
<Text box>
  Download file
  <Icon>
    <DownloadSvg />
  </Icon>
</Text>

// Multiple icons
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

### Icon Alignment

The Text component provides intelligent icon alignment that automatically positions icons perfectly with text content, even within complex paragraph layouts. This smart alignment ensures icons always look naturally integrated with the text baseline.

**Multiline Behavior**: When text within a `box` goes multiline, the icon stays vertically centered to the first line of text by default. This maintains clean alignment and readability. While you can control this with the `alignY` prop on the icon, the default behavior is typically the most visually appealing.

**Important Layout Consideration**: Using `box={true}` creates a flexbox container, which affects how text flows when multiple `box` elements are adjacent. In narrow containers, multiple `box` texts can arrange themselves in columns rather than flowing naturally as a continuous sentence. This is why `box` should be reserved for short phrases or used sparingly in paragraph text.

```jsx
// Smart default alignment - icon aligns perfectly with text baseline
<Text box>
  <Icon>
    <StarSvg />
  </Icon>
  Default alignment
</Text>

// When text wraps, icon stays aligned to first line
<Box width="120px">
  <Text box>
    <Icon>
      <DocumentSvg />
    </Icon>
    Long filename that wraps to multiple lines
  </Text>
</Box>

// Good example: Short text+icon pairs work perfectly in paragraphs
<Paragraph widht="200px">
  Welcome! Click the{" "}
  <Text box>
    <Icon>
      <HomeSvg />
    </Icon>
    home
  </Text>
  {" "}button or visit your{" "}
  <Text box>
    <Icon>
      <UserSvg />
    </Icon>
    profile
    </Text>
  {" "}to get started.
</Paragraph>

// Center aligned (less common, but available)
<Text box>
  <Icon alignY="center">
    <StarSvg />
  </Icon>
  Center aligned icon
</Text>

// Bottom aligned (rarely used)
<Text box>
  <Icon alignY="end">
    <StarSvg />
  </Icon>
  Bottom aligned icon
</Text>
```

**Best Practice**: Reserve `box={true}` for short, cohesive phrases like "Download File", "New Message", or "Settings". For longer content or when multiple icon+text combinations appear in the same paragraph, consider using icons as separate elements or be mindful of the layout behavior in narrow containers.

### Styled Icons

Icons inherit text color by default but can be styled independently:

```jsx
<Text box textColor="blue">
  <Icon textColor="red">
    <HeartSvg />
  </Icon>
  Blue text with red heart
</Text>

<Text box>
  <Icon textColor="green" textSize="lg">
    <CheckSvg />
  </Icon>
  Large green checkmark
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
    <Text overflowPinned textColor="#4caf50">
      ✓ Completed
    </Text>
  </Text>
</Box>
```

### Pinned Content with Icons

Combine pinned content with icons for rich, informative text:

```jsx
<Box width="300px">
  <Text overflowEllipsis box>
    Very long filename that might be truncated in narrow containers
    <Text overflowPinned>
      <Icon textColor="blue">
        <FileSvg />
      </Icon>
    </Text>
  </Text>
</Box>
```

### Pinned Counts and Badges

Perfect for displaying counts, badges, or status indicators:

```jsx
<Box width="200px">
  <Text overflowEllipsis>
    Long conversation title that exceeds container width
    <Text overflowPinned textColor="#666">
      <Count>23</Count>
    </Text>
  </Text>
</Box>
```

## Advanced Examples

### Navigation Links with Icons

```jsx
<Text box as="a" href="/profile">
  <Icon textColor="blue">
    <UserSvg />
  </Icon>
  My Profile
</Text>
```

### Status Messages

```jsx
<Text box>
  <Icon textColor="green" alignY="center">
    <CheckSvg />
  </Icon>
  <Text>
    Password reset link sent to <Text textBold>user@example.com</Text>
  </Text>
</Text>
```

### File Lists with Overflow

```jsx
<Box width="300px">
  <Text overflowEllipsis box>
    <Icon textColor="blue">
      <DocumentSvg />
    </Icon>
    very-long-filename-that-might-be-truncated.pdf
    <Text overflowPinned textColor="#666">
      2.4 MB
    </Text>
  </Text>
</Box>
```

### Interactive Elements

```jsx
<Text box as="button" onClick={handleClick}>
  <Icon>
    <PlusSvg />
  </Icon>
  Add new item
</Text>
```

## Typography Props

The Text component supports comprehensive typography styling:

```jsx
// Size variations
<Text textSize="xs">Extra small text</Text>
<Text textSize="sm">Small text</Text>
<Text textSize="md">Medium text (default)</Text>
<Text textSize="lg">Large text</Text>
<Text textSize="xl">Extra large text</Text>

// Weight and style
<Text textBold>Bold text</Text>
<Text textItalic>Italic text</Text>
<Text textUnderline>Underlined text</Text>

// Colors
<Text textColor="blue">Blue text</Text>
<Text textColor="#ff6b6b">Custom color</Text>

// Combinations
<Text textBold textItalic textColor="red" textSize="lg">
  Combined styles
</Text>
```

## Layout Props

When using `box={true}`, the Text component supports layout properties:

```jsx
// Spacing
<Text box gap="sm">
  <Icon><StarSvg /></Icon>
  Spaced content
</Text>

// Alignment and expansion
<Text box expandX alignX="center">
  Centered expanding text
</Text>

// Margins and padding
<Text box margin="md" padding="sm">
  Text with spacing
</Text>
```

## Best Practices

### When to Use `box={true}`

- **Always** when including icons within text
- When you need layout control (spacing, alignment, expansion)
- For interactive text elements (buttons, links with complex content)

### Icon Guidelines

- Use semantic icons that enhance meaning
- Keep icon colors consistent with your design system
- Consider icon alignment for different text sizes
- Test icon visibility in different themes

### Overflow Handling

- Use `overflowEllipsis` for content that might exceed container width
- Reserve `overflowPinned` for truly important information (counts, status, actions)
- Test overflow behavior at different screen sizes
- Ensure pinned content remains readable

### Accessibility

- Provide meaningful alt text for decorative icons
- Ensure sufficient color contrast for text and icons
- Use semantic HTML elements via the `as` prop when appropriate
- Test with screen readers to ensure icon content is properly conveyed

## Component API

### Text Props

| Prop               | Type      | Default   | Description                                          |
| ------------------ | --------- | --------- | ---------------------------------------------------- |
| `as`               | `string`  | `"span"`  | HTML element to render                               |
| `box`              | `boolean` | `false`   | Enable layout features and icon support              |
| `gap`              | `string`  | `"xxs"`   | Spacing between inline elements (when box=true)      |
| `overflowEllipsis` | `boolean` | `false`   | Enable text truncation with ellipsis                 |
| `overflowPinned`   | `boolean` | `false`   | Keep this content visible when parent text overflows |
| `textSize`         | `string`  | `"md"`    | Font size (xxs, xs, sm, md, lg, xl, xxl)             |
| `textBold`         | `boolean` | `false`   | Bold font weight                                     |
| `textItalic`       | `boolean` | `false`   | Italic font style                                    |
| `textUnderline`    | `boolean` | `false`   | Underlined text                                      |
| `textColor`        | `string`  | `inherit` | Text color                                           |

### Icon Props

| Prop        | Type     | Default      | Description                                       |
| ----------- | -------- | ------------ | ------------------------------------------------- |
| `alignY`    | `string` | `"baseline"` | Vertical alignment (start, center, end, baseline) |
| `textColor` | `string` | `inherit`    | Icon color                                        |
| `textSize`  | `string` | `inherit`    | Icon size                                         |

The Text component also supports all standard layout, spacing, and styling props when `box={true}` is used.
