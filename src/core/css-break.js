module.exports = (function(window, document) { "use strict"; 

	var cssSyntax = require('core:css-syntax');
	var cssCascade = require('core:css-cascade');
	
	var cssBreak = {

		//
		// returns true if an element is replaced 
		// (can't be broken because considered as an image in css layout)
		// 
		isReplacedElement: function isReplacedElement(element) {
			if(!(element instanceof Element)) return false;
			var replacedElementTags = /^(SVG|MATH|IMG|VIDEO|PICTURE|OBJECT|EMBED|IFRAME|TEXTAREA|BUTTON|INPUT)$/; // TODO: more
			return replacedElementTags.test(element.tagName);
		},
		
		// 
		// returns true if an element has a scrollbar or act on overflowing content
		// 
		isScrollable: function isScrollable(element, elementOverflow) {
			if(!(element instanceof Element)) return false;
			if(typeof(elementOverflow)=="undefined") elementOverflow = getComputedStyle(element).overflow;
			
			return (
				elementOverflow !== "visible"
				&& elementOverflow !== "hidden"
			);
			
		},
		
		// 
		// returns true if the element is part of an inline flow
		// TextNodes definitely qualify, but also inline-block elements
		// 
		isSingleLineOfTextComponent: function(element, elementStyle, elementDisplay, elementPosition, isReplaced) {
			if(!(element instanceof Element)) return true;
			if(typeof(elementStyle)=="undefined") elementStyle = getComputedStyle(element);
			if(typeof(elementDisplay)=="undefined") elementDisplay = elementStyle.display;
			if(typeof(elementPosition)=="undefined") elementPosition = elementStyle.position;
			if(typeof(isReplaced)=="undefined") isReplaced = this.isReplacedElement(element);
			
			return (
				elementDisplay === "inline-block"
				|| elementDisplay === "inline-table"
				|| elementDisplay === "inline-flex"
				|| elementDisplay === "inline-grid"
				// TODO: more
			) && (
				elementPosition === "static"
				|| elementPosition === "relative"
			);
			
		},
		
		// 
		// returns true if the element is part of an inline flow
		// TextNodes definitely qualify, but also inline-block elements
		// 
		hasAnyInlineFlow: function(element) {
			
			function countAsInline(element) {
				if(!(element instanceof Element)) return !(/^\s*$/.test(element.nodeValue));
				return !cssBreak.isOutOfFlowElement(element) && cssBreak.isSingleLineOfTextComponent(element);
			}
			
			// try to find any inline element
			var current = element.firstChild;
			while(current) {
				if(countAsInline(current)) return true;
				current = current.nextSibling;
			}
			
			// no inline element
			return false;
			
		},
		
		// 
		// returns true if the element breaks the inline flow
		// (the case of block elements, mostly)
		// 
		isLineBreakingElement: function(element, elementStyle, elementDisplay, elementPosition) {
			
			if(!(element instanceof Element)) return false;
			if(typeof(elementStyle)=="undefined") elementStyle = getComputedStyle(element);
			if(typeof(elementDisplay)=="undefined") elementDisplay = elementStyle.display;
			if(typeof(elementPosition)=="undefined") elementPosition = elementStyle.position;
			
			return (
				(
					// in-flow bock elements
					(elementDisplay === "block")
					&& !this.isOutOfFlowElement(element, elementStyle, elementDisplay, elementPosition)
					
				) || (
					
					// displayed <br> elements
					element.tagName==="BR" && elementDisplay!=="none"
					
				)
			);
		},
		
		// 
		// returns true if the element breaks the inline flow before him
		// (the case of block elements, mostly)
		// 
		isLinePreBreakingElement: function(element, elementStyle, elementDisplay, elementPosition) {
			if(!(element instanceof Element)) return false;

			var breakBefore = cssCascade.getSpecifiedStyle(element,'break-before').toCSSString();
			return (
				(breakBefore=="region"||breakBefore=="all") 
				|| cssBreak.isLineBreakingElement(element, elementStyle, elementDisplay, elementPosition)
			);
			
		},
		
		// 
		// returns true if the element breaks the inline flow after him
		// (the case of block elements, mostly)
		// 
		isLinePostBreakingElement: function(element, elementStyle, elementDisplay, elementPosition) {
			if(!(element instanceof Element)) return false;
			
			var breakAfter = cssCascade.getSpecifiedStyle(element,'break-after').toCSSString();
			return (
				(breakAfter=="region"||breakAfter=="all") 
				|| cssBreak.isLineBreakingElement(element, elementStyle, elementDisplay, elementPosition)
			);
			
		},
		
		// 
		// returns true if the element is outside any block/inline flow
		// (this the case of absolutely positioned elements, and floats)
		// 
		isOutOfFlowElement: function(element, elementStyle, elementDisplay, elementPosition, elementFloat) {
			if(!(element instanceof Element)) return false;
			if(typeof(elementStyle)=="undefined") elementStyle = getComputedStyle(element);
			if(typeof(elementDisplay)=="undefined") elementDisplay = elementStyle.display;
			if(typeof(elementPosition)=="undefined") elementPosition = elementStyle.position; 
			if(typeof(elementFloat)=="undefined") elementFloat = elementStyle.float || elementStyle.styleFloat || elementStyle.cssFloat;
			
			return (
				
				// positioned elements are out of the flow
				(elementPosition==="absolute"||elementPosition==="fixed")
				
				// floated elements as well
				|| (elementFloat!=="none") 
				
				// not sure but let's say hidden elements as well
				|| (elementDisplay==="none")
				
			);
			
		},
		
		// 
		// returns true if two sibling elements are in the same text line
		// (this function is not perfect, work with it with care)
		// 
		areInSameSingleLine: function areInSameSingleLine(element1, element2) {
			
			//
			// look for obvious reasons why it wouldn't be the case
			//
			
			// if the element are not direct sibling, we must use their inner siblings as well
			if(element1.nextSibling != element2) { 
				if(element2.nextSibling != element1) throw "I gave up!"; 
				var t = element1; element1=element2; element2=t;
			}
			 
			// a block element is never on the same line as another element
			if(this.isLinePostBreakingElement(element1)) return false;
			if(this.isLinePreBreakingElement(element2)) return false;
			
			// if the previous element is out of flow, we may consider it as being part of the current line
			if(this.isOutOfFlowElement(element1)) return true;
			
			// if the current object is not a single line component, return false
			if(!this.isSingleLineOfTextComponent(element1)) return false;
			
			// 
			// compute the in-flow bounding rect of the two elements
			// 
			var element1box = Node.getBoundingClientRect(element1);
			var element2box = Node.getBoundingClientRect(element2);
			function shift(box,shiftX,shiftY) {
				return {
					top: box.top+shiftY,
					bottom: box.bottom+shiftY,
					left: box.left+shiftX,
					right: box.right+shiftX
				}
			}
			
			// we only need to shift elements
			if(element1 instanceof Element) {
				var element1Style = getComputedStyle(element1);
				element1box = shift(element1box, parseFloat(element1Style.marginLeft), parseFloat(element1Style.marginTop))
				if(element1Style.position=="relative") {
					element1box = shift(element1box, parseFloat(element1Style.left), parseFloat(element1Style.top))
				}
			}
			
			// we only need to shift elements
			if(element2 instanceof Element) {
				var element2Style = getComputedStyle(element2);
				element2box = shift(element2box, parseFloat(element2Style.marginLeft), parseFloat(element2Style.marginTop))
				if(element2Style.position=="relative") {
					element2box = shift(element2box, parseFloat(element2Style.left), parseFloat(element2Style.top))
				}
			}
			
			// order the nodes so that they are in left-to-right order
			// (this means invert their order in the case of right-to-left flow)
			var firstElement = getComputedStyle(element1.parentNode).direction=="rtl" ? element2box : element1box;
			var secondElement = getComputedStyle(element1.parentNode).direction=="rtl" ? element1box : element2box;
			
			// return true if both elements are have non-overlapping
			// margin- and position-corrected in-flow bounding rect
			// and if their relative position is the one of the current
			// flow (either rtl or ltr)
			return firstElement.right <= secondElement.left;
			
			// TODO: what about left-to-right + right-aligned text?
			// I should probably takes care of vertical position in this case to solve ambiguities
			
		},
		
		//
		// returns true if the element has "overflow: hidden" set on it, and actually overflows
		//
		isHiddenOverflowing: function isHiddenOverflowing(element, elementOverflow) {
			if(!(element instanceof Element)) return false;
			if(typeof(elementOverflow)=="undefined") elementOverflow = getComputedStyle(element).display;
			
			return (
				elementOverflow == "hidden" 
				&& element.offsetHeight != element.scrollHeight // trust me that works
			);
			
		},
		
		//
		// returns true if the element has a border-radius that impacts his layout
		//
		hasBigRadius: function(element, elementStyle) {
			if(!(element instanceof Element)) return false;
			if(typeof(elementStyle)=="undefined") elementStyle = getComputedStyle(element);

			// if the browser supports radiuses {f### prefixes}
			if("borderTopLeftRadius" in elementStyle) {
				
				var tlRadius = parseFloat(elementStyle.borderTopLeftRadius);
				var trRadius = parseFloat(elementStyle.borderTopRightRadius);
				var blRadius = parseFloat(elementStyle.borderBottomLeftRadius);
				var brRadius = parseFloat(elementStyle.borderBottomRightRadius);
				
				// tiny radiuses (<15px) are tolerated anyway
				if(tlRadius < 15 && trRadius < 15 && blRadius < 15 && brRadius < 15) {
					return false;
				}
				
				var tWidth = parseFloat(elementStyle.borderTopWidth);
				var bWidth = parseFloat(elementStyle.borderBottomWidth);
				var lWidth = parseFloat(elementStyle.borderLeftWidth);
				var rWidth = parseFloat(elementStyle.borderRightWidth);
				
				// make sure the radius itself is contained into the border
				
				if(tlRadius > tWidth) return true;
				if(tlRadius > lWidth) return true;
				
				if(trRadius > tWidth) return true;
				if(trRadius > rWidth) return true;
				
				if(blRadius > bWidth) return true;
				if(blRadius > lWidth) return true;
				
				if(brRadius > bWidth) return true;
				if(brRadius > rWidth) return true;
				
			}
			
			// all conditions were met
			return false;
		},
		
		//
		// return trus if the break-inside property is 'avoid' or 'avoid-region'
		//
		isBreakInsideAvoid: function isBreakInsideAvoid(element, elementStyle) {
			var breakInside = cssCascade.getSpecifiedStyle(element, 'break-inside', undefined, true).toCSSString().trim().toLowerCase(); 
			return (breakInside == "avoid" || breakInside == "avoid-region");
		},
		
		//
		// returns true if the element is unbreakable according to the spec
		// (and some of the expected limitations of HTML/CSS)
		//
		isMonolithic: function isMonolithic(element) {
			if(!(element instanceof Element)) return false;
			
			var elementStyle = getComputedStyle(element);
			var elementOverflow = elementStyle.overflow;
			var elementDisplay = elementStyle.display;
			
			// Some content is not fragmentable, for example:
			// - many types of replaced elements (such as images or video)
			
			var isReplaced = this.isReplacedElement(element);
			
			// - scrollable elements
			
			var isScrollable = this.isScrollable(element, elementOverflow);
			
			// - a single line of text content. 
			
			var isSingleLineOfText = this.isSingleLineOfTextComponent(element, elementStyle, elementDisplay, undefined, isReplaced);
			
			// Such content is considered monolithic: it contains no
			// possible break points. 
			
			// In addition to any content which is not fragmentable, 
			// UAs may consider as monolithic:
			// - any elements with ‘overflow’ set to ‘auto’ or ‘scroll’ 
			// - any elements with ‘overflow: hidden’ and a non-‘auto’ logical height (and no specified maximum logical height).
			
			var isHiddenOverflowing = this.isHiddenOverflowing(element, elementOverflow);
			
			// ADDITION TO THE SPEC:
			// I don't want to handle the case where 
			// an element has a border-radius that is bigger
			// than the border-width to which it belongs
			var hasBigRadius = this.hasBigRadius(element, elementStyle);
			
			// ADDITION TO THE SPEC:
			// Someone proposed to support "break-inside: avoid" here
			var isBreakInsideAvoid = this.isBreakInsideAvoid(element, elementStyle);
			
			// all of them are monolithic
			return isReplaced || isScrollable || isSingleLineOfText || isHiddenOverflowing || hasBigRadius || isBreakInsideAvoid;
			
		},
		
		// 
		// returns true if "r" is a collapsed range located at a possible break point for "region"
		// (this function does all the magic for you, but you may want to avoid using it too much)
		// 
		isPossibleBreakPoint: function isPossibleBreakPoint(r, region) {
			
			// r has to be a range, and be collapsed
			if(!(r instanceof Range)) return false;
			if(!(r.collapsed)) return false;
			
			// no ancestor up to the region has to be monolithic
			var ancestor = r.startContainer;
			while(ancestor && ancestor !== region) {
				if(cssBreak.isMonolithic(ancestor)) {
					return false;
				}
				ancestor = ancestor.parentNode;
			}
			
			// we also have to check that we're not between two single-line-of-text elements
			// that are actually on the same line (in which case you can't break)
			var ancestor = r.startContainer; 
			var lastAncestor = r.startContainer.childNodes[r.startOffset];
			while(ancestor && lastAncestor !== region) {
				if(lastAncestor && lastAncestor.previousSibling) {
					
					if(this.areInSameSingleLine(lastAncestor, lastAncestor.previousSibling)) {
						return false;
					}
					
				}
				
				lastAncestor = ancestor;
				ancestor = ancestor.parentNode;
			}
			
			// there are some very specific conditions for breaking
			// at the edge of an element:
			
			if(r.startOffset==0) {
				
				// Class 3 breaking point:
				// ========================
				// Between the content edge of a block container box 
				// and the outer edges of its child content (margin 
				// edges of block-level children or line box edges 
				// for inline-level children) if there is a (non-zero)
				// gap between them.
				
				var firstChild = r.startContainer.childNodes[0];
				if(firstChild) {
					
					var firstChildBox = (
						Node.getBoundingClientRect(firstChild)
					);
					
					var parentBox = (
						r.startContainer.getBoundingClientRect()
					);
					
					if(firstChildBox.top == parentBox.top) {
						return false;
					}
					
				} else {
					return false;
				}
				
			}
			
			// all conditions are met!
			return true;
			
		}
		
	};
	
	return cssBreak;
	
})(window, document);