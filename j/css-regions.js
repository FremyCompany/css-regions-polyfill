"use script";    

///
/// now create a module for region reflow
///

var cssRegions = {
    layoutContent: function(regions, remainingContent, secondCall) {
        
        //
        // this function will iteratively fill all the regions
        // when we reach the last region, we put accept overflow
        //
        
        // validate args
        if(!regions) return;
        if(!regions.length) return;
        
        // get the next region
        var region = regions.pop();
        
        // the region is actually the wrapper inside
        if(region.cssRegionsWrapper) {
            region.cssRegionsWrapper.cssRegionsHost = region;
            region = region.cssRegionsWrapper;
        } else {
            region.cssRegionHost = region;
        }
        
        // append the remaining content to the region
        region.innerHTML = '';
        region.appendChild(remainingContent);
        
        // check if we have more regions to process
        if(regions.length !== 0) {
            
            // check if there was an overflow
            if(region.cssRegionHost.scrollHeight != region.cssRegionHost.offsetHeight) {
                
                // the remaining content is what was overflowing
                remainingContent = this.extractOverflowingContent(region);
                
            } else {
                
                // there's nothing more to insert
                remainingContent = document.createDocumentFragment();
                
            }
            
            // layout the next regions
            cssRegions.layoutContent(regions, remainingContent, true); // TODO: use do...while instead of recursion
            
        } else {
            
            // TODO: support region-fragment: break
            if(false) {
                this.extractOverflowingContent(region);
            }
            
        }
        
        // TODO: support 'regionOverset' and region events
        
    },
    
    getAllLevelPreviousSibling: function(e, region) {
        if(!e || e==region) return null;
        
        // find the nearest ancestor that has a previous sibling
        while(!e.previousSibling) {
            
            // but bubble to the next avail ancestor
            e = e.parentNode;
            
            // dont get over the bar
            if(!e || e==region) return null;
            
        }
        
        // return that sibling
        return e.previousSibling;
    },
    
    extractOverflowingContent: function(region, dontOptimize) {
        
        // make sure empty nodes don't make our life more difficult
        this.embedTrailingWhiteSpaceNodes(region);
        
        // get the region layout
        var sizingH = region.cssRegionHost.offsetHeight; // avail size (max-height)
        var sizingW = region.cssRegionHost.offsetWidth; // avail size (max-width)
        var pos = region.cssRegionHost.getBoundingClientRect(); // avail size?
        pos = {top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right};
        
        
        //
        // note: let's use hit targeting to find a dom range
        // which is close to the location where we will need to
        // break the content into fragments
        // 
        
        // get the caret range for the bottom-right of that location
        var r = dontOptimize ? document.createRange() : document.caretRangeFromPoint(
            pos.left + sizingW - 1,
            pos.top + sizingH - 1
        );
        
        // if the caret is outside the region
        if(!r || region !== r.endContainer && !region.contains(r.endContainer)) {
            
            // if the caret is after the region wrapper but inside the host...
            if(r && r.endContainer === region.cssRegionHost && r.endOffset==r.endContainer.childNodes.length) {
                
                // move back at the end of the region, actually
                r.setEnd(region, region.childNodes.length);
                
            } else {
                
                // move back into the region
                r = r || document.createRange();
                r.setStart(region, 0);
                r.setEnd(region, 0);
                dontOptimize=true;
                
            }
        }
        
        // start finding the natural breaking point
        do {
            
            // store the current selection rect for fast access
            var rect = r.myGetExtensionRect();
            
            //console.log('start negotiation');
            //console.dir({
            //    startContainer: r.startContainer,
            //    startOffset: r.startOffset,
            //    browserBCR: r.getBoundingClientRect(),
            //    computedBCR: rect
            //});
            
            //
            // note: maybe the text is right-to-left
            // in this case, we can go further than the caret
            //
            
            // move the end point char by char until it's completely in the region
            while(!(r.endContainer==region && r.endOffset==r.endContainer.childNodes.length) && rect.bottom<=pos.top+sizingH) {
                r.myMoveOneCharRight(); rect = r.myGetExtensionRect();
            }
            
            //
            // note: maybe the text is one line too big
            // in this case, we have to backtrack a little
            //
            
            // move the end point char by char until it's completely in the region
            while(!(r.endContainer==region && r.endOffset==0) && rect.bottom>pos.top+sizingH) {
                r.myMoveOneCharLeft(); rect = r.myGetExtensionRect();
            }
            
            //
            // note: if we optimized via hit-testing, this may be wrong
            // if next condition does not hold, we're fine. 
            // otherwhise we must restart without optimization...
            //
            
            // if the selected content is really off target
            var optimizationFailled = false; if(!dontOptimize) {
                
                var current = r.endContainer;
                while(current = this.getAllLevelPreviousSibling(current, region)) {
                    if(Node.getBoundingClientRect(current).bottom > pos.top + sizingH) {
                        optimizationFailled=true;
                        dontOptimize=true;
                        break;
                    }
                }
                
            }
            
        } while(optimizationFailled) 
        
        // 
        // note: we should not break the content inside monolithic content
        // if we do, we need to change the selection to avoid that
        // 
        
        // move the selection before the monolithic ancestors
        var current = r.endContainer;
        while(current !== region) {
            if(cssBreak.isMonolithic(current)) {
                r.setEndBefore(current);
            }
            current = current.parentNode;
        }
        
        
        // 
        // note: we don't want to break inside a line.
        // backtrack to end of previous line...
        // 
        var first = r.startContainer.childNodes[r.startOffset], current = first; 
        while((current) && (current = current.previousSibling)) {
            
            if(cssBreak.areInSameSingleLine(current,first)) {
                
                // optimization: first and current are on the same line
                first = current;

                if(current instanceof Element) {
                    
                    // we don't want to break inside text lines
                    r.setEndBefore(current);
                    
                } else {
                    
                    // TODO: get last line via client rects
                    var lines = Node.getClientRects(current);
                    
                    // if the text node did wrap
                    if(lines.length>1) {
                        
                        // move back from the end until we get into previous line
                        var previousLineBottom = lines[lines.length-2].bottom;
                        r.setEnd(current, current.nodeValue.length);
                        while(rect.bottom>previousLineBottom) {
                            r.myMoveOneCharLeft(); rect = r.myGetExtensionRect();
                        }
                        
                        // TODO: ?move forward to break after this previous line?
                        //while(rect.bottom<=previousLineBottom) {
                        //    r.myMoveOneCharRight(); rect = r.myGetExtensionRect();
                        //}
                        
                    } else {
                        
                        // we can consider the text node as an element
                        r.setEndBefore(current);
                        
                    }
                    
                }
            } else {
                break;
            }
            
        }
        
        
        // 
        // note: the css-break spec says that a region should not be emtpy
        // 
        
        // if we end up with nothing being selected, add the first block anyway
        if(r.endContainer===region && r.endOffset===0 && r.endOffset!==region.childNodes.length) {
            
            // find the first allowed break point
            do { r.myMoveOneCharRight(); } 
            while(!cssBreak.isPossibleBreakPoint(r,region) && !(r.endContainer===region && r.endOffset===region.childNodes.length))
            
        }
        
        var current = r.endContainer; var allAncestors=[];
        if(current.nodeType !== current.ELEMENT_NODE) current=current.parentNode;
        while(current !== region) {
            allAncestors.push(current);
            current = current.parentNode;
        }
        
        //
        // note: if we're about to split after the last child of
        // an element which has bottom-{padding/border/margin}, 
        // we need to figure how how much of that p/b/m we can
        // actually keep in the first fragment
        //
        
        // TODO: avoid top & bottom p/b/m cuttings to use the same variables
        
        // split bottom-{margin/border/padding} correctly
        if(r.endOffset == r.endContainer.childNodes.length && r.endContainer !== region) {
            
            // compute how much of the bottom border can actually fit
            var box = r.endContainer.getBoundingClientRect();
            var excessHeight = box.bottom - (pos.top + sizingH);
            var endContainerStyle = getComputedStyle(r.endContainer);
            var availBorderHeight = parseFloat(endContainerStyle.borderBottomWidth);
            var availPaddingHeight = parseFloat(endContainerStyle.paddingBottom);
            
            // start by cutting into the border
            var borderCut = excessHeight;
            if(excessHeight > availBorderHeight) {
                borderCut = availBorderHeight;
                excessHeight -= borderCut;
                
                // continue by cutting into the padding
                var paddingCut = excessHeight;
                if(paddingCut > availPaddingHeight) {
                    paddingCut = availPaddingHeight;
                    excessHeight -= paddingCut;
                } else {
                    excessHeight = 0;
                }
            } else {
                excessHeight = 0;
            }
            
            
            // we don't cut borders with radiuses
            // TODO: accept to cut the content not affected by the radius
            if(typeof(borderCut)==="number" && borderCut!==0) {
                
                // check the presence of a radius:
                var hasBottomRadius = (
                    parseInt(endContainerStyle.borderBottomLeftRadius)>0
                    || parseInt(endContainerStyle.borderBottomRightRadius)>0
                );
                
                if(hasBottomRadius) {
                    // break before the whole border:
                    borderCut = availBorderHeight;
                }
                
            }
            
        }
        
        
        // TODO: split top-{margin/border/padding} correctly
        // that one is tricky because this is the next element that
        // could possibly be fragmented to show a bit of his border
        // but we have to check a lot of conditions...
        if(r.endOffset == 0 && r.endContainer !== region) {
            
            // note: the only possibility here is that we 
            // did split after a padding or a border
            
            // compute how much of the top border can actually fit
            var box = r.endContainer.getBoundingClientRect();
            var availHeight = (pos.top + sizingH) - pos.top;
            var endContainerStyle = getComputedStyle(r.endContainer);
            var availBorderHeight = parseFloat(endContainerStyle.borderTopWidth);
            var availPaddingHeight = parseFloat(endContainerStyle.paddingTop);
            var excessHeight = availBorderHeight + availPaddingHeight - availHeight;
            
            if(excessHeight > 0) {
            
                // start by cutting into the padding
                var topPaddingCut = excessHeight;
                if(excessHeight > availPaddingHeight) {
                    topPaddingCut = availPaddingHeight;
                    excessHeight -= topPaddingCut;
                    
                    // continue by cutting into the border
                    var topBorderCut = excessHeight;
                    if(topBorderCut > availBorderHeight) {
                        topBorderCut = availBorderHeight;
                        excessHeight -= topBorderCut;
                    } else {
                        excessHeight = 0;
                    }
                } else {
                    excessHeight = 0;
                }
                
            }
            
        }
        
        // remove bottom-{pbm} from all ancestors involved in the cut
        for(var i=allAncestors.length-1; i>=0; i--) {
            allAncestors[i].setAttribute('data-css-continued-fragment',true); //TODO: this requires some css
        }
        if(typeof(borderCut)==="number") {
            allAncestors[0].removeAttribute('data-css-continued-fragment');
            allAncestors[0].setAttribute('data-css-special-continued-fragment',true);
            allAncestors[0].style.borderBottomWidth = (availBorderHeight-borderCut)+'px';
        }
        if(typeof(paddingCut)==="number") {
            allAncestors[0].removeAttribute('data-css-continued-fragment');
            allAncestors[0].setAttribute('data-css-special-continued-fragment',true);
            allAncestors[0].style.paddingBottom = (availPaddingHeight-paddingCut)+'px';
        }
        if(typeof(topBorderCut)==="number") {
            allAncestors[0].removeAttribute('data-css-continued-fragment');
            allAncestors[0].setAttribute('data-css-continued-fragment',true);
            allAncestors[0].style.borderTopWidth = (availBorderHeight-topBorderCut)+'px';
        }
        if(typeof(topPaddingCut)==="number") {
            allAncestors[0].removeAttribute('data-css-continued-fragment');
            allAncestors[0].setAttribute('data-css-special-continued-fragment',true);
            allAncestors[0].style.paddingTop = (availPaddingHeight-topPaddingCut)+'px';
        }
        
        
        //
        // note: now we have a collapsed range 
        // located at the split point
        //
        
        // select the overflowing content
        r.setEndAfter(region.lastChild);
        
        // extract it from the current region
        var overflowingContent = r.extractContents();
        
        
        // 
        // note: now we have to cancel out the artifacts of
        // the fragments cloning algorithm...
        //
        
        // do not forget to remove any top p/b/m on cut elements
        var newFragments = overflowingContent.querySelectorAll("[data-css-continued-fragment]");
        for(var i=newFragments.length; i--;) { // TODO: optimize by using while loop and a simple qS.
            newFragments[i].removeAttribute('data-css-continued-fragment')
            newFragments[i].setAttribute('data-css-starting-fragment',true); //TODO: this requires some css
        }
        
        // deduct any already-used bottom p/b/m
        var specialNewFragment = overflowingContent.querySelector('[data-css-special-continued-fragment]');
        if(specialNewFragment) {
            specialNewFragment.removeAttribute('data-css-special-continued-fragment')
            specialNewFragment.setAttribute('data-css-starting-fragment',true);
            
            if(typeof(borderCut)==="number") {
                specialNewFragment.style.borderBottomWidth = (borderCut)+'px';
            }
            if(typeof(paddingCut)==="number") {
                specialNewFragment.style.paddingBottom = (paddingCut);
            } else {
                specialNewFragment.style.paddingBottom = '0px';
            }
            
            if(typeof(topBorderCut)==="number") {
                specialNewFragment.removeAttribute('data-css-starting-fragment')
                specialNewFragment.setAttribute('data-css-special-starting-fragment',true);
                specialNewFragment.style.borderTopWidth = (topBorderCut)+'px';
            }
            if(typeof(topPaddingCut)==="number") {
                specialNewFragment.removeAttribute('data-css-starting-fragment')
                specialNewFragment.setAttribute('data-css-special-starting-fragment',true);
                specialNewFragment.style.paddingTop = (topPaddingCut)+'px';
                specialNewFragment.style.paddingBottom = '0px';
                specialNewFragment.style.borderBottomWidth = '0px';
            }
            
        } else if(typeof(borderCut)==="number") {
            
            // TODO: hum... there's an element missing here...
            try { throw new Error() }
            catch(ex) { setImmediate(function() { throw ex; }) }
            
        } else if(typeof(topPaddingCut)==="number") {
            
            // TODO: hum... there's an element missing here...
            try { throw new Error() }
            catch(ex) { setImmediate(function() { throw ex; }) }
            
        }
        
        
        // make sure empty nodes are reintroduced
        this.unembedTrailingWhiteSpaceNodes(region);
        this.unembedTrailingWhiteSpaceNodes(overflowingContent);
        
        // we're ready to return our result!
        return overflowingContent;
        
    },
    
    markNodesAsRegion: function(nodes,fast) {
        nodes.forEach(function(node) {
            node.setAttribute('data-css-region',true);
            node.cssRegionsLastFlowIntoType=="content" && cssRegions.hideTextNodesFromFragmentSource(node);
            node.cssRegionsWrapper = node.cssRegionsWrapper || node.appendChild(document.createElement("cssregion"));
        });
    },
    
    unmarkNodesAsRegion: function(nodes,fast) {
        nodes.forEach(function(node) {
            node.cssRegionsWrapper && node.removeChild(node.cssRegionsWrapper); delete node.cssRegionsWrapper;
            node.cssRegionsLastFlowIntoType=="content" && cssRegions.unhideTextNodesFromFragmentSource(node);
            node.removeAttribute('data-css-region');
        });
    },
    
    fragmentSourceIndex: 0,
    markNodesAsFragmentSource: function(nodes) {
        
        function visit(node) {
            var child, next;
            switch (node.nodeType) {
                case 1: // Element node
                    
                    // mark as fragment source
                    var id = node.getAttributeNode('data-css-regions-fragment-source');
                    if(!id) { node.setAttribute('data-css-regions-fragment-source', cssRegions.fragmentSourceIndex++); }
                    
                    // expand list values
                    if(node.tagName=='OL') cssRegions.expandListValues(node);
                    
                case 9: // Document node
                case 11: // Document fragment node
                    child = node.firstChild;
                    while (child) {
                        next = child.nextSibling;
                        visit(child);
                        child = next;
                    }
                    break;
            }
        }
        
        nodes.forEach(visit);
        
    },
    
    expandListValues: function(OL) {
        var currentValue = OL.getAttribute("start") ? parseInt(OL.getAttribute("start")) : 1;
        var LI = OL.firstElementChild; var LIV = null;
        while(LI) {
            if(LI.tagName==="LI") {
                if(LIV=LI.getAttributeNode("value")) {
                    currentValue = parseInt(LIV.nodeValue);
                    LI.setAttribute('data-css-old-value', currentValue)
                } else {
                    LI.setAttribute("value", currentValue);
                    currentValue = currentValue + 1;
                }
            }
            LI = LI.nextElementSibling;
        }
    },
    
    unexpandListValues: function(OL) {
        var LI = OL.firstElementChild; var LIV = null;
        while(LI) {
            if(LI.tagName==="LI") {
                if(LIV=LI.getAttributeNode("data-css-old-value")) {
                    LI.removeAttributeNode(LIV);
                } else {
                    LI.removeAttribute('value');
                }
            }
            LI = LI.nextElementSibling;
        }
    },
    
    hideTextNodesFromFragmentSource: function(nodes) {
        
        function visit(node) {
            var child, next;
            switch (node.nodeType) {
                case 3: // Text node
                    
                    // we have to remove their content the hard way...
                    node.cssRegionsSavedNodeValue = node.nodeValue;
                    if(afterClone) node.nodeValue = "";
                    
                    break;
                case 1: // Element node
                case 9: // Document node
                case 11: // Document fragment node
                    child = node.firstChild;
                    while (child) {
                        next = child.nextSibling;
                        visit(child);
                        child = next;
                    }
                    break;
            }
        }
        
        nodes.forEach(visit);
        
    },
        
    unmarkNodesAsFragmentSource: function(nodes) {
        
        function visit(node) {
            var child, next;
            switch (node.nodeType) {
                case 3: // Text node
                    
                    // we have to reinstall their content the hard way...
                    if("cssRegionsSavedNodeValue" in node) {
                        node.nodeValue = node.cssRegionsSavedNodeValue;
                        delete node.cssRegionsSavedNodeValue;
                    }
                    
                    break;
                case 1: // Element node
                    node.removeAttribute('data-css-regions-fragment-source');
                    if(node.tagName=="OL") cssRegions.unexpandListValues(node);
                    
                case 9: // Document node
                case 11: // Document fragment node
                    child = node.firstChild;
                    while (child) {
                        next = child.nextSibling;
                        visit(child);
                        child = next;
                    }
                    break;
            }
        }
        
        nodes.forEach(visit);
        
    },
    
    transformFragmentSourceToFragments: function(nodes) {
        
        function visit(node) {
            var child, next;
            switch (node.nodeType) {
                case 1: // Element node
                    var id = node.getAttributeNode('data-css-regions-fragment-source');
                    node.removeAttribute('data-css-regions-fragment-source');
                    node.setAttribute('data-css-regions-fragment-of', id);
                    
                case 9: // Document node
                case 11: // Document fragment node
                    child = node.firstChild;
                    while (child) {
                        next = child.nextSibling;
                        visit(child);
                        child = next;
                    }
                    break;
            }
        }
        
        nodes.forEach(visit);
        
    },
    
    embedTrailingWhiteSpaceNodes: function(fragment) {
        
        var onlyWhiteSpace = /^\s*$/;
        function visit(node) {
            var child, next;
            switch (node.nodeType) {
                case 3: // Text node
                    
                    // we only remove nodes at the edges
                    if (!node.previousSibling) {
                        
                        // we only remove nodes if their parent doesn't preserve whitespace
                        if (getComputedStyle(node.parentNode).whiteSpace.substring(0,3)!=="pre") {
                            
                            // only remove pure whitespace nodes
                            if (onlyWhiteSpace.test(node.nodeValue)) {
                                node.parentNode.setAttribute('data-whitespace-before',node.nodeValue);
                                node.parentNode.removeChild(node);
                            }
                            
                        }
                        
                        break;
                    }
                    
                    // we only remove nodes at the edges
                    if (!node.nextSibling) {
                        
                        // we only remove nodes if their parent doesn't preserve whitespace
                        if (getComputedStyle(node.parentNode).whiteSpace.substring(0,3)!=="pre") {
                            
                            // only remove pure whitespace nodes
                            if (onlyWhiteSpace.test(node.nodeValue)) {
                                node.parentNode.setAttribute('data-whitespace-after',node.nodeValue);
                                node.parentNode.removeChild(node);
                            }
                            
                        }
                        
                        break;
                    }
                    
                    break;
                case 1: // Element node
                case 9: // Document node
                case 11: // Document fragment node
                    child = node.firstChild;
                    while (child) {
                        next = child.nextSibling;
                        visit(child);
                        child = next;
                    }
                    break;
            }
        }
        
        visit(fragment);
        
    },
    
    unembedTrailingWhiteSpaceNodes: function(fragment) {
        
        var onlyWhiteSpace = /^\s*$/;
        function visit(node) {
            var child, next;
            switch (node.nodeType) {
                case 1: // Element node
                    var txt = "";
                    if(txt = node.getAttribute('data-whitespace-before')) {
                        if(node.getAttribute('data-starting-fragment')=='' && node.getAttribute('data-special-starting-fragment','')) {
                            node.insertBefore(document.createTextNode(txt),node.firstChild);
                        }
                    }
                    node.removeAttribute('data-whitespace-before')
                    if(txt = node.getAttribute('data-whitespace-after')) {
                        if(node.getAttribute('data-continued-fragment')=='' && node.getAttribute('data-special-continued-fragment','')) {
                            node.insertAfter(document.createTextNode(txt),node.lastChild);
                        }
                    }
                    node.removeAttribute('data-whitespace-after')
                    
                case 9: // Document node
                case 11: // Document fragment node
                    child = node.firstChild;
                    while (child) {
                        next = child.nextSibling;
                        visit(child);
                        child = next;
                    }
                    break;
            }
        }
        
        visit(fragment);
        
    },
        
    enablePolyfill: function enablePolyfill() {
        
        // 
        // [1] looks for stylesheets to load
        // 
        var ss = document.getElementsByTagName("style");
        var s = ss[0]; var handler = {};
        
        // 
        // [2] when stylesheets are loaded, grab region-active selectors
        // and follow them using the myQuerySelectorLive polyfill
        // 
        setImmediate(function() {
            
            var rules = cssSyntax.parse(ss[0].textContent).value;
            for(var i=0; i<rules.length; i++) {
                
                // only consider style rules
                if(rules[i] instanceof cssSyntax.StyleRule) {
                
                    // try to see if the current rule is worth watching
                    var decls = rules[i].value;
                    for(var j=decls.length-1; j>=0; j--) {
                        if(decls[j].type=="DECLARATION") {
                            if((/^flow-(from|into)$/i).test(decls[j].name)) {
                                cssCascade.startMonitoringRule(rules[i], handler);
                                break;
                            }
                        }
                    }
                    
                } else {
                    
                    // TODO: handle @media
                    
                }
                
            }
            
        });
        
        // 
        // [3] when any update happens
        // construct new content and region flow pairs
        // restart the region layout algorithm for the modified pairs
        // 
        handler.onupdate = function onupdate(element, rule) {
            
            // let's just ignore fragments
            if(element.getAttributeNode('data-css-fragment-of')) return;
            
            // update the layout
            console.dir({message:"onupdate",element:element,selector:rule.selector.toCSSString(),rule:rule});
            var temp = null;
            
            var flowInto = (
                cssCascade.getSpecifiedStyle(element, "flow-into")
                .filter(function(t) { return t instanceof cssSyntax.IdentifierToken })
            );
            var flowIntoName = flowInto[0] ? flowInto[0].toCSSString().toLowerCase() : ""; if(flowIntoName=="none") {flowIntoName=""}
            var flowIntoType = flowInto[1] ? flowInto[1].toCSSString().toLowerCase() : ""; if(flowIntoType!="content") {flowIntoType="element"}
            var flowInto = flowIntoName + " " + flowIntoType;
            
            var flowFrom = (
                cssCascade.getSpecifiedStyle(element, "flow-from")
                .filter(function(t) { return t instanceof cssSyntax.IdentifierToken })
            );
            var flowFromName = flowFrom[0] ? flowFrom[0].toCSSString().toLowerCase() : ""; if(flowFromName=="none") {flowFromName=""}
            var flowFrom = flowFromName;
            
            if(element.cssRegionsLastFlowInto != flowInto || element.cssRegionsLastFlowFrom != flowFrom) {
                
                // remove from previous regions
                var lastFlowFrom = (cssRegions.flows[element.cssRegionsLastFlowFromName]);
                var lastFlowInto = (cssRegions.flows[element.cssRegionsLastFlowIntoName]);
                lastFlowFrom && lastFlowFrom.removeFromRegions(element);
                lastFlowInto && lastFlowInto.removeFromContent(element);
                
                // save data for later
                element.cssRegionsLastFlowInto = flowInto;
                element.cssRegionsLastFlowFrom = flowFrom;
                element.cssRegionsLastFlowIntoName = flowIntoName;
                element.cssRegionsLastFlowFromName = flowFromName;
                element.cssRegionsLastFlowIntoType = flowIntoType;
                
                // add to new regions
                if(flowFromName) {
                    var lastFlowFrom = (cssRegions.flows[flowFromName] = cssRegions.flows[flowFromName] || new cssRegions.Flow());
                    lastFlowFrom && lastFlowFrom.addToRegions(element);
                    lastFlowFrom && lastFlowFrom.relayout();
                }
                if(flowIntoName) {
                    var lastFlowInto = (cssRegions.flows[flowIntoName] = cssRegions.flows[flowIntoName] || new cssRegions.Flow());
                    lastFlowInto && lastFlowInto.addToContent(element);
                    lastFlowInto && lastFlowInto.relayout();
                }
                
            }
            
        }
        
    },
    
    // this dictionnary is supposed to contains all the currently existing flows
    flows: Object.create ? Object.create(null) : {},
    
    // this class contains flow-relative data field
    Flow: function Flow() {
        
        // elements poured into the flow
        this.content = [];
        
        // elements that consume this flow
        this.regions = [];
    }
    
};
    
