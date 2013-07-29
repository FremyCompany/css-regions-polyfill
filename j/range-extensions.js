"use script";

//
// start by polyfilling caretRangeFromPoint
//

if(!document.caretRangeFromPoint) {
    if (document.caretPositionFromPoint) {
        document.caretRangeFromPoint = function caretRangeFromPoint(x,y) {
            var r = document.createRange();
            var p = document.caretPositionFromPoint(x,y); 
            if(p.offsetNode) {
                r.setStart(p.offsetNode, p.offset);
                r.setEnd(p.offsetNode, p.offset);
            }
            return r;
        }
    } else if(document.body.createTextRange) {
        
        //
        // we may want to convert TextRange to Range
        //
        
        var TextRangeUtils = {
            convertToDOMRange: function (textRange, document) {
                function adoptBoundary(domRange, textRange, bStart) {
                    // iterate backwards through parent element to find anchor location
                    var cursorNode = document.createElement('a'), cursor = textRange.duplicate();
                    cursor.collapse(bStart);
                    var parent = cursor.parentElement();
                    do {
                            parent.insertBefore(cursorNode, cursorNode.previousSibling);
                            cursor.moveToElementText(cursorNode);
                    } while (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRange) > 0 && cursorNode.previousSibling);
                    
                    // when we exceed or meet the cursor, we've found the node
                    if (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRange) == -1 && cursorNode.nextSibling) {
                            // data node
                            cursor.setEndPoint(bStart ? 'EndToStart' : 'EndToEnd', textRange);
                            domRange[bStart ? 'setStart' : 'setEnd'](cursorNode.nextSibling, cursor.text.length);
                    } else {
                            // element
                            domRange[bStart ? 'setStartBefore' : 'setEndBefore'](cursorNode);
                    }
                    cursorNode.parentNode.removeChild(cursorNode);
                }
                
                // validate arguments
                if(!document) { document=window.document; }
                
                // return a DOM range
                var domRange = document.createRange();
                adoptBoundary(domRange, textRange, true);
                adoptBoundary(domRange, textRange, false);
                return domRange;
            },

            convertFromDOMRange: function (domRange) {
                function adoptEndPoint(textRange, domRange, bStart) {
                    // find anchor node and offset
                    var container = domRange[bStart ? 'startContainer' : 'endContainer'];
                    var offset = domRange[bStart ? 'startOffset' : 'endOffset'], textOffset = 0;
                    var anchorNode = DOMUtils.isDataNode(container) ? container : container.childNodes[offset];
                    var anchorParent = DOMUtils.isDataNode(container) ? container.parentNode : container;
                    // visible data nodes need a text offset
                    if (container.nodeType == 3 || container.nodeType == 4)
                        textOffset = offset;
                    
                    // create a cursor element node to position range (since we can't select text nodes)
                    var cursorNode = domRange._document.createElement('a');
                    anchorParent.insertBefore(cursorNode, anchorNode);
                    var cursor = domRange._document.body.createTextRange();
                    cursor.moveToElementText(cursorNode);
                    cursorNode.parentNode.removeChild(cursorNode);
                    // move range
                    textRange.setEndPoint(bStart ? 'StartToStart' : 'EndToStart', cursor);
                    textRange[bStart ? 'moveStart' : 'moveEnd']('character', textOffset);
                }
               
                // return an IE text range
                var textRange = domRange._document.body.createTextRange();
                adoptEndPoint(textRange, domRange, true);
                adoptEndPoint(textRange, domRange, false);
                return textRange;
            }
        };

        
        document.caretRangeFromPoint = function caretRangeFromPoint(x,y) {
            
            // the accepted number of vertical backtracking, in CSS pixels
            var IYDepth = 40;
            
            // try to create a text range at the specified location
            var r = document.body.createTextRange();
            for(var iy=IYDepth; iy; iy--) {
                var ix = x; if(true) {
                    try {
                        r.moveToPoint(ix,iy+y-IYDepth); 
                        console.log(ix+","+iy+" from "+x+","+y);
                        return TextRangeUtils.convertToDOMRange(r);
                    } catch(ex) {}
                }
            }
            
            // if that fails, return the location just after the element located there
            var elem = document.elementFromPoint(x,y);
            var r = document.createRange();
            r.setStartAfter(elem);
            return r;
        }
    }
}


///
/// helper function for moving ranges char by char
///

Range.prototype.myMoveOneCharLeft = function() {
    var r = this;
    
    // move to the previous cursor location
    if(r.endOffset > 0) {
        
        // if we can enter into the previous sibling
        var previousSibling = r.endContainer.childNodes[r.endOffset-1];
        if(previousSibling && previousSibling.lastChild) {
            
            // enter the previous sibling from its end
            r.setEndAfter(previousSibling.lastChild);
            
        } else if(previousSibling && previousSibling.nodeType==previousSibling.TEXT_NODE) { // todo: lookup value
            
            // enter the previous text node from its end
            r.setEnd(previousSibling, previousSibling.nodeValue.length);
            
        } else {
            
            // else move before that element
            r.setEnd(r.endContainer, r.endOffset-1);
            
        }
        
    } else {
        r.setEndBefore(r.endContainer);
    }
    
}

