"use script";    

///
/// now create a module for region reflow
///

var cssRegions = {
    layoutContent: function(regions, remainingContent) {
        
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
            cssRegions.layoutContent(regions, remainingContent); // TODO: use do...while instead of recursion
            
        } else {
            
            // TODO: support region-fragment: break
            if(false) {
                this.extractOverflowingContent(region);
            }
            
        }
        
        // TODO: support 'regionOverset' and region events
        
    },
    
    extractOverflowingContent: function(region) {
        
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
        var r = document.caretRangeFromPoint(
            pos.left + sizingW - 1,
            pos.top + sizingH - 1
        );
        
        // if the caret is outside the region
        if(region !== r.endContainer && !region.contains(r.endContainer)) {
            
            // move back into the region
            r.setStart(region, 0);
            r.setEnd(region, 0);
            
        }
        
        // store the current selection rect for fast access
        var rect = r.myGetSelectionRect();
        
        
        //
        // note: maybe the text is right-to-left
        // in this case, we can go further than the caret
        //
        
        // move the end point char by char until it's completely in the region
        while(!(r.endContainer==region && r.endOffset==r.endContainer.childNodes.length) && rect.bottom<=pos.top+sizingH) {
            r.myMoveOneCharRight(); rect = r.myGetSelectionRect();
        }
        
        
        //
        // note: maybe the text is one line too big
        // in this case, we have to backtrack a little
        //
        
        // move the end point char by char until it's completely in the region
        while(!(r.endContainer==region && r.endOffset==0) && rect.bottom>pos.top+sizingH) {
            r.myMoveOneCharLeft(); rect = r.myGetSelectionRect();
        }
        
        
        // 
        // note: we should not break the content inside monolithic content
        // if we do, we need to change the selection to avoid that
        // 
        
        // move the selection before the monolithic ancestors
        var current = r.endContainer; var allAncestors=[];
        while(current !== region) {
            allAncestors.push(current);
            if(cssBreak.isMonolithic(current)) {
                r.setEndBefore(current);
            }
            current = current.parentNode;
        }
        
        
        // 
        // note: the css-break spec says that a region should not be emtpy
        // 
        
        // if we end up with nothing being selected, add the first block anyway
        if(r.endContainer===region && r.endOffset===0) {
            
            // TODO: work on a way to find 
            // the first real allowed break point
            r.setEnd(region, 1); r.collapse(false);
            
        }
        
        
        //
        // note: if we're about to split after the last child of
        // an element which has bottom-{padding/border/margin}, 
        // we need to figure how how much of that p/b/m we can
        // actually keep for the first fragment
        //
        
        // TODO: split bottom-{margin/border/padding} correctly
        if(r.endOffset == r.endContainer.childNodes.length) {
            
            // compute how much of the bottom border can actually fit
            var box = r.endContainer.getBoundingClientRect();
            var excessHeight = box.bottom - (pos.top + sizingH);
            var endContainerStyle = getComputedStyle(r.endContainer);
            var availBorderHeight = endContainerStyle.borderBottomWidth;
            var availPaddingHeight = endContainerStyle.paddingBottom;
            
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
            
        }
        
        // remove bottom-{pbm} from all ancestors involved in the cut
        for(var i=allAncestors.length-1; i; i--) {
            allAncestors[i].setAttribute('data-css-continued-fragment',true); //TODO: this requires some css
        }
        if(typeof(borderCut)==="number")) {
            allAncestors[i].setAttribute('data-css-special-continued-fragment-with',true);
            allAncestors[0].style.borderBottom = (availBorderHeight-borderCut);
        }
        if(typeof(paddingCut)==="number")) {
            allAncestors[i].setAttribute('data-css-special-continued-fragment-with',true);
            allAncestors[0].style.paddingBottom = (availPaddingHeight-paddingCut);
        }
        
        //
        // note: now we have a collapsed range 
        // located at the split point
        //
        
        // select the overflowing content
        r.setEndAfter(region.lastChild);
        
        // extract it from the current region
        return r.extractContents();
        
        // TODO: do not forget to remove any top p/b/m on cut elements
        // TODO: deduct any already-used bottom p/b/m
        
    }
}