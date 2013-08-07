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
        function visit(rules) {
            for(var r = rules.length; r--; ) {
                var rule = rules[r]; 
                
                // TODO: media queries hook
                if(rule.disabled) continue;
                
                if(rule instanceof cssSyntax.StyleRule) {
                    
                    // consider each selector independtly
                    var subrules = rule.subRules || cssCascade.splitRule(rule);
                    for(var sr = subrules.length; sr--; ) {
                        
                        var isMatching = false;
                        try {
                            if(element.matchesSelector) isMatching=element.matchesSelector(subrules[sr].selector.toCSSString())
                            else if(element.oMatchesSelector) isMatching=element.oMatchesSelector(subrules[sr].selector.toCSSString())
                            else if(element.msMatchesSelector) isMatching=element.msMatchesSelector(subrules[sr].selector.toCSSString())
                            else if(element.mozMatchesSelector) isMatching=element.mozMatchesSelector(subrules[sr].selector.toCSSString())
                            else if(element.webkitMatchesSelector) isMatching=element.webkitMatchesSelector(subrules[sr].selector.toCSSString())
                            else { throw new Error("wft u no element.matchesSelector?") }
                        } catch(ex) { debugger; setImmediate(function() { throw ex; }) }
                        
                        if(isMatching) { results.push(subrules[sr]); }
                        
                    }
                    
                } else if(rule instanceof cssSyntax.AtRule && rule.name=="media") {
                    
                    visit(rule.value);
                    
                }
                
            }
        }
        
        for(var s=cssCascade.stylesheets.length; s--; ) {
            var rules = cssCascade.stylesheets[s];
            visit(rules);
        }
        
        return results;
    },
    
    //
    // a list of all properties supported by the current browser
    //
    allCSSProperties: null,
    getAllCSSProperties: function getAllCSSProperties() {
        
        if(this.allCSSProperties) return this.allCSSProperties;
        
        // get all claimed properties
        var s = getComputedStyle(document.documentElement); var ps = new Array(s.length);
        for(var i=s.length; i--; ) {
            ps[i] = s[i];
        }
        
        // FIX A BUG WHERE WEBKIT DOESN'T REPORT ALL PROPERTIES
        if(ps.indexOf('content')==-1) {ps.push('content');}
        if(ps.indexOf('counter-reset')==-1) {
            
            ps.push('counter-reset');
            ps.push('counter-increment');
            
            // FIX A BUG WHERE WEBKIT RETURNS SHIT FOR THE COMPUTED VALUE OF COUNTER-RESET
            cssCascade.computationUnsafeProperties['counter-reset']=true;
            
        }
        
        // save in a cache for faster access the next times
        return this.allCSSProperties = ps;
        
    },
    
    // 
    // those properties are not safe for computation->specified round-tripping
    // 
    computationUnsafeProperties: {
        "bottom": false,
        "direction": false,
        "display": false,
        "font-size": false,
        "height":false,
        "left": false,
        "line-height": false,
        "max-height": false,
        "max-width": false,
        "min-height": false,
        "min-width": false,
        "right": false,
        "text-align": false,
        "text-align-last": false,
        "top": false,
        "width": false,
    },
    
    //
    // a list of property we should inherit...
    //
    inheritingProperties: {
        "border-collapse": false,
        "border-spacing": false,
        "caption-side": false,
        "color": false,
        "cursor": false,
        "direction": false,
        "empty-cells": false,
        "font-family": false,
        "font-size": false,
        "font-style": false,
        "font-variant": false,
        "font-weight": false,
        "font": false,
        "letter-spacing": false,
        "line-height": false,
        "list-style-image": false,
        "list-style-position": false,
        "list-style-type": false,
        "list-style": false,
        "orphans": false,
        "quotes": false,
        "text-align": false,
        "text-indent": false,
        "text-transform": false,
        "visibility": false,
        "white-space": false,
        "widows": false,
        "word-break": false,
        "word-spacing": false,
        "word-wrap": false,
    },
    
    defaultStylesForTag: Object.create ? Object.create(null) : {},
    getDefaultStyleForTag: function getDefaultStyleForTag(tagName) {
        
        // get result from cache
        var result = cssRegionsHelpers[tagName];
        if(result) return result;
        
        // create dummy virtual element
        var element = document.createElement(tagName);
        var style = cssRegionsHelpers[tagName] = getComputedStyle(element);
        if(style.display) return style;
        
        // webkit fix: insert the dummy element anywhere (head -> display:none)
        document.head.insertBefore(element, document.head.firstChild);
        return style;
    },
    
    getSpecifiedStyle: function getSpecifiedStyle(element, cssPropertyName, matchedRules, stringOnly) {
        
        // hook for css regions
        var fragmentSource;
        if(fragmentSource=element.getAttribute('data-css-regions-fragment-of')) {
            fragmentSource = document.querySelector('[data-css-regions-fragment-source="'+fragmentSource+'"]');
            if(fragmentSource) return cssCascade.getSpecifiedStyle(fragmentSource, cssPropertyName);
        }
        
        // give IE a thumbs up for this!
        if(element.currentStyle) {
            
            // ask IE to manage the style himself...
            var bestValue = element.myStyle[cssPropertyName] || element.currentStyle[cssPropertyName];
            
            // return a parsed representation of the value
            return cssSyntax.parseCSSValue(bestValue, stringOnly);
            
        } else {
            
            // TODO: support the "initial" and "inherit" things?
            
            // first, let's try inline style as it's fast and generally accurate
            // TODO: what if important rules override that?
            try {
                if(bestValue = element.style.getPropertyValue(cssPropertyName) || element.myStyle[cssPropertyName]) {
                    return cssSyntax.parseCSSValue(bestValue, stringOnly);
                }
            } catch(ex) {}
            
            // find all relevant style rules
            var isBestImportant=false; var bestPriority = 0; var bestValue = new cssSyntax.TokenList();
            var rules = matchedRules || (
                cssPropertyName in cssCascade.monitoredProperties
                ? element.myMatchedRules || []
                : cssCascade.findAllMatchingRules(element)
            );
            
            function visit(rules) {
                
                for(var i=rules.length; i--; ) {
                    
                    // TODO: media queries hook
                    if(rules[i].disabled) continue;
                    
                    // find a relevant declaration
                    if(rules[i] instanceof cssSyntax.StyleRule) {
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
                    } else if((rules[i] instanceof cssSyntax.AtRule) && (rules[i].name=="media")) {
                        
                        visit(rules[i].value);
                        
                    }
                    
                }
                
            }
            visit(rules);
            
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
    
    loadStyleSheetTag: function loadStyleSheetTag(stylesheet,i) {
        
        if(stylesheet.hasAttribute('data-css-polyfilled')) {
            return;
        }
        
        if(stylesheet.tagName=='LINK') {
            
            // oh, no, we have to download it...
            try {
                
                // dummy value in-between
                cssCascade.stylesheets[i] = new cssSyntax.TokenList();
                
                //
                var xhr = new XMLHttpRequest(); xhr.href = stylesheet.href;
                xhr.open('GET',stylesheet.href,true); xhr.ruleIndex = i; 
                xhr.onreadystatechange = function() {
                    if(this.readyState==4) { 
                        
                        // status 0 is a webkit bug for local files
                        if(this.status==200||this.status==0) {
                            cssCascade.loadStyleSheet(this.responseText,this.ruleIndex)
                        } else {
                            console.log("css-cascade polyfill failled to load: " + this.href);
                        }
                    }
                };
                xhr.send();
                
            } catch(ex) {
                console.log("css-cascade polyfill failled to load: " + stylesheet.href);
            }
            
        } else {
            
            // oh, cool, we just have to parse the content!
            cssCascade.loadStyleSheet(stylesheet.textContent,i);
            
        }
        
        // mark the stylesheet as ok
        stylesheet.setAttribute('data-css-polyfilled',true);
        
    },
    
    selectorForStylesheets: "style:not([data-no-css-polyfill]):not([data-css-polyfilled]), link[rel=stylesheet]:not([data-no-css-polyfill]):not([data-css-polyfilled])",
    loadAllStyleSheets: function loadAllStyleSheets() {
        
        // for all stylesheets in the <head> tag...
        var head = document.head || document.documentElement;
        var stylesheets = head.querySelectorAll(cssCascade.selectorForStylesheets);
        
        var intialLength = this.stylesheets.length;
        this.stylesheets.length += stylesheets.length
        
        // for all of them...
        for(var i = stylesheets.length; i--;) {
            
            // 
            // load the stylesheet
            // 
            var stylesheet = stylesheets[i]; 
            cssCascade.loadStyleSheetTag(stylesheet,intialLength+i)
            
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
                
                // try to see if the current rule is worth monitoring
                if(rules[i].isMonitored) continue;
                
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
                
            } else if(rules[i] instanceof cssSyntax.AtRule) {
                
                // TODO: handle @media
                if(rules[i].name == "media" && window.matchMedia) {
                    
                    cssCascade.startMonitoringMedia(rules[i]);
                    
                }
                
            }
            
        }
    },
    
    startMonitoringMedia: function startMonitoringMedia(atrule) {
        try {
            
            var media = window.matchMedia(atrule.prelude.toCSSString());
            
            // update all the rules when needed
            cssCascade.updateMedia(atrule.value, !media.matches, false);
            media.addListener(
                function(newMedia) { cssCascade.updateMedia(atrule.value, !newMedia.matches, true); }
            );
            
            // it seems I like taking risks...
            cssCascade.startMonitoringStylesheet(atrule.value);
            
        } catch(ex) {
            setImmediate(function() { throw ex; })
        }
    },
    
    updateMedia: function(rules,disabled,update) {
        for(var i=rules.length; i--; ) {
            rules[i].disabled = disabled;
            // TODO: should probably get handled by a setter on the rule...
            var sr = rules[i].subRules;
            if(sr) {
                for(var j=sr.length; j--; ) {
                    sr[j].disabled = disabled;
                }
            }
        }
        
        // in case of update, all elements matching the selector went potentially updated...
        if(update) {
            for(var i=rules.length; i--; ) {
                var els = document.querySelectorAll(rules[i].selector.toCSSString());
                for(var j=els.length; j--; ) {
                    cssCascade.monitoredPropertiesHandler.onupdate(els[j],rules[i]);
                }
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
        var currentRule = new cssSyntax.StyleRule(); currentRule.disabled=rule.disabled;
        for(var i=0; i<rule.selector.length; i++) {
            if(rule.selector[i] instanceof cssSyntax.DelimToken && rule.selector[i].value==",") {
                currentRule.value = rule.value; rules.push(currentRule);
                currentRule = new cssSyntax.StyleRule(); currentRule.disabled=rule.disabled;
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
        
    },
        
    toCamelCase: function toCamelCase(variable) { 
        return variable.replace(
            /-([a-z])/g, 
            function(str,letter) { 
                return letter.toUpperCase();
            }
        );
    },
    
    polyfillStyleInterface: function(cssPropertyName) {
        
        var prop = {
            
            get: function() {
                
                try { if(!this.parentElement) throw new Error("Please use the anHTMLElement.myStyle property to get polyfilled properties") }
                catch(ex) { setImmediate(function() { throw ex; }) }
                
                return this.parentElement.getAttribute('data-style-'+cssPropertyName);
                
            },
            
            set: function(v) {
                
                try { if(!this.parentElement) throw new Error("Please use the anHTMLElement.myStyle property to set polyfilled properties") }
                catch(ex) { setImmediate(function() { throw ex; }) }
                
                if(this.parentElement.getAttribute('data-style-'+cssPropertyName) != v) {
                    this.parentElement.setAttribute('data-style-'+cssPropertyName,v);
                }
                
            }
            
        };
        
        var styleProto = Object.getPrototypeOf(document.documentElement.style) || CSSStyleDeclaration;
        Object.defineProperty(styleProto,cssPropertyName,prop);
        Object.defineProperty(styleProto,cssCascade.toCamelCase(cssPropertyName),prop);
        cssCascade.startMonitoringRule(cssSyntax.parse('[data-style-'+cssPropertyName+']{'+cssPropertyName+':attr(style)}').value[0]);
        
        // add to the list of polyfilled properties...
        cssCascade.getAllCSSProperties().push(cssPropertyName);
        cssCascade.computationUnsafeProperties[cssPropertyName] = true;
        
    }
    
};

basicObjectModel.EventTarget.implementsIn(cssCascade);
Object.defineProperty(Element.prototype,'myStyle',{
    get: function() {
        var style = this.style; 
        if(!style.parentElement) style.parentElement = this;
        return style;
    }
});

cssCascade.loadAllStyleSheets();
document.addEventListener("DOMContentLoaded", function() {
    cssCascade.loadAllStyleSheets();
    if(window.myQuerySelectorLive) {
        window.myQuerySelectorLive(
            cssCascade.selectorForStylesheets,
            {
                onadded: function(e) {
                    // TODO: respect DOM order?
                    cssCascade.loadStyleSheetTag(e);
                    cssCascade.dispatchEvent('stylesheetadded');
                }
            }
        )
    }
})