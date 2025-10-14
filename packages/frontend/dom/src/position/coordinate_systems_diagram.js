/**
 * X-Axis Coordinate Systems in Web Development
 *
 * Diagram showing horizontal positioning and scrollbars:
 *
 * VIEWPORT (visible part of the document)
 * ┌───────────────────────────────────────────────┐
 * │                                               │
 * │                                               │
 * │    container.offsetLeft: 50px                 │
 * │       ┼─────────────────────────────┐         │
 * │       │                             │         │
 * │       │                             │         │
 * │       │    el.offsetLeft: 10px      │         │
 * │       │     ┼─────┐                 │         │
 * │       │     │     │                 │         │
 * │       │     └─────┘                 │         │
 * │       │                             │         │
 * │       │ ░░░░███░░░░░░░░░░░░░░░░░░░░ │         │
 * │       └──────│──────────────────────┘         │
 * │      container.scrollLeft: 100px              │
 * │                                               │
 * │                                               │
 * │ ░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 * └─────────│─────────────────────────────────────┘
 *   document.scrollLeft: 200px
 *
 *
 * Left coordinate for the element:
 *
 * Document coordinates (absolute position in full document)
 * • Result: 550px
 * • Detail: container.offsetLeft + element.offsetLeft + document.scrollLeft
 *
 * Viewport coordinates (getBoundingClientRect().left):
 * • Result: 450px
 * • Detail: container.offsetLeft + element.offsetLeft
 *
 * Scroll coordinates (position within scroll container):
 * • Result: -50px
 * • Detail: element.offsetLeft - container.scrollLeft
 */
