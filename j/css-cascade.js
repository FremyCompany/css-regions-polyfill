//
// note: depends on cssSyntax and cssSelectors
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
        
    },
    
    getSpecifiedStyle: function getSpecifiedStyle(element, cssPropertyName) {
        
        // find all relevant selectors
        var isBestImportant=false; var bestPriority = 0; var bestValue = "";
        var rules = element.myMatchedRules || [];
        for(var i=rules.length-1; i>=0; i--) {
            
            // TODO: media queries hook
            if(rules[i].disabled) continue;
            
            // find a relevant declaration
            var decls = rules[i].value;
            for(var j=decls.length-1; j>=0; j--) {
                if(decls[j].type=="DECLARATION") {
                    if(decls[j].name==cssPropertyName) {
                        // TODO: only works if selectors containing a "," are deduplicated
                        var currentPriority = cssCascade.computeSelectorPriorityOf(rules[i].selector);
                        
                        if(isBestImportant) {
                            // only an important declaration can beat another important declaration
                            if(decls[j].important) {
                                if(currentPriority >= bestPriority) {
                                    bestPriority = currentPriority;
                                    bestValue = decls[j].value;
                                }
                            }
                        } else {
                            // an important declaration beat any non-important declaration
                            if(decls[j].important) {
                                isBestImportant = true;
                                bestPriority = currentPriority;
                                bestValue = decls[j].value;
                            } else {
                                // the selector priority has to be higher otherwise
                                if(currentPriority >= bestPriority) {
                                    bestPriority = currentPriority;
                                    bestValue = decls[j].value;
                                }
                            }
                        }
                    }
                }
            }
            
        }
        
        // return our best guess...
        return bestValue;
        
    },
    
    startMonitoringRule: function startMonitoringRule(rule, handler) {
        
        // avoid monitoring rules twice
        if(!rule.isMonitored) { rule.isMonitored=true } else { return; }
        
        // monitor the rules
        myQuerySelectorLive(rule.selector.toCSSString(), {
            onadded: function(e) {
                
                // add the rule to the matching list of this element
                (e.myMatchedRules = e.myMatchedRules || []).push(rule); // TODO: does not respect DOM order
                
                // generate an update event
                handler && handler.onupdate && handler.onupdate(e, rule);
                
            },
            onremoved: function(e) {
                
                // remove the rule from the matching list of this element
                if(e.myMatchedRules) e.myMatchedRules.splice(e.myMatchedRules.indexOf(rule), 1);
                
                // generate an update event
                handler && handler.onupdate && handler.onupdate(e, rule);
                
            }
        });
        
    }
    
};