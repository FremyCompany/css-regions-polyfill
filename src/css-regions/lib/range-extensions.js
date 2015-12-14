"use strict";

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
    } else if((document.body||document.createElement('body')).createTextRange) {
        
        //
        // we may want to convert TextRange to Range
        //
        
        var TextRangeUtils = {
            convertToDOMRange: function (textRange, document) {
                var adoptBoundary = function(domRange, textRangeInner, bStart) {
                    // iterate backwards through parent element to find anchor location
                    var cursorNode = document.createElement('a'), cursor = textRangeInner.duplicate();
                    cursor.collapse(bStart);
                    var parent = cursor.parentElement();
                    do {
                            parent.insertBefore(cursorNode, cursorNode.previousSibling);
                            cursor.moveToElementText(cursorNode);
                    } while (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRangeInner) > 0 && cursorNode.previousSibling);
                    
                    // when we exceed or meet the cursor, we've found the node
                    if (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRangeInner) == -1 && cursorNode.nextSibling) {
                            // data node
                            cursor.setEndPoint(bStart ? 'EndToStart' : 'EndToEnd', textRangeInner);
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
                var adoptEndPoint = function(textRange, domRangeInner, bStart) {
                    // find anchor node and offset
                    var container = domRangeInner[bStart ? 'startContainer' : 'endContainer'];
                    var offset = domRangeInner[bStart ? 'startOffset' : 'endOffset'], textOffset = 0;
                    var anchorNode = DOMUtils.isDataNode(container) ? container : container.childNodes[offset];
                    var anchorParent = DOMUtils.isDataNode(container) ? container.parentNode : container;
                    // visible data nodes need a text offset
                    if (container.nodeType == 3 || container.nodeType == 4)
                        textOffset = offset;
                    
                    // create a cursor element node to position range (since we can't select text nodes)
                    var cursorNode = domRangeInner._document.createElement('a');
                    anchorParent.insertBefore(cursorNode, anchorNode);
                    var cursor = domRangeInner._document.body.createTextRange();
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
            for(var iy=IYDepth; iy; iy=iy-4) {
                var ix = x; if(true) {
                    try {
                        r.moveToPoint(ix,iy+y-IYDepth); 
                        return TextRangeUtils.convertToDOMRange(r);
                    } catch(ex) {}
                }
            }
            
            // if that fails, return the location just after the element located there
            try {
                
                var elem = document.elementFromPoint(x-1,y-1);
                var r = document.createRange();
                r.setStartAfter(elem);
                return r;
                
            } catch(ex) {
                
                return null;
                
            }
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


///
/// This functions is optimized to not yield inside a word in a text node
///
Range.prototype.myMoveTowardRight = function() {
    var r = this;
    
    // move to the previous cursor location
    var isTextNode = r.startContainer.nodeType==r.startContainer.TEXT_NODE;
    var max = (isTextNode ? r.startContainer.nodeValue.length : r.startContainer.childNodes.length)
    if(r.startOffset < max) {
        
        // if we can enter into the next sibling
        var nextSibling = r.endContainer.childNodes[r.endOffset];
        if(nextSibling && nextSibling.firstChild) {
            
            // enter the next sibling from its start
            r.setStartBefore(nextSibling.firstChild);
            
        } else if(nextSibling && nextSibling.nodeType==nextSibling.TEXT_NODE && nextSibling.nodeValue!='') { // todo: lookup value
            
            // enter the next text node from its start
            r.setStart(nextSibling, 0);
            
        } else if(isTextNode) {
            
            // move to the next non a-zA-Z symbol
            var currentText = r.startContainer.nodeValue;
            var currentOffset = r.startOffset;
            var currentLetter = currentText[currentOffset++];
            while(currentOffset < max && /^\w$/.test(currentLetter)) {
                currentLetter = currentText[currentOffset++];
            }
            r.setStart(r.startContainer, currentOffset);
            
        } else {
            
            // else move after that element
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

//
// Get the *real* bounding client rect of the range
// { therefore we need to fix some browser bugs... }
//
Range.prototype.myGetSelectionRect = function() {
    
    // get the browser's claimed rect
    var rect = this.getBoundingClientRect();
	
	// HACK FOR ANDROID BROWSER AND OLD WEBKIT
	if(!rect) { 
		rect={top:0,right:0,bottom:0,left:0,width:0,height:0}; 
	}
    
    // if the value seems wrong... (some browsers don't like collapsed selections)
    if(this.collapsed && rect.top===0 && rect.bottom===0) {
        
        // select one char and infer location
        var clone = this.cloneRange(); var collapseToLeft=false; clone.collapse(false); 
        
        // the case where no char before is tricky...
        if(clone.startOffset==0) {
            
            // let's move on char to the right
            clone.myMoveTowardRight();
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
if(!window.Node) window.Node = {};

// make getBCR working on text nodes & stuff
Node.getBoundingClientRect = function getBoundingClientRect(element) {
    if (element.getBoundingClientRect) {
        
        var rect = element.getBoundingClientRect();
        
    } else {
        
        var range = document.createRange();
        range.selectNode(element);
        
        var rect = range.getBoundingClientRect();
        
    }
	
	// HACK FOR ANDROID BROWSER AND OLD WEBKIT
	if(!rect) { 
		rect={top:0,right:0,bottom:0,left:0,width:0,height:0}; 
	}
	
	return rect;
};


// make getCR working on text nodes & stuff
Node.getClientRects = function getClientRects(firstChild) {
    if (firstChild.getBoundingClientRect) {
        
        return firstChild.getClientRects();
        
    } else {
        
        var range = document.createRange();
        range.selectNode(firstChild);
        
        return range.getClientRects();
        
    }
};

// fix for IE (contains fails for text nodes...)
Node.contains = function contains(parentNode,node) {
    if(node.nodeType != 1) {
        if(!node.parentNode) return false;
        return node.parentNode==parentNode || parentNode.contains(node.parentNode);
    } else {
        return parentNode.contains(node);
    }
}

//
// get the bounding rect of the selection, including the bottom padding/marging of the previous element if required
// { this is a special version for breaking algorithms that do not want to miss the previous element real size }
//
Range.prototype.myGetExtensionRect = function() {
    
    // this function returns the selection rect
    // but does take care of taking in account 
    // the bottom-{padding/border} of the previous
    // sibling element, to detect overflow points
    // more accurately
    
    var rect = this.myGetSelectionRect();
    var previousSibling = this.endContainer.childNodes[this.endOffset-1];
    if(previousSibling) {
        
        // correct with the new take
        var prevSibRect = Node.getBoundingClientRect(previousSibling);
        var adjustedBottom = Math.max(rect.bottom,prevSibRect.bottom);
        if(adjustedBottom == rect.bottom) return rect;
        return {
            
            left: rect.left,
            right: rect.right,
            width: rect.width,
            
            top: rect.top,
            bottom: adjustedBottom,
            height: adjustedBottom - rect.top
            
        };
        
    } else if(rect.bottom==0 && this.endContainer.nodeType === 3) {
        
        // note that if we are in a text node, 
        // we may want to cover all the previous
        // text in the node to avoid whitespace
        // related bugs
        
        var onlyWhiteSpaceBefore = /^(\s|\n)*$/.test(this.endContainer.nodeValue.substr(0,this.endOffset));
        if(onlyWhiteSpaceBefore) {
            
            // if we are in the fucking whitespace land, return first line
            var prevSibRect = Node.getClientRects(this.endContainer)[0];
            return prevSibRect;
            
        } else {
            
            // otherwhise, let's rely on previous chars
            var auxiliaryRange = this.cloneRange();
            auxiliaryRange.setStart(this.endContainer,0);
            
            // correct with the new take
            var prevSibRect = auxiliaryRange.getBoundingClientRect();
            var adjustedBottom = Math.max(rect.bottom,prevSibRect.bottom);
            return {
                
                left: rect.left,
                right: rect.right,
                width: rect.width,
                
                top: rect.top,
                bottom: adjustedBottom,
                height: adjustedBottom - rect.top
                
            };
            
        }
        
    } else {
        
        return rect;
        
    }
}