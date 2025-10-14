/**
 * Coordinate Systems in Web Development
 *
 * Example with dimensions showing different coordinate systems:
 *
 *      0
 *   0 ─┼─────────────────────────────────────────────────────────────────┐
 *      │ DOCUMENT (1400×1600)                                            │
 *      │                                                                 │
 *      │       50                                                        │
 *      │  50 ─┼────────────────────────────────────────────────┐         │
 *      │      │ VIEWPORT (800×650)                             │         │
 *      │      │                                                │         │
 *      │      │      50                                        │         │
 *      │      │ 50 ─┼───────────────────────────────────┐      │         │
 *      │      │     │ SCROLL CONTAINER (400×300)        │      │         │
 *      │      │     │                                   │      │         │
 *      │      │     │      50                           │      │         │
 *      │      │     │ 50 ─┼─────────────────────────┐   │      │         │
 *      │      │     │     │ CONTENT (400×200)       │   │      │         │
 *      │      │     │     │                         │   │      │         │
 *      │      │     │     │      50                 │   │      │         │
 *      │      │     │     │ 50 ─┼──────────────┐    │   │      │         │
 *      │      │     │     │     │ ELEM (50x50) │    │   │      │         │
 *      │      │     │     │     │              │    │   │      │         │
 *      │      │     │     │     │              │    │   │      │         │
 *      │      │     │     │     │              │    │   │      │         │
 *      │      │     │     │     └──────────────┘    │   │      │         │
 *      │      │     │     └─────────────────────────┘   │      │         │
 *      │      │     │                                   │      │         │
 *      │      │     └───────────────────────────────────┘      │         │
 *      │      │                                                │         │
 *      │      └────────────────────────────────────────────────┘         │
 *      │                                                                 │
 *      └─────────────────────────────────────────────────────────────────┘
 *
 * COORDINATE CONVERSIONS FOR THE ELEMENT (100×100px):
 *
 * Assuming document scroll (100,200) and container scroll (50,50):
 *
 * • Viewport coords: getBoundingClientRect() → left:250, top:250, right:350, bottom:350
 * • Document coords: viewport + document scroll → left:350, top:450, right:450, bottom:550
 * • Container content coords: relative to content → left:100, top:100, right:200, bottom:200
 * • Container scroll coords: content - container scroll → left:50, top:50, right:150, bottom:150
 *
 * WHEN DOCUMENT SCROLLS (scrollX=100→150, scrollY=200→300):
 * • Viewport coords: same (relative to window)
 * • Document coords: left:400, top:550, right:500, bottom:650
 * • Container coords: unchanged (independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (scrollLeft=50→100, scrollTop=50→100):
 * • Viewport coords: left:200, top:200, right:300, bottom:300
 * • Document coords: left:300, top:400, right:400, bottom:500
 * • Container content coords: same (relative to content)
 * • Container scroll coords: left:0, top:0, right:100, bottom:100
 */
