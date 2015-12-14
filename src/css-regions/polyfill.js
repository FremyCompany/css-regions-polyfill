//
// this module holds the big-picture actions of the polyfill
//
module.exports = (function(window, document) { "use strict";

	var domEvents = require('core:dom-events');
	var cssSyntax = require('core:css-syntax');
	var cssCascade = require('core:css-cascade');
	var cssBreak = require('core:css-break');
	
	require('lib/range-extensions');
	var cssRegionsHelpers = require('lib/helpers');
	var enableObjectModel = require('lib/objectmodel');
	
	var CSS_STYLE = "cssregion,[data-css-region]>*,[data-css-regions-fragment-source]:not([data-css-regions-cloning]),[data-css-regions-fragment-source][data-css-regions-cloned]{display:none!important}[data-css-region]>cssregion:last-of-type{display:inline!important}[data-css-region]{content:normal!important}[data-css-special-continued-fragment]{counter-reset:none!important;counter-increment:none!important;margin-bottom:0!important;border-bottom-left-radius:0!important;border-bottom-right-radius:0!important}[data-css-continued-fragment]{counter-reset:none!important;counter-increment:none!important;margin-bottom:0!important;padding-bottom:0!important;border-bottom:none!important;border-bottom-left-radius:0!important;border-bottom-right-radius:0!important}[data-css-continued-fragment]::after{content:none!important;display:none!important}[data-css-special-starting-fragment]{text-indent:0!important;margin-top:0!important}[data-css-starting-fragment]{text-indent:0!important;margin-top:0!important;padding-top:0!important;border-top:none!important;border-top-left-radius:0!important;border-top-right-radius:0!important}[data-css-starting-fragment]::before{content:none!important;display:none!important}[data-css-continued-block-fragment][data-css-continued-fragment]:not(:empty)::after{content:''!important;display:inline-block!important;width:100%!important;height:0!important;font-size:0!important;line-height:0!important;margin:0!important;padding:0!important;border:0!important}";

	var cssRegions = {
		
		//
		// this function is at the heart of the region polyfill
		// it will iteratively fill a list of regions until no
		// content or no region is left
		//
		// the before-overflow size of a region is determined by
		// adding all content to it and comparing his offsetHeight
		// and his scrollHeight
		//
		// when this is done, we use dom ranges to detect the point
		// where the content exceed this box and we split the fragment
		// at that point.
		//
		// when splitting inside an element, the borders, paddings and
		// generated content must be tied to the right fragments which
		// require some code
		//
		// this functions returns whether some content was still remaining
		// when the flow when the last region was filled. please not this
		// can only happen if this last region has "region-fragment" set
		// to break, otherwhise all the content will automatically overflow
		// this last region.
		//
		layoutContent: function(regions, remainingContent, callback, startTime) {
			
			//
			// this function will iteratively fill all the regions
			// when we reach the last region, we return the overset status
			//
			
			// validate args
			if(!regions) return callback.ondone(!!remainingContent.hasChildNodes());
			if(!regions.length) return callback.ondone(!!remainingContent.hasChildNodes());
			if(!startTime) startTime = Date.now();
			
			// get the next region
			var region = regions.pop();
			  
			// NOTE: while we don't monitor that, and it can therefore become inaccurate
			// I'm going to follow the spec and refuse to mark as region inline/none elements]
			while(true) {
				var regionDisplay = getComputedStyle(region).display;
				if(regionDisplay == "none" || regionDisplay.indexOf("inline") !== -1) {
					if(region = regions.pop()) { continue } else { return callback.ondone(!!remainingContent.hasChildNodes()) };
				} else {
					break;
				}
			}
			
			// the polyfill actually use a <cssregion> wrapper
			// we need to link this wrapper and the actual region
			if(region.cssRegionsWrapper) {
				region.cssRegionsWrapper.cssRegionHost = region;
				region = region.cssRegionsWrapper;
			} else {
				region.cssRegionHost = region;
			}
			
			// empty the region
			region.innerHTML = '';
			
			// avoid doing the layout of empty regions
			if(!remainingContent.hasChildNodes()) {
				
				region.cssRegionHost.cssRegionsLastOffsetHeight = region.cssRegionHost.offsetHeight;
				region.cssRegionHost.cssRegionsLastOffsetWidth = region.cssRegionHost.offsetWidth;
				
				region.cssRegionHost.regionOverset = 'empty';
				
				var dummyCallback = { ondone:function(){}, onprogress:function(f){f()} };
				cssRegions.layoutContent(regions, remainingContent, dummyCallback, startTime);
				
				return callback.ondone(false);
				
			}
			
			// append the remaining content to the region
			region.appendChild(remainingContent);
			
			// check if we have more regions to process
			if(regions.length !== 0) {
				
				return this.layoutContentInNextRegionsWhenReady(region, regions, remainingContent, callback, startTime);
				
			} else {
				
				return this.layoutContentInLastRegionWhenReady(region, regions, remainingContent, callback, startTime);
				
			}
			
		},
		
		layoutContentInNextRegionsWhenReady: function(region, regions, remainingContent, callback, startTime) {
					
			// delays until all images are loaded
			var imgs = region.getElementsByTagName('img');
			for(var imgs_index=imgs.length; imgs_index--; ) {
				if(!imgs[imgs_index].complete && !imgs[imgs_index].hasAttribute('height')) {
					return setTimeout(
						function() {
							this.layoutContentInNextRegionsWhenReady(region, regions, remainingContent, callback, startTime+32);
						}.bind(this), 
						16
					);
				}
			}
			
			// check if there was an overflow or some break-before/after instruction
			var regionDidOverflow = region.cssRegionHost.scrollHeight != region.cssRegionHost.offsetHeight;
			var shouldSegmentContent = regionDidOverflow;
			if(!shouldSegmentContent) {
				var first = region.firstElementChild;
				var last = region.lastElementChild;
				var current = first;
				while(current) {
					
					if(current != first) {
						if(/(region|all|always)/i.test(cssCascade.getSpecifiedStyle(current,'break-before',undefined,true).toCSSString())) {
							shouldSegmentContent = true; break;
						}
					}
					
					if(current != last) {
						if(/(region|all|always)/i.test(cssCascade.getSpecifiedStyle(current,'break-after',undefined,true).toCSSString())) {
							current = current.nextElementSibling;
							shouldSegmentContent = true; break;
						}
					}

					current = current.nextElementSibling;
				}
			}
			
			
			if(shouldSegmentContent) {
				
				// the remaining content is what was overflowing
				remainingContent = this.extractOverflowingContent(region);
				
			} else {
				
				// there's nothing more to insert
				remainingContent = document.createDocumentFragment();
				
			}
			
			// if any content didn't fit
			if(remainingContent.hasChildNodes()) {
				region.cssRegionHost.regionOverset = 'overset';
			} else {
				region.cssRegionHost.regionOverset = 'fit';
			}
			
			// update flags
			region.cssRegionHost.cssRegionsLastOffsetHeight = region.cssRegionHost.offsetHeight;
			region.cssRegionHost.cssRegionsLastOffsetWidth = region.cssRegionHost.offsetWidth;
			
			// layout the next regions
			// WE LET THE NEXT REGION DECIDE WHAT TO RETURN
			if(startTime+200 > Date.now()) {
				
				return cssRegions.layoutContent(regions, remainingContent, callback, startTime);
				
			} else {
				
				return callback.onprogress(function() {
					cssRegions.layoutContent(regions, remainingContent, callback);
				});
				
			}
			
		},
		
		layoutContentInLastRegionWhenReady: function(region, regions, remainingContent, callback, startTime) {
			
			// delays until all images are loaded
			var imgs = region.getElementsByTagName('img');
			for(var imgs_index=imgs.length; imgs_index--; ) {
				if(!imgs[imgs_index].complete && !imgs[imgs_index].hasAttribute('height')) {
					return setTimeout(
						function() {
							this.layoutContentInLastRegionWhenReady(region, regions, remainingContent, callback, startTime+32);
						}.bind(this), 
						32
					);
				}
			}
			
			// support region-fragment: break
			if(cssCascade.getSpecifiedStyle(region.cssRegionHost,"region-fragment",undefined,true).toCSSString().trim().toLowerCase()=="break") {
				
				// WE RETURN TRUE IF WE DID OVERFLOW
				var didOverflow = (this.extractOverflowingContent(region).hasChildNodes());
				
				// update flags
				region.cssRegionHost.cssRegionsLastOffsetHeight = region.cssRegionHost.offsetHeight;
				region.cssRegionHost.cssRegionsLastOffsetWidth = region.cssRegionHost.offsetWidth;
				
				return callback.ondone(didOverflow);
				
			} else {
				
				// update flags
				region.cssRegionHost.cssRegionsLastOffsetHeight = region.cssRegionHost.offsetHeight;
				region.cssRegionHost.cssRegionsLastOffsetWidth = region.cssRegionHost.offsetWidth;
				
				// WE RETURN FALSE IF WE DIDN'T OVERFLOW
				return callback.ondone(region.cssRegionHost.offsetHeight != region.cssRegionHost.scrollHeight);
				
			}
		},

		
		//
		// this function returns a document fragment containing the content
		// that didn't fit in a particular <cssregion> element.
		//
		// in the simplest cases, we can just use hit-targeting to get very
		// close the the natural breaking point. for mostly textual flows,
		// this works perfectly, for the others, we may need some tweaks.
		//
		// there's a code detecting whether this hit-target optimization
		// did possibly fail, in which case we return to a setup where we
		// start from scratch.
		//
		extractOverflowingContent: function(region, dontOptimize) {
			
			// make sure empty nodes don't make our life more difficult
			cssRegionsHelpers.embedTrailingWhiteSpaceNodes(region);
			
			// get the region layout
			var sizingH = region.cssRegionHost.offsetHeight; // avail size (max-height)
			var sizingW = region.cssRegionHost.offsetWidth; // avail size (max-width)
			var pos = region.cssRegionHost.getBoundingClientRect(); // avail size?
			pos = {top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right};
			
			// substract from the bottom any border/padding of the region
			var lostHeight = parseInt(getComputedStyle(region.cssRegionHost).paddingBottom);
			lostHeight += parseInt(getComputedStyle(region.cssRegionHost).borderBottomWidth);
			pos.bottom -= lostHeight; sizingH -= lostHeight;
			
			//
			// note: let's use hit targeting to find a dom range
			// which is close to the location where we will need to
			// break the content into fragments
			// 
			
			// get the caret range for the bottom-right of that location
			try {
				var r = dontOptimize ? document.createRange() : document.caretRangeFromPoint(
					pos.left + sizingW - 1,
					pos.top + sizingH - 1
				);
			} catch (ex) {
				try {
					cssConsole.error(ex.message);
					cssConsole.dir(ex);
				} catch (ex) {}
			}
			
			// helper for logging info
			/*cssConsole.log("extracting overflow")
			cssConsole.log(pos.bottom)*/
			var debug = function() {
				/*cssConsole.dir({
					startContainer: r.startContainer,
					startOffset: r.startOffset,
					browserBCR: r.getBoundingClientRect(),
					computedBCR: rect
				});*/
			}
			
			var fixNullRect = function() {
				if(rect.bottom==0 && rect.top==0 && rect.left==0 && rect.right==0) {
					
					var scrollTop = -(document.documentElement.scrollTop || document.body.scrollTop);
					var scrollLeft = -(document.documentElement.scrollLeft || document.body.scrollLeft);
					
					rect = {
						width: 0,
						heigth: 0,
						top: scrollTop,
						bottom: scrollTop,
						left: scrollLeft,
						right: scrollLeft
					}
				}
			}
			
			// if the caret is outside the region
			if(!r || (region !== r.endContainer && !Node.contains(region,r.endContainer))) {
				
				// if the caret is after the region wrapper but inside the host...
				if(r && r.endContainer === region.cssRegionHost && r.endOffset==r.endContainer.childNodes.length) {
					
					// move back at the end of the region, actually
					r.setStart(region, region.childNodes.length);
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
				var rect = r.myGetExtensionRect(); fixNullRect();
				debug();
				
				//
				// note: maybe the text is right-to-left
				// in this case, we can go further than the caret
				//
				
				// move the end point char by char until it's completely in the region
				while(!(r.endContainer==region && r.endOffset==r.endContainer.childNodes.length) && rect.bottom<=pos.top+sizingH) {
					
					debug();
					
					// look if we can optimize by moving fast forward
					var nextSibling = r.endContainer.childNodes[r.endOffset];
					var nextSiblingRect = !nextSibling || Node.getBoundingClientRect(nextSibling);
					if(nextSibling && nextSiblingRect.bottom<=pos.top+sizingH) {
						
						// if yes, move element by element
						r.setStartAfter(nextSibling)
						r.setEndAfter(nextSibling)
						rect = nextSiblingRect
						fixNullRect()
						
					} else {
						
						// otherwise, go char-by-char
						r.myMoveTowardRight(); rect = r.myGetExtensionRect(); fixNullRect();
						
					}
				}
				
				//
				// note: maybe the text is one line too big
				// in this case, we have to backtrack a little
				//
				
				// move the end point char by char until it's completely in the region
				while(!(r.endContainer==region && r.endOffset==0) && rect.bottom>pos.top+sizingH) {
					debug(); r.myMoveOneCharLeft(); rect = r.myGetExtensionRect(); fixNullRect();
				}
				
				debug()
				
				//
				// note: if we optimized via hit-testing, this may be wrong
				// if next condition does not hold, we're fine. 
				// otherwhise we must restart without optimization...
				//
				
				// if the selected content is possibly off-target
				var optimizationFailled = false; if(!dontOptimize) {
					
					var current = r.endContainer;
					while(current = cssRegionsHelpers.getAllLevelPreviousSibling(current, region)) {
						if(Node.getBoundingClientRect(current).bottom > pos.top + sizingH) {
							r.setStart(region,0);
							r.setEnd(region,0);
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
			
			// if the selection is not in the region anymore, add the whole region
			if(!r || (region !== r.endContainer && !Node.contains(region,r.endContainer))) {
				cssConsole.dir(r.cloneRange()); debugger;
				r.setStart(region,region.childNodes.length);
				r.setEnd(region,region.childNodes.length);
			}
			
			// 
			// note: we don't want to break inside a line.
			// backtrack to end of previous line...
			// 
			var first = r.startContainer.childNodes[r.startOffset], current = first; 
			if(cssBreak.hasAnyInlineFlow(r.startContainer)) {
				while((current) && (current = current.previousSibling)) {
					
					if(cssBreak.areInSameSingleLine(current,first)) {
						
						// optimization: first and current are on the same line
						// so if next and current are not the same line, it will still be
						// the same line the "first" element is in
						first = current;
						
						if(current instanceof Element) {
							
							// we don't want to break inside text lines
							r.setEndBefore(current);
							
						} else {
							
							// get last line via client rects
							var lines = Node.getClientRects(current);
							
							// if the text node did wrap into multiple lines
							if(lines.length>1) {
								
								// move back from the end until we get into previous line
								var previousLineBottom = lines[lines.length-2].bottom;
								r.setEnd(current, current.nodeValue.length);
								while(rect.bottom>previousLineBottom) {
									r.myMoveOneCharLeft(); rect = r.myGetExtensionRect(); fixNullRect();
								}
								
								// make sure we didn't exit the text node by mistake
								if(r.endContainer!==current) {
									// if we did, there's something wrong about the text node
									// but we can consider the text node as an element instead
									r.setEndBefore(current); // debugger; 
								}
								
							} else {
								
								// we can consider the text node as an element
								r.setEndBefore(current);
								
							}
							
						}
					} else {
						
						// if the two elements are not on the same line, 
						// then we just found a line break!
						break;
						
					}
					
				}
			}
			
			// if the selection is not in the region anymore, add the whole region
			if(!r || (region !== r.endContainer && !Node.contains(region,r.endContainer))) {
				cssConsole.dir(r.cloneRange()); debugger;
				r.setStart(region,region.childNodes.length);
				r.setEnd(region,region.childNodes.length);
			}
			
			
			// 
			// note: the css-break spec says that a region should not be emtpy
			// 
			
			// if we end up with nothing being selected, add the first block anyway
			if(r.endContainer===region && r.endOffset===0 && r.endOffset!==region.childNodes.length) {
				
				// find the first allowed break point
				do {
					
					//cssConsole.dir(r.cloneRange()); 
					
					// move the position char-by-char
					r.myMoveTowardRight(); 
					
					// but skip long islands of monolithic elements
					// since we know we cannot break inside them anyway
					var current = r.endContainer;
					while(current && current !== region) {
						if(cssBreak.isMonolithic(current)) {
							r.setStartAfter(current);
							r.setEndAfter(current);
						}
						current = current.parentNode;
					}
					
				}
				// do that until we reach a possible break point, or the end of the element
				while(!cssBreak.isPossibleBreakPoint(r,region) && !(r.endContainer===region && r.endOffset===region.childNodes.length))
				
			}
			
			// if the selection is not in the region anymore, add the whole region
			if(!r || region !== r.endContainer && !Node.contains(region,r.endContainer)) {
				cssConsole.dir(r.cloneRange()); debugger;
				r.setStart(region,region.childNodes.length);
				r.setEnd(region,region.childNodes.length);
			}
				
			// now, let's try to find a break-before/break-after element before the splitting point
			var current = r.endContainer; if(current.hasChildNodes()) { if(r.endOffset>0) { current=current.childNodes[r.endOffset-1] } };
			var first = r.endContainer.firstChild;
			do {
				if(current.style) {
					
					if(current != first) {
						if(/(region|all|always)/i.test(cssCascade.getSpecifiedStyle(current,'break-before',undefined,true).toCSSString())) {
							r.setStartBefore(current);
							r.setEndBefore(current);
							dontOptimize=true; // no algo involved in breaking, after all
						}
					}
					
					if(current !== region) {
						if(/(region|all|always)/i.test(cssCascade.getSpecifiedStyle(current,'break-after',undefined,true).toCSSString())) {
							r.setStartAfter(current);
							r.setEndAfter(current);
							dontOptimize=true; // no algo involved in breaking, after all
						}
					}
					
				}
			} while(current = cssRegionsHelpers.getAllLevelPreviousSibling(current, region));
			
			// we're almost done! now, let's collect the ancestors to make some splitting postprocessing
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
			// TODO: avoid top & bottom p/b/m cuttings to use the 
			// same variables names, it's ugly
			//
			
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
			
			
			// split top-{margin/border/padding} correctly
			if(r.endOffset == 0 && r.endContainer !== region) {
				
				// note: the only possibility here is that we 
				// did split after a padding or a border.
				// 
				// it can only happen if the border/padding is 
				// too big to fit the region but is actually 
				// the first break we could find!
				
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
				allAncestors[i].setAttribute('data-css-continued-fragment',true);
				if(getComputedStyle(allAncestors[i]).display.indexOf('block')>=0) {
					allAncestors[i].setAttribute('data-css-continued-block-fragment',true);
				}
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
			// note: at this point we have a collapsed range 
			// located at the split point
			//
			
			// select the overflowing content
			r.setEnd(region, region.childNodes.length);
			
			// extract it from the current region
			var overflowingContent = r.extractContents();
			
			// remove trailing whitespace from the cut element
			var tmp = allAncestors[0];
			if(tmp && (tmp=tmp.lastChild) && !tmp.tagName && tmp.nodeValue) {
				var nodeValue = tmp.nodeValue.replace(/(\s|\r|\n)*$/,'');
				if(nodeValue) {
					// if the last cut was just after a &shy; (soft hyphen), we need to append a dash
					if(/\u00AD$/.test(nodeValue)) {
						nodeValue = nodeValue.replace(/\u00AD$/, '-');
					}
					tmp.nodeValue = nodeValue;
				} else {
					tmp.parentNode.removeChild(tmp);
				}
			}
			
			// 
			// note: now we have to cancel out the artifacts of
			// the fragments cloning algorithm...
			//
			
			// do not forget to remove any top p/b/m on cut elements
			var newFragments = overflowingContent.querySelectorAll("[data-css-continued-fragment]");
			for(var i=newFragments.length; i--;) { // TODO: optimize by using while loop and a simple matchesSelector.
				newFragments[i].removeAttribute('data-css-continued-fragment')
				newFragments[i].setAttribute('data-css-starting-fragment',true);
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
				
				// hum... there's an element missing here... {never happens anymore}
				try { throw new Error() }
				catch(ex) { setImmediate(function() { throw ex; }) }
				
			} else if(typeof(topPaddingCut)==="number") {
				
				// hum... there's an element missing here... {never happens anymore}
				try { throw new Error() }
				catch(ex) { setImmediate(function() { throw ex; }) }
				
			}
			
			
			// make sure empty nodes are reintroduced
			cssRegionsHelpers.unembedTrailingWhiteSpaceNodes(region);
			cssRegionsHelpers.unembedTrailingWhiteSpaceNodes(overflowingContent);
			
			// we're ready to return our result!
			return overflowingContent;
			
		},
			
		enablePolyfill: function enablePolyfill() {
			
			//
			// [0] insert necessary css
			//
			var s = document.createElement('style');
			s.setAttribute("data-css-no-polyfill", true);
			s.textContent = CSS_STYLE;
			var head = document.head || document.getElementsByTagName('head')[0];
			head.appendChild(s);
			
			// 
			// [1] when any update happens:
			// construct new content and region flow pairs
			// restart the region layout algorithm for the modified pairs
			// 
			cssCascade.startMonitoringProperties(
				["flow-into","flow-from","region-fragment"], 
				{
					onupdate: function onupdate(element, rule) {
						
						// let's just ignore fragments
						if(element.getAttributeNode('data-css-regions-fragment-of')) return;
						
						// log some message in the console for debug
						cssConsole.dir({message:"onupdate",element:element,selector:rule.selector.toCSSString(),rule:rule});
						var temp = null;
						
						//
						// compute the value of region properties
						//
						var flowInto = (
							cssCascade.getSpecifiedStyle(element, "flow-into")
							.filter(function(t) { return t instanceof cssSyntax.IdentifierToken })
						);
						
						var flowIntoName = flowInto[0] ? flowInto[0].toCSSString().toLowerCase() : "";
						if(flowIntoName=="none"||flowIntoName=="initial"||flowIntoName=="inherit"||flowIntoName=="default") {flowIntoName=""}
						var flowIntoType = flowInto[1] ? flowInto[1].toCSSString().toLowerCase() : ""; 
						if(flowIntoType!="content") {flowIntoType="element"}
						var flowInto = flowIntoName ? flowIntoName + " " + flowIntoType : "";
						
						var flowFrom = (
							cssCascade.getSpecifiedStyle(element, "flow-from")
							.filter(function(t) { return t instanceof cssSyntax.IdentifierToken })
						);
						
						var flowFromName = flowFrom[0] ? flowFrom[0].toCSSString().toLowerCase() : ""; 
						if(flowFromName=="none"||flowFromName=="initial"||flowFromName=="inherit"||flowFromName=="default") {flowFromName=""}
						var flowFrom = flowFromName;
						
						//
						// if the value of any property did change...
						//
						if(element.cssRegionsLastFlowInto != flowInto || element.cssRegionsLastFlowFrom != flowFrom) {
							
							// remove the element from previous regions
							var regionOverset = element.regionOverset;
							var lastFlowFrom = (cssRegions.flows[element.cssRegionsLastFlowFromName]);
							var lastFlowInto = (cssRegions.flows[element.cssRegionsLastFlowIntoName]);
							lastFlowFrom && lastFlowFrom.removeFromRegions(element);
							lastFlowInto && lastFlowInto.removeFromContent(element);
							
							// relayout those regions 
							// (it's async so it will wait for us
							// to add the element back if needed)
							lastFlowFrom && regionOverset!='empty' && lastFlowFrom.relayout();
							lastFlowInto && lastFlowInto.relayout();
							
							// save some property values for later
							element.cssRegionsLastFlowInto = flowInto;
							element.cssRegionsLastFlowFrom = flowFrom;
							element.cssRegionsLastFlowIntoName = flowIntoName;
							element.cssRegionsLastFlowFromName = flowFromName;
							element.cssRegionsLastFlowIntoType = flowIntoType;
							
							// add the element to new regions
							// and relayout those regions, if deemed necessary
							if(flowFromName) {
								var lastFlowFrom = (cssRegions.flows[flowFromName] = cssRegions.flows[flowFromName] || new cssRegions.Flow(flowFromName));
								lastFlowFrom && lastFlowFrom.addToRegions(element);
								lastFlowFrom && lastFlowFrom.relayout();
							}
							if(flowIntoName) {
								var lastFlowInto = (cssRegions.flows[flowIntoName] = cssRegions.flows[flowIntoName] || new cssRegions.Flow(flowIntoName));
								lastFlowInto && lastFlowInto.addToContent(element);
								lastFlowInto && lastFlowInto.relayout();
							}
							
						}
						
					}
				}
			);
			cssCascade.startMonitoringProperties(
				["break-before","break-after"], 
				{onupdate:function(element){
					
					// avoid fragments triggering update loops
					if(element.getAttribute('data-css-regions-fragment-of')){return;}
					
					// update parent regions
					while(element) {
						if(element.cssRegionsLastFlowIntoName) {
							cssRegions.flows[element.cssRegionsLastFlowIntoName].relayout();
							return;
						}
						element=element.parentNode;
					}
					
				}}
			);
			
			
			//
			// [2] perform the OM exports
			//
			cssRegions.enablePolyfillObjectModel();
			
			//
			// [3] make sure to update the region layout when all images loaded
			//
			window.addEventListener("load", 
				function() { 
					var flows = document.getNamedFlows();
					for(var i=0; i<flows.length; i++) {
						flows[i].relayout();
					}
				}
			);
			
			// 
			// [4] make sure we react to window resizes
			//
			//
			var lastWindowResize = 0;
			var relayoutModifiedFlows = function() {
				
				// specify the function did run
				relayoutModifiedFlows.timeout = 0;
				
				// rerun the layout
				var flows = document.getNamedFlows();
				for(var i=0; i<flows.length; i++) {
					if(flows[i].lastRelayout > lastWindowResize) continue;
					if(flows[i].relayoutInProgress) {
						flows[i].relayout();
					} else {
						flows[i].relayoutIfSizeChanged();
					}
				}
				
			}
			var hasOngoingLayouts = function() {
				
				var flows = document.getNamedFlows();
				for(var i=0; i<flows.length; i++) {
					if(flows[i].lastRelayout > lastWindowResize) continue;
					if(flows[i].relayoutInProgress) {
						return true;
					}
				}
				
				return false;
				
			}
			var restartOngoingLayouts = function() {
				
				var flows = document.getNamedFlows();
				for(var i=0; i<flows.length; i++) {
					if(flows[i].lastRelayout > lastWindowResize) continue;
					if(flows[i].relayoutInProgress) {
						flows[i].relayout();
					}
				}
				
			}
			window.addEventListener("resize",
				function() {
					
					// update the last layout flag
					lastWindowResize = +new Date();
					
					// if we aren't planning a resfresh already
					if(!relayoutModifiedFlows.timeout) { 
						
						// if we are already busy
						if(hasOngoingLayouts()) {
							
							// restart all layouts now
							setTimeout(restartOngoingLayouts, 16);
							
							// wait half a second before restarting them from now
							relayoutModifiedFlows.timeout = setTimeout(relayoutModifiedFlows, 500);
							
						} else {
							
							// debounce by running the resize code every 200ms
							relayoutModifiedFlows.timeout = setTimeout(relayoutModifiedFlows, 200);
							
						}
						
					}
					
				}
			);
			
		},
		
		// this dictionary is supposed to contains all the currently existing flows
		flows: Object.create ? Object.create(null) : {}
		
	};
	
	enableObjectModel(window, document, cssRegions);
	
	return cssRegions;
})(window, document);