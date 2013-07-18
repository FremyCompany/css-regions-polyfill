"use strict";

var cssBreak = {
    
    isMonolithic: function isMonolithic(element) {
        
        var elementStyle = getComputedStyle(element);
        var elementOverflow = elementStyle.overflow;
        var elementDisplay = elementStyle.display;
        
        // Some content is not fragmentable, for example:
        // - many types of replaced elements (such as images or video)
        
        var replacedElementTags = /(SVG|MATH|IMG|VIDEO|OBJECT|EMBED|IFRAME|TEXTAREA|BUTTON|INPUT)/; // TODO: more
        var isReplaced = replacedElementTags.test(element.tagName);
        
        // - scrollable elements
        
        var isScrollable = (
            elementOverflow !== "visible"
            && elementOverflow !== "hidden"
        );
        
        // - a single line of text content. 
        
        var isSingleLineOfText = (
            elementDisplay === "inline-block" // TODO: more
        );
        
        // Such content is considered monolithic: it contains no
        // possible break points. 
        
        // In addition to any content which is not fragmentable, 
        // UAs may consider as monolithic:
        // - any elements with ‘overflow’ set to ‘auto’ or ‘scroll’ 
        // - any elements with ‘overflow: hidden’ and a non-‘auto’ logical height (and no specified maximum logical height).
        
        var isHiddenOverflowing = (
            elementOverflow == "hidden" 
            && element.offsetHeight != element.scrollHeight
        );
        
        return isReplaced || isScrollable || isSingleLineOfText || isHiddenOverflowing;
        
    }
    
}