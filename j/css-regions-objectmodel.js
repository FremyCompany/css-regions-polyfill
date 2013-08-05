"use strict";

// 
// this class contains flow-relative data field
// 
cssRegions.Flow = function NamedFlow(name) {
    
    // TODO: force immediate relayout if someone ask the overset properties
    // and the layout has been deemed wrong (still isn't a proof of correctness but okay)
    
    // define the flow name
    this.name = name; Object.defineProperty(this, "name", {get: function() { return name; }});
    
    // define the overset status
    this.overset = false;
    
    // define the first empty region
    this.firstEmptyRegionIndex = -1;
    
    // elements poured into the flow
    this.content = this.lastContent = [];
    
    // elements that consume this flow
    this.regions = this.lastRegions = [];
    
    // event handlers
    this.eventListeners = {
        "regionfragmentchange": [],
        "regionoversetchange": [],
    };
    
    // this function is used to work with dom event streams
    var This=this; This.update = function(stream) {
        stream.schedule(This.update); This.relayout();
    };
    
    // register to style changes already
    cssCascade.addEventListener('stylesheetadded', function() {
        This.relayout();
    });
}
    
cssRegions.Flow.prototype.removeFromContent = function(element) {
    
    // TODO: clean up stuff
    this.removeEventListenersOf(element);
    
    // remove reference
    var index = this.content.indexOf(element);
    if(index>=0) { this.content.splice(index,1); }
    
};

