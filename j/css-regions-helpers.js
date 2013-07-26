"use strict";

var cssRegionsHelpers = {
    
    //
    // get the previous sibling of the element
    // or the previous sibling of its nearest ancestor that has one
    //
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
    
    //
    //
    //
    markNodesAsRegion: function(nodes,fast) {
        nodes.forEach(function(node) {
            node.setAttribute('data-css-region',node.cssRegionsLastFlowIntoType);
            node.cssRegionsLastFlowIntoType=="content" && cssRegionsHelpers.hideTextNodesFromFragmentSource(node);
            node.cssRegionsWrapper = node.cssRegionsWrapper || node.appendChild(document.createElement("cssregion"));
        });
    },
    
    //
    //
    //
    unmarkNodesAsRegion: function(nodes,fast) {
        nodes.forEach(function(node) {
            node.cssRegionsWrapper && node.removeChild(node.cssRegionsWrapper); delete node.cssRegionsWrapper;
            node.cssRegionsLastFlowIntoType=="content" && cssRegionsHelpers.unhideTextNodesFromFragmentSource(node);
            node.removeAttribute('data-css-region');
        });
    },
    
    //
    //
    //
    fragmentSourceIndex: 0,
    markNodesAsFragmentSource: function(nodes,ignoreRoot) {
        
        function visit(node,k) {
            var child, next;
            switch (node.nodeType) {
                case 1: // Element node
                    
                    if(typeof(k)=="undefined" || !ignoreRoot) {
                        
                        // mark as fragment source
                        var id = node.getAttributeNode('data-css-regions-fragment-source');
                        if(!id) { node.setAttribute('data-css-regions-fragment-source', cssRegionsHelpers.fragmentSourceIndex++); }
                        
                    }
                    
                    // expand list values
                    if(node.tagName=='OL') cssRegionsHelpers.expandListValues(node);
                    
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
    
    //
    //
    //
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
    
    //
    //
    //
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
    
    //
    //
    //
    hideTextNodesFromFragmentSource: function(nodes) {
        
        function visit(node) {
            var child, next;
            switch (node.nodeType) {
                case 3: // Text node
                    
                    // we have to remove their content the hard way...
                    node.cssRegionsSavedNodeValue = node.nodeValue;
                    node.nodeValue = "";
                    
                    break;
                    
                case 1: // Element node
                    if(node.cssRegionsLastFlowIntoType=="element") return;
                    
                case 9: // Document node
                case 11: // Document fragment node                    
                    child = node.firstChild;
                    while (child) {
                        next = child.nextSibling;
                        if(node.cssRegionsLastFlowIntoType=="content") visit(child);
                        child = next;
                    }
                    break;
            }
        }
        
        nodes.forEach(visit);
        
    },
    
    //
    //
    //
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
                    if(node.tagName=="OL") cssRegionsHelpers.unexpandListValues(node);
                    
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
    
    //
    //
    //
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
    
    //
    //
    //
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
    
    //
    //
    //
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
        
    }
}