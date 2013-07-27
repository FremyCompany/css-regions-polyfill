//
// note: depends on cssSyntax and cssSelectors
//

var cssCascade = {
    
    computeSelectorPriorityOf: function computeSelectorPriorityOf(selector) {
        if(typeof selector == "string") selector = cssSyntax.parse(selector+"{}").value[0].selector;
        
        var numberOfIDs = 0;
        var numberOfClasses = 0;
        var numberOfTags = 0;
        
        // TODO: improve this parser, or find one on the web
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
    
    findAllMatchingRules: function findAllMatchingRules(element) {
        return []; // TODO: walk the whole stylesheet...
    },
    
    getSpecifiedStyle: function getSpecifiedStyle(element, cssPropertyName) {
        
        // find all relevant style rules
        var isBestImportant=false; var bestPriority = 0; var bestValue = new cssSyntax.TokenList();
        var rules = (
            cssCascade.monitoredProperties.some(function(reg) { return reg.test(cssPropertyName) })
            ? element.myMatchedRules || []
            : cssCascade.findAllMatchingRules(element)
        );
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
    
    stylesheets: [],
    loadStyleSheet: function loadStyleSheet(cssText) {
        
        // TODO: load only one, load in order
        var rules = cssSyntax.parse(cssText).value;
        cssCascade.stylesheets.push(rules);
        
    },
    
    monitoredProperties: [],
    monitoredPropertiesHandlers: Object.create ? Object.create(null) : {},
    startMonitoringProperty: function startMonitoringProperty(propertyRegExp, handler) {
        
        var temp = cssCascade.monitoredProperties.push(propertyRegExp);
        var temp = cssCascade.monitoredPropertiesHandlers[propertyRegExp] = 
            cssCascade.monitoredPropertiesHandlers[propertyRegExp] || [];
        temp.push(handler)
        
        for(var s=0; s<cssCascade.stylesheets.length; s++) {
            
            var rules = cssCascade.stylesheets[s];
            for(var i=0; i<rules.length; i++) {
                
                // only consider style rules
                if(rules[i] instanceof cssSyntax.StyleRule) {
                    
                    // try to see if the current rule is worth watching
                    var decls = rules[i].value;
                    for(var j=decls.length-1; j>=0; j--) {
                        if(decls[j].type=="DECLARATION") {
                            if(propertyRegExp.test(decls[j].name)) {
                                
                                // if we found some, start monitoring
                                cssCascade.startMonitoringRule(rules[i], {
                                    onupdate: function(element, rule) {
                                        
                                        // we need to find all regexps that matches
                                        var mpr = cssCascade.monitoredProperties;
                                        for(var k=mpr.length; k--;) {
                                            var reg = mpr[k];
                                            
                                            var decls = rule.value;
                                            for(var j=decls.length-1; j>=0; j--) {
                                                if(decls[j].type=="DECLARATION") {
                                                    if(reg.test(decls[j].name)) {
                                                        
                                                        // call all handlers waiting for this
                                                        var hs = cssCascade.monitoredPropertiesHandlers[reg];
                                                        for(var hi=hs.length; hi--;) {
                                                            hs[hi].onupdate(element,rule);
                                                        };
                                                        
                                                        // don't call twice
                                                        break;
                                                        
                                                    }
                                                }
                                            }
                                            
                                        };
                                        
                                    }
                                });
                                break;
                                
                            }
                        }
                    }
                    
                } else {
                    
                    // TODO: handle @media
                    
                }
                
            }
            
        }
    },
    
    startMonitoringRule: function startMonitoringRule(rule, handler) {
        
        // avoid monitoring rules twice
        if(!rule.isMonitored) { rule.isMonitored=true } else { return; }
        
        // split the rule if it has multiple selectors
        var rules = [];
        var currentRule = new cssSyntax.StyleRule(); for(var i=0; i<rule.selector.length; i++) {
            if(rule.selector[i] instanceof cssSyntax.DelimToken && rule.selector[i].value==",") {
                currentRule.value = rule.value; rules.push(currentRule);
                currentRule = new cssSyntax.StyleRule(); 
            } else {
                currentRule.selector.push(rule.selector[i])
            }
        }
        currentRule.value = rule.value; rules.push(currentRule);
        
        // monitor the rules
        for(var i=0; i<rules.length; i++) {
            rule = rules[i];
            myQuerySelectorLive(rule.selector.toCSSString(), {
                onadded: function(e) {
                    
                    // add the rule to the matching list of this element
                    (e.myMatchedRules = e.myMatchedRules || []).push(rule); // TODO: does not respect priority order
                    
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
        
    }
    
};