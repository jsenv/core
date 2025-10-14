/**
 * Coordinate Systems in Web Development
 *
 * This diagram illustrates the different coordinate systems and rectangles
 * that exist when dealing with scrollable content in web browsers.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ DOCUMENT (html element)                                                             │
 * │ • Document coordinates: (0,0) at top-left of entire document                        │
 * │ • Includes all content, even what's scrolled out of view                            │
 * │ • Can be larger than viewport due to scrolling                                      │
 * │                                                                                     │
 * │  ┌────────────────────────────────────────────────────────────────┐                 │
 * │  │ VIEWPORT (visible area of browser window)                      │                 │
 * │  │ • Viewport coordinates: (0,0) at top-left of visible window    │                 │
 * │  │ • What user actually sees on screen                            │                 │
 * │  │ • Size = window.innerWidth × window.innerHeight                │                 │
 * │  │                                                                │                 │
 * │  │   ┌─────────────────────────────────────────┐                  │                 │
 * │  │   │ SCROLL CONTAINER (.scrollable-div)      │ ◄──┐             │                 │
 * │  │   │ • Container coordinates: relative to    │    │             │                 │
 * │  │   │   container's border-box                │    │             │                 │
 * │  │   │ • Has overflow: auto/scroll             │    │             │                 │
 * │  │   │ • Creates its own scrolling context     │    │             │                 │
 * │  │   │                                         │    │             │                 │
 * │  │   │  ┌─────────────────────────────────────┐│    │ Scroll      │                 │
 * │  │   │  │ CONTENT (actual scrollable content) ││    │ Container   │                 │
 * │  │   │  │ • Much larger than container        ││    │ Scrollbar   │                 │
 * │  │   │  │ • Content coordinates: relative to  ││    │ (vertical)  │                 │
 * │  │   │  │   content's top-left at scroll(0,0) ││    │             │                 │
 * │  │   │  │                                     ││    │             │                 │
 * │  │   │  │ ┌─────────────────────────────────┐ ││    │             │                 │
 * │  │   │  │ │ DRAGGABLE ELEMENT               │ ││    │             │                 │
 * │  │   │  │ │ • Position depends on context:  │ ││    │             │                 │
 * │  │   │  │ │   - Document coords for global  │ ││    │             │                 │
 * │  │   │  │ │   - Container coords for local  │ ││    │             │                 │
 * │  │   │  │ │   - Viewport coords for fixed   │ ││    │             │                 │
 * │  │   │  │ └─────────────────────────────────┘ ││    │             │                 │
 * │  │   │  │                                     ││    │             │                 │
 * │  │   │  │                [more content...]    ││    │             │                 │
 * │  │   │  │                                     ││    │             │                 │
 * │  │   │  └─────────────────────────────────────┘│    │             │                 │
 * │  │   └────────────────────────────────────────┬─┘    │            │                 │
 * │  │                                             │      │           │                 │
 * │  └─────────────────────────────────────────────┼──────┘           │                 │
 * │                                                │                  │                 │
 * └────────────────────────────────────────────────┼──────────────────┘                 │
 *                                                  │                                    │
 *                                                  ▼                                    │
 *                                    Scroll Container Horizontal Scrollbar              │
 *                                                                                       │
 *                          [more document content...]                                   │
 *                                                                                       │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *                                              ▲
 *                                              │
 *                                    Document Scrollbar (body/html)
 *
 * COORDINATE SYSTEM EXPLANATIONS:
 *
 * 1. VIEWPORT COORDINATES (clientX, clientY from events)
 *    • Origin: Top-left of browser window viewport
 *    • Range: 0 to window.innerWidth/Height
 *    • Use case: Mouse events, getBoundingClientRect()
 *    • Never changes when scrolling (always relative to visible window)
 *
 * 2. DOCUMENT COORDINATES
 *    • Origin: Top-left of entire HTML document
 *    • Range: 0 to full document width/height
 *    • Use case: Absolute positioning, drag operations
 *    • Conversion: viewport + document.documentElement.scrollLeft/Top
 *
 * 3. SCROLL CONTAINER COORDINATES
 *    • Origin: Top-left of scrollable container's content area
 *    • Range: 0 to container's scrollWidth/Height
 *    • Use case: Positioning within specific scrollable areas
 *    • Conversion: document coords - container's document offset
 *
 * SCROLLBAR BEHAVIOR:
 *
 * • Document Scrollbar (html/body):
 *   - Controls viewport position within document
 *   - Affects all viewport ↔ document coordinate conversions
 *   - When scrolled: viewport coords stay same, document coords change
 *
 * • Container Scrollbar:
 *   - Controls visible portion of container's content
 *   - Independent of document scrolling
 *   - Creates nested coordinate system within document space
 *
 * DRAG GESTURE COORDINATE CHALLENGES:
 *
 * 1. CONSISTENT REFERENCE FRAME:
 *    - Must choose one coordinate system as "source of truth"
 *    - Document coordinates work best for complex layouts
 *    - Convert all positions to document coords early
 *
 * 2. CONSTRAINT CALCULATION:
 *    - Visible areas must account for scroll positions
 *    - Container boundaries in document coords
 *    - Element positions in same coordinate system
 *
 * 3. AUTO-SCROLL LOGIC:
 *    - Detect when element would move outside visible area
 *    - Trigger appropriate scrollbar (document vs container)
 *    - Recalculate constraints after scroll changes
 *
 * 4. POSITION UPDATES:
 *    - Convert final document coords to element's positioning context
 *    - Account for offsetParent coordinate system
 *    - Handle special cases: fixed, sticky, transformed elements
 */
