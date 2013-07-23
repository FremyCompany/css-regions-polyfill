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
        
        // append the remaining content to the region
        region.innerHTML = '';
        region.appendChild(remainingContent);
        
        // check if we have more regions to process
        if(regions.length !== 0) {
            
            // check if there was an overflow
            if(region.scrollHeight != region.offsetHeight) {
                
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
        var sizingH = region.offsetHeight; // avail size (max-height)
        var sizingW = region.offsetWidth; // avail size (max-width)
        var pos = region.getBoundingClientRect(); // avail size?
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
        if(region !== r.endContainer && !region.contains(r.endContainer)) {
            
            // move back into the region
            r.setStart(region, 0);
            r.setEnd(region, 0);
            dontOptimize=true;
            
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
        
        
        // 
        // [2] when stylesheets are loaded, grab region-active selectors
        // and follow them using the myQuerySelectorLive polyfill
        // 
        
        
        // 
        // [3] when any update happens
        // construct new content and region flow pairs
        // restart the region layout algorithm for the modified pairs
        // 
        
        
    }
    
}