//
// note: depends on cssSyntax
//

var cssCascade = {
    
    computeSelectorPriorityOf: function computeSelectorPriorityOf(selector) {
        if(typeof selector == "string") selector = cssSyntax.parse(selector+"{}").value[0].selector;
        
        var numberOfIDs = 0;
        var numberOfClasses = 0;
        var numberOfTags = 0;
        
        // TODO: improve this parser, or find one on the web {fails at :not()}
        for(var i = 0; i < selector.length; i++) {
            
            if(selector[i] instanceof cssSyntax.IdentifierToken) {
                numberOfTags++;
                
            } else if(selector[i] instanceof cssSyntax.DelimToken) {
                if(selector[i].value==".") {
                    numberOfClasses++; i++;
                }
                
            } else if(selector[i] instanceof cssSyntax.ColonToken) {
                if(selector[++i] instanceof cssSyntax.ColonToken) {
                    numberOfTags++; i++;
                    
                } else if((selector[i] instanceof cssSyntax.Func) && (/^(not|matches)$/i).test(selector[i].name)) {
                    var nestedPriority = this.computeSelectorPriorityOf(selector[i].value[0].value);
                    numberOfTags += nestedPriority % 256; nestedPriority /= 256;
                    numberOfClasses += nestedPriority % 256; nestedPriority /= 256;
                    numberOfIDs += nestedPriority;
                    
                } else {
                    numberOfClasses++;
                    
                }
                
            } else if(selector[i] instanceof cssSyntax.SimpleBlock) {
                if(selector[i].name=="[") {
                    numberOfClasses++;
                }
                
            } else if(selector[i] instanceof cssSyntax.HashToken) {
                numberOfIDs++;
                
            } else {
                // TODO: stop ignoring unknown symbols?
                
            }
            
        }
        
        if(numberOfIDs>255) numberOfIds=255;
        if(numberOfClasses>255) numberOfClasses=255;
        if(numberOfTags>255) numberOfTags=255;
        
        return ((numberOfIDs*256)+numberOfClasses)*256+numberOfTags;
        
    }
    
};