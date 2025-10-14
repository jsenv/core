/**
 * X-Axis Coordinate Systems in Web Development
 *
 * Diagram showing horizontal positioning and scrollbars:
 *   
 * VIEWPORT (visible part of the document)                                                                                                 
 * ┌───────────────────────────────────────────────┐      
 * │                                               │      
 * │                                               │      
 * │    container.offsetLeft: 200px                │      
 * │       ┼─────────────────────────────┐         │      
 * │       │                             │         │      
 * │       │                             │         │      
 * │       │    el.offsetLeft: 200px     │         │      
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
 
 * SCROLLBARS VISUAL REPRESENTATION:
 * • Viewport scrollbar: ░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░░░ (scrollLeft: 100px)
 * • Container scrollbar: ░░░░███░░░░░░░░░░░░░░░ (scrollLeft: 150px)
 *
 * X-COORDINATE CALCULATIONS for the element
 *
 * DOCUMENT COORDINATES (absolute position in full document):
 * • Result: 600px  
 * • Calculation: container.offsetLeft + element.offsetLeft + document.scrollLeft
 *                      200           +        200          + 200 = 600px
 * • Explanation: Position relative to document's origin (0,0)
 * 
 * VIEWPORT COORDINATES (getBoundingClientRect().left):
 * • Result: 400px
 * • Calculation: container.offsetLeft + element.offsetLeft
 *                      200           +       200        = 400px
 * • Explanation: Position relative to viewport's left edge
 *
 * CONTAINER SCROLL COORDINATES (position within scrollable container):
 * • Result: 100px
 * • Calculation: element.offsetLeft - container.scrollLeft
 *                      200         -        100         = 100px
 * • Explanation: Position relative to container's scrolled content
 *
 *
 * SCROLL BEHAVIOR EXAMPLES:
 *
 * WHEN DOCUMENT SCROLLS (scrollLeft: 200px → 300px):
 * • Viewport coordinates: 400px → 400px (unchanged)
 *   - Reason: getBoundingClientRect() is relative to viewport, not document
 * • Document coordinates: 600px → 700px
 *   - Calculation: viewport_coordinates + new_document_scroll
 *                       400           +        300         = 700px
 * • Container scroll coordinates: 100px → 100px (unchanged)
 *   - Reason: Container scrolling is independent of document scrolling
 *
 * WHEN CONTAINER SCROLLS (scrollLeft: 100px → 150px):
 * • Viewport coordinates: 400px → 350px
 *   - Calculation: container.offsetLeft + (element.offsetLeft - additional_scroll)
 *                       200           + (      200         -       50         ) = 350px
 * • Document coordinates: 600px → 550px
 *   - Calculation: new_viewport_coordinates + document.scrollLeft
 *                           350             +        200         = 550px
 * • Container scroll coordinates: 100px → 50px
 *   - Calculation: element.offsetLeft - new_container_scroll
 *                       200         -        150            = 50px
 */
