"use strict";

var cssBreak = {
    
    isReplacedElement: function isReplacedElement(element) {
        var replacedElementTags = /(SVG|MATH|IMG|VIDEO|OBJECT|EMBED|IFRAME|TEXTAREA|BUTTON|INPUT)/; // TODO: more
        return replacedElementTags.test(element.tagName);
    },
    
    isScrollable: function isScrollable(element, elementOverflow) {
        if(typeof(elementOverflow)=="undefined") elementOverflow = getComputedStyle(element).display;
        
        return (
            elementOverflow !== "visible"
            && elementOverflow !== "hidden"
        );
        
    },
    
    isSingleLineOfTextComponent: function(element, elementDisplay, isReplaced) {
        if(typeof(elementOverflow)=="undefined") elementOverflow = getComputedStyle(element).display;
        if(typeof(isReplaced)=="undefined") isReplaced = this.isReplacedElement(element);
        
        return (
            elementDisplay === "inline-block"
            || elementDisplay === "inline-table"
            || elementDisplay === "inline-flex"
            || elementDisplay === "inline-grid"
            // TODO: more
        );
        
    },
    
    areInSameSingleLine: function areInSameSingleLine(element1, element2) {
        return false; // TODO: figure that out...
        // IDEA: use getClientRects().length == 1? seems like it could fail on mutli-line grouped elements
    },
    
    isHiddenOverflowing: function isHiddenOverflowing(element, elementOverflow) {
        if(typeof(elementOverflow)=="undefined") elementOverflow = getComputedStyle(element).display;
        
        return (
            elementOverflow == "hidden" 
            && element.offsetHeight != element.scrollHeight // trust me that works
        );
        
    },
    
    isMonolithic: function isMonolithic(element) {
        
        var elementStyle = getComputedStyle(element);
        var elementOverflow = elementStyle.overflow;
        var elementDisplay = elementStyle.display;
        
        // Some content is not fragmentable, for example:
        // - many types of replaced elements (such as images or video)
        
        var isReplaced = this.isReplacedElement(element);
        
        // - scrollable elements
        
        var isScrollable = this.isScrollable(element, elementOverflow);
        
        // - a single line of text content. 
        
        var isSingleLineOfText = this.isSingleLineOfTextComponent(element, elementDisplay, isReplaced);
        
        // Such content is considered monolithic: it contains no
        // possible break points. 
        
        // In addition to any content which is not fragmentable, 
        // UAs may consider as monolithic:
        // - any elements with ‘overflow’ set to ‘auto’ or ‘scroll’ 
        // - any elements with ‘overflow: hidden’ and a non-‘auto’ logical height (and no specified maximum logical height).
        
        var isHiddenOverflowing = this.isHiddenOverflowing(element, elementOverflow);
        
        // all of them are monolithic
        return isReplaced || isScrollable || isSingleLineOfText || isHiddenOverflowing;
        
    },
    
    isPossibleBreakPoint: function isPossibleBreakPoint(r, region) {
        
        // r has to be a range, and be collapsed
        if(!(r instanceof Range)) return false;
        if(!(r.collapsed)) return false;
        
        // TODO: work on that
        
        // no ancestor up to the region has to be monolithic
        var ancestor = r.startContainer;
        while(ancestor !== region) {
            if(cssBreak.isMonolithic(ancestor)) {
                return false;
            }
            ancestor = ancestor.parentNode;
        }
        
        // we also have to check that we're not between two single-line-of-text elements
        // that are actually on the same line (in which case you can't break)
        var ancestor = r.startContainer; 
        var lastAncestor = r.startContainer.childNodes[r.startOffset];
        while(lastAncestor !== region) {
            if(lastAncestor && lastAncestor.previousSibling) {
                // TODO: check what happens with empty text nodes
                
                if(this.areInSameSingleLine(lastAncestor, lastAncestor.previousSibling)) {
                    return false;
                }
                
            }
            
            lastAncestor = ancestor;
            ancestor = ancestor.parentNode;
        }
        
        // there are some very specific conditions for breaking
        // at the edge of an element:
        
        if(r.startOffset==0) {
            
            // Class 3 breaking point:
            // ========================
            // Between the content edge of a block container box 
            // and the outer edges of its child content (margin 
            // edges of block-level children or line box edges 
            // for inline-level children) if there is a (non-zero)
            // gap between them.
            
            var firstChild = r.startContainer.childNodes[0];
            if(firstChild) {
                
                var range = undefined;
                var firstChildBox = (
                    firstChild.getBoundingClientRect
                    ? firstChild.getBoundingClientRect()
                    : (
                        range=document.createRange(),
                        range.selectNode(firstChild),
                        range.getBoundingClientRect()
                    )
                );
                
                var parentBox = (
                    r.startContainer.getBoundingClientRect()
                );
                
                if(firstChildBox.top == parentBox.top) {
                    return false;
                }
                
            } else {
                return false;
            }
            
        }
        
        // TODO: some more stuff {check the spec}
        
        // all conditions are met!
        return true;
        
    }
    
}