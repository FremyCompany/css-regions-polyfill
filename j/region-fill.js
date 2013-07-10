//
// start by polyfilling caretRangeFromPoint
//

if(!document.caretRangeFromPoint) {
    if (document.caretPositionFromPoint) {
        document.caretRangeFromPoint = function caretRangeFromPoint(x,y) {
            var r = document.createRange();
            var p = document.caretPositionFromPoint(x,y);
            r.setStart(p.offsetNode, p.offset);
            r.setEnd(p.offsetNode, p.offset);
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
        var previousSibling = r.endContainer.childNodes[r.endOffset];
        if(previousSibling && previousSibling.lastChild) {
            
            // enter the previous sibling from its end
            r.setEndAfter(previousSibling.lastChild);
            
        } else if(previousSibling && previousSibling.nodeType==previousSibling.TEXT_NODE) { // todo: lookup value
            
            // enter the text node from its end
            r.setEnd(previousSibling, previousSibling.nodeValue.length);
            
        } else {
            
            // else move before that element
            r.setEnd(r.endContainer, r.endOffset-1);
            
        }
        
    } else {
        r.setEndBefore(r.endContainer);
    }
    
}
    

///
/// now create a module for region reflow
///

var cssRegions = {
    layoutContent: function(regions, documentFragment) {
        
        //
        // this function will iteratively fill all the regions
        // when we reach the last region, we put accept overflow
        //
        
        // get the next region & its sizing
        var region = regions.pop();
        
        // note: the overflow property of region must be scroll for auto-detection
        var backup = region.style.overflow;
        region.style.overflow = 'hidden';
        
        // add all the content to the region
        region.innerHTML = '';
        region.appendChild(documentFragment);
        
        // check if we have more regions to process
        if(regions.length !== 0) {
            
            // check if there was an overflow
            if(region.scrollHeight != region.offsetHeight) {
                
                // get the region sizing
                var sizingH = region.offsetHeight;
                var sizingW = region.offsetWidth;
                var pos = region.getBoundingClientRect();
                
                // get the caret point for that location
                var r = document.caretRangeFromPoint(
                    pos.left + sizingW - 1,
                    pos.top + sizingH - 1
                );
                
                // note: maybe the text is one line too big
                // move the end point char by char until it's completely in the region
                while(!r.collapsed && r.getBoundingClientRect().bottom>pos.top+sizingH) {
                    r.myMoveOneCharLeft()
                }
                
                // select trailing content
                r.setEndAfter(region.lastChild);
                documentFragment = r.extractContents();
                
            } else {
                
                // there's nothing more to insert but we need to reflow next regions
                documentFragment = document.createDocumentFragment();
                
            }
            
            // layout the next regions
            cssRegions.layoutContent(regions, documentFragment); // TODO: use do...while instead of recursion
        }
        
        // restore backed-up overflow
        region.style.overflow = backup;
        
    }
}