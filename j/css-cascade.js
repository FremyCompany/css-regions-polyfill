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
        
        // let's look for new results if needed...
        var results = [];
        
        // walk the whole stylesheet...
        for(var s=cssCascade.stylesheets.length; s--; ) {
            var rules = cssCascade.stylesheets[s];
            for(var r = rules.length; r--; ) {
                var rule = rules[r]; 
                
                // TODO: media queries hook
                if(rule.disabled) continue;
                
                // consider each selector independtly
                var subrules = rule.subRules || cssCascade.splitRule(rule);
                for(var sr = subrules.length; sr--; ) {
                    
                    var isMatching = false;
                    if(element.matchesSelector) isMatching=element.matchesSelector(subrules[sr].selector.toCSSString())
                    else if(element.oMatchesSelector) isMatching=element.oMatchesSelector(subrules[sr].selector.toCSSString())
                    else if(element.msMatchesSelector) isMatching=element.msMatchesSelector(subrules[sr].selector.toCSSString())
                    else if(element.mozMatchesSelector) isMatching=element.mozMatchesSelector(subrules[sr].selector.toCSSString())
                    else if(element.webkitMatchesSelector) isMatching=element.webkitMatchesSelector(subrules[sr].selector.toCSSString())
                    else { throw "wft u no element.matchesSelector?" }
                    
                    if(isMatching) { results.push(subrules[sr]); }
                    
                }
            }
        }
        
        return results;
    },
    
    getSpecifiedStyle: function getSpecifiedStyle(element, cssPropertyName, matchedRules) {
        
        // give IE a thumbs up for this!
        if(element.currentStyle) {
            var bestValue = element.currentStyle[cssPropertyName];
            return bestValue ? cssSyntax.parse("*{a:"+bestValue+"}").value[0].value[0].value : new cssSyntax.TokenList();
        } else {
            
            // first, let's try inline style as it's fast and generally accurate
            // TODO: what if important rules override that?
            if(bestValue = element.style.getPropertyValue(cssPropertyName)) {
                return cssSyntax.parse("*{a:"+bestValue+"}").value[0].value[0].value;
            }
            
            // find all relevant style rules
            var isBestImportant=false; var bestPriority = 0; var bestValue = new cssSyntax.TokenList();
            var rules = matchedRules || (
                cssPropertyName in cssCascade.monitoredProperties
                ? element.myMatchedRules || []
                : cssCascade.findAllMatchingRules(element)
            );
            for(var i=rules.length; i--; ) {
                
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
            
        }
        
    },
    
    stylesheets: [],
    loadStyleSheet: function loadStyleSheet(cssText,i) {
        
        // TODO: load only one, load in order
        
        // parse the stylesheet content
        var rules = cssSyntax.parse(cssText).value;
        
        // add the stylesheet into the object model
        if(typeof(i)!=="undefined") { cssCascade.stylesheets[i]=rules; } 
        else { i=cssCascade.stylesheets.push(rules);}
        
        // make sure to monitor the required rules
        cssCascade.startMonitoringStylesheet(rules)
        
    },
    
    loadAllStyleSheets: function loadAllStyleSheets() {
        
        // for all stylesheets in the <head> tag...
        var head = document.head || document.documentElement;
        var stylesheets = head.querySelectorAll('style:not([data-no-css-polyfill]), link[rel=stylesheet]:not([data-no-css-polyfill])');
        for(var i = this.stylesheets.length = stylesheets.length; i--;) {
            
            // 
            // load the stylesheet
            // 
            var stylesheet = stylesheets[i];
            if(stylesheet.tagName=='LINK') {
                
                // oh, no, we have to download it...
                try {
                    
                    // dummy value in-between
                    cssCascade.stylesheets[i] = new cssSyntax.TokenList();
                    
                    //
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET',stylesheet.href,true); xhr.ruleIndex = i;
                    xhr.onreadystatechange = function() {
                        if(this.readyState==4 && this.status==200) {
                            this.loadStyleSheet(this.responseText,this.ruleIndex)
                        }
                    };
                    xhr.send();
                    
                } catch(ex) {}
                
            } else {
                
                // oh, cool, we just have to parse the content!
                this.loadStyleSheet(stylesheet.textContent,i);
                
            }
            
        }
    },
    
    monitoredProperties: Object.create ? Object.create(null) : {},
    monitoredPropertiesHandler: {
        onupdate: function(element, rule) {
            
            // we need to find all regexps that matches
            var mps = cssCascade.monitoredProperties;
            var decls = rule.value;
            for(var j=decls.length-1; j>=0; j--) {
                if(decls[j].type=="DECLARATION") {
                    if(decls[j].name in mps) {
                        
                        // call all handlers waiting for this
                        var hs = mps[decls[j].name];
                        for(var hi=hs.length; hi--;) {
                            hs[hi].onupdate(element,rule);
                        };
                        
                        // don't call twice
                        break;
                        
                    }
                }
            }
            
        }
    },
    
    startMonitoringProperties: function startMonitoringProperties(properties, handler) {
        
        for(var i=properties.length; i--; ) {
            var property = properties[i];
            var handlers = (
                cssCascade.monitoredProperties[property]
                || (cssCascade.monitoredProperties[property] = [])
            );
            handlers.push(handler)
        }
        
        for(var s=0; s<cssCascade.stylesheets.length; s++) {
            var currentStylesheet = cssCascade.stylesheets[s];
            cssCascade.startMonitoringStylesheet(currentStylesheet);
        }
        
    },
        
    startMonitoringStylesheet: function startMonitoringStylesheet(rules) {
        for(var i=0; i<rules.length; i++) {
            
            // only consider style rules
            if(rules[i] instanceof cssSyntax.StyleRule) {
                
                // try to see if the current rule is worth watching
                // for that, let's see if we can find a declaration we should watch
                var decls = rules[i].value;
                for(var j=decls.length-1; j>=0; j--) {
                    if(decls[j].type=="DECLARATION") {
                        if(decls[j].name in cssCascade.monitoredProperties) {
                            
                            // if we found some, start monitoring
                            cssCascade.startMonitoringRule(rules[i]);
                            break;
                            
                        }
                    }
                }
                
            } else {
                
                // TODO: handle @media
                
            }
            
        }
    },
    
    // 
    // splits a rule if it has multiple selectors
    // 
    splitRule: function splitRule(rule) {
        
        // create an array for all the subrules
        var rules = [];
        
        // fill the array
        var currentRule = new cssSyntax.StyleRule(); for(var i=0; i<rule.selector.length; i++) {
            if(rule.selector[i] instanceof cssSyntax.DelimToken && rule.selector[i].value==",") {
                currentRule.value = rule.value; rules.push(currentRule);
                currentRule = new cssSyntax.StyleRule(); 
            } else {
                currentRule.selector.push(rule.selector[i])
            }
        }
        currentRule.value = rule.value; rules.push(currentRule);
        
        // save the result of the split as subrules
        return rule.subRules = rules;
        
    },
    
    // 
    // ask the css-selector implementation to notify changes for the rules
    // 
    startMonitoringRule: function startMonitoringRule(rule) {
        
        // avoid monitoring rules twice
        if(!rule.isMonitored) { rule.isMonitored=true } else { return; }
        
        // split the rule if it has multiple selectors
        var rules = rule.subRules || cssCascade.splitRule(rule);
        
        // monitor the rules
        for(var i=0; i<rules.length; i++) {
            rule = rules[i];
            myQuerySelectorLive(rule.selector.toCSSString(), {
                onadded: function(e) {
                    
                    // add the rule to the matching list of this element
                    (e.myMatchedRules = e.myMatchedRules || []).push(rule); // TODO: does not respect priority order
                    
                    // generate an update event
                    cssCascade.monitoredPropertiesHandler.onupdate(e, rule);
                    
                },
                onremoved: function(e) {
                    
                    // remove the rule from the matching list of this element
                    if(e.myMatchedRules) e.myMatchedRules.splice(e.myMatchedRules.indexOf(rule), 1);
                    
                    // generate an update event
                    cssCascade.monitoredPropertiesHandler.onupdate(e, rule);
                    
                }
            });
        }
        
    }
    
};

cssCascade.loadAllStyleSheets();