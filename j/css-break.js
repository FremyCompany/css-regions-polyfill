"use strict";

var cssBreak = {
    
    isMonolithic: function isMonolithic(element) {
        
        // todo: implement that by following the spec
        var replacedElementTags = /(SVG|MATH|IMG|VIDEO|OBJECT|EMBED|IFRAME)/;
        return replacedElementTags.test(element.tagName);
        
    }
    
}