cssRegions.Flow.prototype.removeFromContent = function(element) {
    
    // TODO: clean up stuff
    if(element.cssRegionsEventStream) {
        element.cssRegionsEventStream.disconnect();
        delete element.cssRegionsEventStream;
    }
    
    // remove reference
    var index = this.content.indexOf(element);
    if(index>=0) { this.content.splice(index,1); }
    
};

cssRegions.Flow.prototype.removeFromRegions = function(element) {
    
    // TODO: clean up stuff
    if(element.cssRegionsEventStream) {
        element.cssRegionsEventStream.disconnect();
        delete element.cssRegionsEventStream;
    }
    
    // remove reference
    var index = this.regions.indexOf(element);
    if(index>=0) { this.regions.splice(index,1); }
    
};

cssRegions.Flow.prototype.addToContent = function(element) {
    
    // walk the tree to find an element inside the content chain
    var content = this.content;
    var treeWalker = document.createTreeWalker(
        document.documentElement,
        NodeFilter.SHOW_ELEMENT,
        { 
            acceptNode: function(node) { 
                return content.indexOf(node) >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; 
            }
        },
        false
    ); 
    
    // which by the way has to be after the considered element
    treeWalker.currentNode = element;
    
    // if we find such node
    if(treeWalker.nextNode()) {
        
        // insert the element at his current location
        content.splice(content.indexOf(treeWalker.currentNode),0,element);
        
    } else {
        
        // add the new element to the end of the array
        content.push(element);
        
    }

};