cssRegions.Flow.prototype.removeFromRegions = function(element) {
    
    // TODO: clean up stuff
    this.removeEventListenersOf(element);
    
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
        function(node) { 
            return content.indexOf(node) >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; 
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
        function(node) { 
            return regions.indexOf(node) >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; 
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

    // add copies of all due content
    for(var i=0; i<this.content.length; i++) {
        var element = this.content[i];
        
        // 
        // STEP 1: IDENTIFY FRAGMENT SOURCES AS SUCH
        //
        cssRegionsHelpers.markNodesAsFragmentSource([element], element.cssRegionsLastFlowIntoType=="content");
        
        
        //
        // STEP 2: CLONE THE FRAGMENT SOURCES
        // 
        
        // depending on the requested behavior
        if(element.cssRegionsLastFlowIntoType=="element") {
            
            // add the element
            fragment.appendChild(element.cloneNode(true));
            
            // clone the style
            cssRegionsHelpers.copyStyle(element, fragment.lastChild);
            
        } else {
            
            // add current children
            var el = element.firstChild; while(el) {
                
                // add the element
                fragment.appendChild(el.cloneNode(true));
                
                // clone the style
                cssRegionsHelpers.copyStyle(el, fragment.lastChild);
                
                el = el.nextSibling;
            }
            
        }
        
    }
    
    //
    // STEP 3: HIDE TEXT NODES IN FRAGMENT SOURCES
    //
    cssRegionsHelpers.hideTextNodesFromFragmentSource(this.content);
    
    //
    // STEP 4: CONVERT CLONED FRAGMENT SOURCES INTO TRUE FRAGMENTS
    //
    cssRegionsHelpers.transformFragmentSourceToFragments(
        Array.prototype.slice.call(fragment.childNodes,0)
    )
    
    
    //
    // CLONED CONTENT IS READY!
    //
    return fragment;
}

cssRegions.Flow.prototype.relayout = function() {
    var This = this;
    
    // batch relayout queries
    if(This.relayoutScheduled) { return; }
    This.relayoutScheduled = true;
    requestAnimationFrame(function() { This._relayout() });
    
}

cssRegions.Flow.prototype._relayout = function(){
    var This=this;
    
    try {
        
        //
        // note: it is recommended to look at the beautiful 
        // drawings I made before attempting to understand
        // this stuff. If you don't have them, ask me.
        //
        console.log("starting a new relayout for "+This.name);
        //debugger;
        
        // NOTE: we recover the scroll position in case the browser mess it up
        var docElmScrollTop = document.documentElement.scrollTop;
        var docBdyScrollTop = document.body.scrollTop;
        
        
        //
        // STEP 1: REMOVE PREVIOUS EVENT LISTENERS
        //
        
        // remove the listeners from everything
        This.removeEventListenersOf(This.lastRegions);
        This.removeEventListenersOf(This.lastContent);

        
        
        //
        // STEP 2: RESTORE CONTENT/REGIONS TO A CLEAN STATE
        //
        
        // cleanup previous layout
        cssRegionsHelpers.unmarkNodesAsRegion(This.lastRegions); This.lastRegions = This.regions.slice(0);
        cssRegionsHelpers.unmarkNodesAsFragmentSource(This.lastContent); This.lastContent = This.content.slice(0);
        
        
        
        //
        // STEP 3: EMPTY ALL REGIONS
        // ADD WRAPPER FOR FLOW CONTENT
        // PREPARE FOR CONTENT CLONING
        //
        
        // TODO: compute the style of all source elements
        // TODO: generate stylesheets for those rules
        
        // empty all the regions
        cssRegionsHelpers.markNodesAsRegion(This.regions);
        
        // create a fresh list of the regions
        var regionStack = This.regions.slice(0).reverse();
        
        
        
        //
        // STEP 4: CLONE THE CONTENT
        // ADD METADATA TO CLONED CONTENT
        // HIDE FLOW CONTENT AT INITIAL POSITION
        //
        
        // create a fresh list of the content
        var contentFragment = This.generateContentFragment();
        
        
        
        //
        // STEP 5: POUR CONTENT INTO THE REGIONS
        //
        
        // layout this stuff
        This.overset = cssRegions.layoutContent(regionStack, contentFragment);
        This.firstEmptyRegionIndex = This.regions.length-1; while(This.regions[This.firstEmptyRegionIndex]) {
            if(This.regions[This.firstEmptyRegionIndex].cssRegionsWrapper.firstChild) {
                if((++This.firstEmptyRegionIndex)==This.regions.length) {
                    This.firstEmptyRegionIndex = -1;
                }
                break;
            } else {
                This.firstEmptyRegionIndex--; 
            }
        }
        
        
        
        //
        // STEP 6: REGISTER TO UPDATE EVENTS
        //
        
        // make sure regions update are taken in consideration
        if(window.MutationObserver) {
            This.addEventListenersTo(This.content);
            This.addEventListenersTo(This.regions);
        } else {
            // the other browsers don't get this as acurately
            // but that shouldn't be that of an issue for 99% of the cases
            setImmediate(function() {
                This.addEventListenersTo(This.content);
            });
        }
        
        
        
        //
        // STEP 7: FIRE SOME EVENTS
        //
        requestAnimationFrame(function() {
            
            // TODO: only fire when necessary but...
            This.dispatchEvent('regionfragmentchange');
            This.dispatchEvent('regionoversetchange');
            
        });
        
        
        // NOTE: we recover the scroll position in case the browser mess it up
        document.documentElement.scrollTop = docElmScrollTop;
        document.body.scrollTop = docBdyScrollTop;
        
        // mark layout has being done
        This.relayoutScheduled = false;
        
    } catch(ex) {
        
        // sometimes IE fails for no valid reason 
        // (other than the page is still loading)
        setImmediate(function() { throw ex; });

        // but we cannot accept to fail, so we need to try again
        // until we finish a complete layout pass...
        requestAnimationFrame(function() { This._relayout() });
        
    }
}

cssRegions.Flow.prototype.relayoutIfSizeChanged = function() {
    
    // go through all regions
    // and see if any did change of size
    var rs = this.regions;     
    for(var i=rs.length; i--; ) {
        if(
            rs[i].offsetHeight !== rs[i].cssRegionsLastOffsetHeight
            || rs[i].offsetWidth !== rs[i].cssRegionsLastOffsetWidth
        ) {
            this.relayout(); return;
        }
    }
    
}

cssRegions.Flow.prototype.addEventListenersTo = function(nodes) {
    var This=this; if(nodes instanceof Element) { nodes=[nodes] }
    
    nodes.forEach(function(element) {
        if(!element.cssRegionsEventStream) {
            element.cssRegionsEventStream = new myDOMUpdateEventStream({target: element});
            element.cssRegionsEventStream.schedule(This.update);
        }
    });
    
}

cssRegions.Flow.prototype.removeEventListenersOf = function(nodes) {
    var This=this; if(nodes instanceof Element) { nodes=[nodes] }
    
    nodes.forEach(function(element) {
        if(element.cssRegionsEventStream) {
            element.cssRegionsEventStream.dispose();
            delete element.cssRegionsEventStream;
        }
    });
    
}

// alias
cssRegions.NamedFlow = cssRegions.Flow;

// return a disconnected array of the content of a NamedFlow
cssRegions.NamedFlow.prototype.getContent = function getContent() {
    return this.content.slice(0)
}

// return a disconnected array of the content of a NamedFlow
cssRegions.NamedFlow.prototype.getContent = function getContent() {
    return this.content.slice(0)
}

cssRegions.NamedFlow.prototype.getRegionsByContent = function getRegionsByContent(node) {
    var regions = [];
    var fragments = document.querySelectorAll('[data-css-regions-fragment-of="'+node.getAttribute('data-css-regions-fragment-source')+'"]');
    for (var i=0; i<fragments.length; i++) {
        
        var current=fragments[i]; do {
            
            if(current.getAttribute('data-css-region')) {
                regions.push(current); break;
            }
            
        } while(current=current.parentNode);
        
    }
    
    return regions;
}

basicObjectModel.EventTarget.implementsIn(cssRegions.Flow);

//
// this class is a collection of named flows (not an array, sadly)
//
cssRegions.NamedFlowCollection = function NamedFlowCollection() {
    
    this.length = 0;
    
}

cssRegions.NamedFlowCollection.prototype.namedItem = function(k) {
    return cssRegions.flows[k] || (cssRegions.flows[k]=new cssRegions.Flow(k));
}


//
// this helper creates the required methods on top of the DOM {ie: public exports}
//
cssRegions.enablePolyfillObjectModel = function() {
    
    //
    // DOCUMENT INTERFACE
    //
    
    //
    // returns a static list of active named flows
    //
    document.getNamedFlows = function() {
            
        var c = new cssRegions.NamedFlowCollection(); var flows = cssRegions.flows;
        for(var flowName in cssRegions.flows) {
            
            if(Object.prototype.hasOwnProperty.call(flows, flowName)) {
                
                // only active flows can be included
                if(flows[flowName].content.length!=0 || flows[flowName].regions.length!=0) {
                    c[c.length++] = c[flowName] = flows[flowName];
                }
                
            }
            
        }
        return c;
        
    }
    
    //
    // returns a live object for any named flow
    //
    document.getNamedFlow = function(flowName) {
            
        var flows = cssRegions.flows;
        return (flows[flowName] || (flows[flowName]=new cssRegions.NamedFlow(flowName)));
        
    }
    
    //
    // ELEMENT INTERFACE
    //    
    Object.defineProperties(
        Element.prototype,
        {
            "regionOverset": {
                get: function() {
                    return this._regionOverset || 'fit';
                },
                set: function(value) {
                    this._regionOverset = value;
                }
            },
            "getRegionFlowRanges": {
                value: function getRegionFlowRanges() {
                    return null; // TODO: can we implement that? I think we can't (properly).
                }
            },
            "getComputedRegionStyle": {
                value: function getComputedRegionStyle(element,pseudo) {
                    // TODO: only works while we don't relayout
                    // TODO: only works properly for elements actually in the region
                    var fragment = document.querySelector('[data-css-regions-fragment-of="'+element.getAttribute('data-css-regions-fragment-source')+'"]');
                    if(pseudo) {
                        return getComputedStyle(fragment||element);
                    } else {
                        return getComputedStyle(fragment||element, pseudo);
                    }
                }
            }
        }
    )
    
}

cssRegions.enablePolyfill();