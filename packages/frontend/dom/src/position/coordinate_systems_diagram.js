/**
 * Coordinate Systems in Web Development
 *
 * Example with dimensions showing different coordinate systems:
 *
 * 0                                                                     2000
 * ┌─────────────────────────────────────────────────────────────────────────┐ 0
 * │ DOCUMENT (2000x3000)                                                    │
 * │          200                                  800                           │
 * │          ┌──────────────────────────────────────┐ 200                       │
 * │          │ VIEWPORT (800x600)                   │                           │
 * │          │      400                   600       │                           │
 * │          │      ┌────────────────────────┐350   │                           │
 * │          │      │ SCROLL CONTAINER (200x100)    │      │                           │
 * │          │      │                        │      │                           │
 * │          │      │                        │      │                           │
 * │          │      │ ┌──────────────────┐   │      │                           │
 * │          │      │ │ CONTENT          │   │      │                           │
 * │          │      │ │                  │   │      │                           │
 * │          │      │ │ 150┌───────┐230  │   │      │                           │
 * │          │      │ │    │ ELEM  │     │   │      │                           │
 * │          │      │ │  320└───────┘360  │  │      │                          │
 * │          │      │ │                  │   │      │                           │
 * │          │      │ └──────────────────┘   │      │                           │
 * │          │      └────────────────────────┘      │                         │
 * │          │                                      │                         │
 * │          └──────────────────────────────────────┘                         │
 * │          200                                  800                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 0                                                                      3000
 *
 * COORDINATE CONVERSIONS FOR THE ELEMENT (80×40px):
 *
 * • Viewport coords: getBoundingClientRect() → left:150, top:30, right:230, bottom:70
 * • Document coords: viewport + document scroll → left:150, top:230, right:230, bottom:270
 * • Container content coords: relative to content → left:50, top:30, right:130, bottom:70
 * • Container scroll coords: content - container scroll → left:-50, top:30, right:30, bottom:70
 *
 * WHEN DOCUMENT SCROLLS (scrollY=200→300):
 * • Viewport coords: same (relative to window)
 * • Document coords: left:150, top:330, right:230, bottom:370
 * • Container coords: unchanged (independent scrolling)
 *
 * WHEN CONTAINER SCROLLS (scrollLeft=100→150):
 * • Viewport coords: left:100, top:30, right:180, bottom:70
 * • Document coords: left:100, top:230, right:180, bottom:270
 * • Container content coords: same (relative to content)
 * • Container scroll coords: left:-100, top:30, right:-20, bottom:70
 */