Range.prototype.myMoveOneCharRight = function() {
    var r = this;
    
    // move to the previous cursor location
    var max = (r.startContainer.nodeType==r.startContainer.TEXT_NODE ? r.startContainer.nodeValue.length : r.startContainer.childNodes.length)
    if(r.startOffset < max) {
        
        // if we can enter into the next sibling
        var nextSibling = r.endContainer.childNodes[r.endOffset];
        if(nextSibling && nextSibling.firstChild) {
            
            // enter the next sibling from its start
            r.setStartBefore(nextSibling.firstChild);
            
        } else if(nextSibling && nextSibling.nodeType==nextSibling.TEXT_NODE && nextSibling.nodeValue!='') { // todo: lookup value
            
            // enter the next text node from its start
            r.setStart(nextSibling, 0);
            
        } else {
            
            // else move before that element
            r.setStart(r.startContainer, r.startOffset+1);
            
        }
        
    } else {
        r.setStartAfter(r.endContainer);
    }
    
    // shouldn't be needed but who knows...
    r.setEnd(r.startContainer, r.startOffset);
    
}


Range.prototype.myMoveEndOneCharLeft = function() {
    var r = this;
    
    // move to the previous cursor location
    if(r.endOffset > 0) {
        
        // if we can enter into the previous sibling
        var previousSibling = r.endContainer.childNodes[r.endOffset-1];
        if(previousSibling && previousSibling.lastChild) {
            
            // enter the previous sibling from its end
            r.setEndAfter(previousSibling.lastChild);
            
        } else if(previousSibling && previousSibling.nodeType==previousSibling.TEXT_NODE) { // todo: lookup value
            
            // enter the previous text node from its end
            r.setEnd(previousSibling, previousSibling.nodeValue.length);
            
        } else {
            
            // else move before that element
            r.setEnd(r.endContainer, r.endOffset-1);
            
        }
        
    } else {
        r.setEndBefore(r.endContainer);
    }
    
}

Range.prototype.myMoveEndOneCharRight = function() {
    var r = this;
    
    // move to the previous cursor location
    var max = (r.endContainer.nodeType==r.endContainer.TEXT_NODE ? r.endContainer.nodeValue.length : r.endContainer.childNodes.length)
    if(r.endOffset < max) {
        
        // if we can enter into the next sibling
        var nextSibling = r.endContainer.childNodes[r.endOffset];
        if(nextSibling && nextSibling.firstChild) {
            
            // enter the next sibling from its start
            r.setEndBefore(nextSibling.firstChild);
            
        } else if(nextSibling && nextSibling.nodeType==nextSibling.TEXT_NODE) { // todo: lookup value
            
            // enter the next text node from its start
            r.setEnd(nextSibling, 0);
            
        } else {
            
            // else move before that element
            r.setEnd(r.endContainer, r.endOffset+1);
            
        }
        
    } else {
        r.setEndAfter(r.endContainer);
    }
    
}

Range.prototype.myGetSelectionRect = function() {
    
    // get the browser's claimed rect
    var rect = this.getBoundingClientRect();
    
    // if the value seems wrong... (some browsers don't like collapsed selections)
    if(this.collapsed && rect.top===0 && rect.bottom===0) {
        
        // select one char and infer location
        var clone = this.cloneRange(); var collapseToLeft=false;
        
        // the case where no char before is tricky...
        if(clone.startOffset==0) {
            
            // let's move on char to the right
            clone.myMoveOneCharRight();
            collapseToLeft=true;

            // note: some browsers don't like selections
            // that spans multiple containers, so we will
            // iterate this process until we have one true
            // char selected
            clone.setStart(clone.endContainer, 0); 
            
        } else {
            
            // else, just select the char before
            clone.setStart(this.startContainer, this.startOffset-1);
            collapseToLeft=false;
            
        }
        
        // get some real rect
        var rect = clone.myGetSelectionRect();
        
        // compute final value
        if(collapseToLeft) {
            return {
                
                left: rect.left,
                right: rect.left,
                width: 0,
                
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height
                
            }
        } else {
            return {
                
                left: rect.right,
                right: rect.right,
                width: 0,
                
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height
                
            }
        }
        
    } else {
        return rect;
    }
    
}

// not sure it's needed but still
if(!window.Element) window.Element=window.HTMLElement;

// make getBCR working on text nodes & stuff
Node.getBoundingClientRect = function getBoundingClientRect(firstChild) {
    if (firstChild.getBoundingClientRect) {
        
        return firstChild.getBoundingClientRect();
        
    } else {
        
        var range = document.createRange();
        range.selectNode(firstChild);
        
        return range.getBoundingClientRect();
        
    }
};

// make getCR working on text nodes & stuff
Node.getClientRects = function getBoundingClientRect(firstChild) {
    if (firstChild.getBoundingClientRect) {
        
        return firstChild.getClientRects();
        
    } else {
        
        var range = document.createRange();
        range.selectNode(firstChild);
        
        return range.getClientRects();
        
    }
};

// a special version for breaking algorithms
Range.prototype.myGetExtensionRect = function() {
    
    // this function returns the selection rect
    // but does take care of taking in account 
    // the bottom-{padding/border} of the previous
    // sibling element, to detect overflow points
    // more accurately
    
    var rect = this.myGetSelectionRect();
    var previousSibling = this.endContainer.childNodes[this.endOffset-1];
    if(previousSibling) {
        
        var prevSibRect = Node.getBoundingClientRect(previousSibling);
        var adjustedBottom = Math.max(rect.bottom,prevSibRect.bottom);
        return {
            
            left: rect.left,
            right: rect.right,
            width: rect.width,
            
            top: rect.top,
            bottom: adjustedBottom,
            height: adjustedBottom - rect.top
            
        };
        
    } else {
        
        return rect;
        
    }
}