cssRegions.Flow.prototype.addToRegions = function(element) {
    
    // walk the tree to find an element inside the region chain
    var regions = this.regions;
    var treeWalker = document.createTreeWalker(
        document.documentElement,
        NodeFilter.SHOW_ELEMENT,
        { 
            acceptNode: function(node) { 
                return regions.indexOf(node) >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; 
            } 
        },
        false
    );
    
    // which by the way has to be after the considered element
    treeWalker.currentNode = element;
    
    // if we find such node
    if(treeWalker.nextNode()) {
        
        // insert the element at his current location
        regions.splice(this.regions.indexOf(treeWalker.currentNode),0,element);
        
    } else {
        
        // add the new element to the end of the array
        regions.push(element);
    }
    
};

cssRegions.Flow.prototype.generateContentFragment = function() {
    var fragment = document.createDocumentFragment(); var This=this;
    var update = function(stream) {
        stream.schedule(update); This.relayout();
    }

    // add copies of all due content
    for(var i=0; i<this.content.length; i++) {
        var element = this.content[i];
        
        // depending on the requested behavior
        if(element.cssRegionsLastFlowIntoType=="element") {
            
            // add the element
            fragment.appendChild(element.cloneNode(true));
            
        } else {
            
            // add current children
            var el = element.firstChild; while(el) {
                fragment.appendChild(el.cloneNode(true));
                el = el.nextSibling;
            }
            
        }
        
        // watch out for changes
        if(!element.cssRegionsEventStream) {
            element.cssRegionsEventStream = new myDOMUpdateEventStream({target: element});
            element.cssRegionsEventStream.schedule(update);
        }
    }
    return fragment;
}

cssRegions.Flow.prototype.relayout = function() {
    var This = this; 
    
    // batch relayout queries
    if(This.relayoutScheduled) { return; }
    This.relayoutScheduled = true;
    requestAnimationFrame(function(){
        
        // cleanup previous layout
        cssRegions.unmarkNodesAsRegion(This.lastRegions); This.lastRegions = This.regions.slice(0);
        cssRegions.unmarkNodesAsFragmentSource(This.lastContent); This.lastContent = This.content.slice(0);
        
        // empty all the regions
        cssRegions.markNodesAsRegion(This.regions);
        
        // create a list of all the regions
        var regionStack = This.regions.slice(0).reverse();
        
        // create a list of the content
        var contentFragment = This.generateContentFragment();
        
        // layout this stuff
        cssRegions.layoutContent(regionStack, contentFragment);
        
        // mark layout has being done
        This.relayoutScheduled = false;
        
    });
    
}
    
window.addEventListener("load", function() {cssRegions.enablePolyfill()});