/**
 * Coordinate Systems in Web Development
 *
 * Example with dimensions showing different coordinate systems:
 *
 *      0
 *   0 ─┼───────────────────────────────────────────────────────────────────┐
 *      │ DOCUMENT (1400×1600)                                              │
 *      │      100                                                          │
 *      │  200 ─┼─────────────────────────────────────────────────┐         │
 *      │       │ VIEWPORT (800×650)                              │         │
 *      │       │                                                 │         │
 *      │       │     ┌───────────────────────────────────┐       │         │
 *      │       │     │ SCROLL CONTAINER                  │       │         │
 *      │       │     │ (400×300)                         │       │         │
 *      │       │     │                                   │       │         │
 *      │       │     │   ┌─────────────────────────┐     │       │         │
 *      │       │     │   │ CONTENT                 │     │       │         │
 *      │       │     │   │ (400×250)               │     │       │         │
 *      │       │     │   │                         │     │       │         │
 *      │       │     │   │                         │     │       │         │
 *      │       │     │   │     ┌─────────────┐     │     │       │         │
 *      │       │     │   │     │ ELEM        │     │     │       │         │
 *      │       │     │   │     │ (100×100)   │     │     │       │         │
 *      │       │     │   │     │             │     │     │       │         │
 *      │       │     │   │     │             │     │     │       │         │
 *      │       │     │   │     └─────────────┘     │     │       │         │
 *      │       │     │   │                         │     │       │         │
 *      │       │     │   │                         │     │       │         │
 *      │       │     │   │                         │     │       │         │
 *      │       │     │   └─────────────────────────┘     │       │         │
 *      │       │     │                                   │       │         │
 *      │       │     └───────────────────────────────────┘       │         │
 *      │       │                                                 │         │
 *      │       └─────────────────────────────────────────────────┘         │
 *      │                                                                   │
 *      └───────────────────────────────────────────────────────────────────┘
 *
 * COORDINATE CONVERSIONS FOR THE ELEMENT (100×100px):
 *
 * • Viewport coords: getBoundingClientRect() → left:300, top:350, right:400, bottom:450
 * • Document coords: viewport + document scroll → left:400, top:550, right:500, bottom:650
 * • Container content coords: relative to content → left:100, top:100, right:200, bottom:200
 * • Container scroll coords: content - container scroll → left:50, top:50, right:150, bottom:150
 *
 * WHEN DOCUMENT SCROLLS (scrollX=100→150, scrollY=200→300):
 * • Viewport coords: same (relative to window)
 * • Document coords: left:450, top:650, right:550, bottom:750
 * • Container coords: unchanged (independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (scrollLeft=50→100, scrollTop=50→100):
 * • Viewport coords: left:250, top:300, right:350, bottom:400
 * • Document coords: left:350, top:500, right:450, bottom:600
 * • Container content coords: same (relative to content)
 * • Container scroll coords: left:0, top:0, right:100, bottom:100
 */
