//
// this module holds the big-picture actions of the polyfill
//
module.exports = (function(window, document) { "use strict";
	
	var domEvents = require('core:dom-events');
	var cssSyntax = require('core:css-syntax');
	var cssCascade = require('core:css-cascade');
	var cssBreak = require('core:css-break');

	var cssRegionsHelpers = window.cssRegionsHelpers = {
		
		//
		// returns the previous sibling of the element
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
		// prepares the element to become a css region
		//
		markNodesAsRegion: function(nodes,fast) {
			nodes.forEach(function(node) {
				node.regionOverset = 'empty';
				node.setAttribute('data-css-region',node.cssRegionsLastFlowFromName);
				cssRegionsHelpers.hideTextNodesFromFragmentSource([node]);
				node.cssRegionsWrapper = node.cssRegionsWrapper || node.appendChild(document.createElement("cssregion"));
			});
		},
		
		//
		// prepares the element to return to its normal css life
		//
		unmarkNodesAsRegion: function(nodes,fast) {
			nodes.forEach(function(node) {
				
				// restore regionOverset to its natural value
				node.regionOverset = 'fit';
				
				// remove the current <cssregion> tag
				try { node.cssRegionsWrapper && node.removeChild(node.cssRegionsWrapper); } 
				catch(ex) { setImmediate(function() { throw ex })}; 
				node.cssRegionsWrapper = undefined;
				delete node.cssRegionsWrapper;
				
				// restore top-level texts that may have been hidden
				cssRegionsHelpers.unhideTextNodesFromFragmentSource([node]);
				
				// unmark as a region
				node.removeAttribute('data-css-region');
			});
		},
		
		//
		// prepares the element for cloning (mainly give them an ID)
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
						
						node.setAttribute('data-css-regions-cloning', true);
						
						// expand list values
						if(node.tagName=='OL') cssRegionsHelpers.expandListValues(node);
						if(typeof(k)!="undefined" && node.tagName=="LI") cssRegionsHelpers.expandListValues(node.parentNode);
						
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
		// computes the "value" attribute of every LI element out there
		//
		expandListValues: function(OL) {
			if(OL.getAttribute("data-css-li-value-expanded")) return;
			OL.setAttribute('data-css-li-value-expanded', true);
			
			if(OL.hasAttribute("reversed")) {
				
				var currentValue = OL.getAttribute("start") ? parseInt(OL.getAttribute("start")) : OL.childElementCount;
				var increment = -1;
				
			} else {
				
				var currentValue = OL.getAttribute("start") ? parseInt(OL.getAttribute("start")) : 1;
				var increment = +1;
				
			}
			
			var LI = OL.firstElementChild; var LIV = null;
			while(LI) {
				if(LI.tagName==="LI") {
					if(LIV=LI.getAttributeNode("value")) {
						currentValue = parseInt(LIV.nodeValue);
						LI.setAttribute('data-css-old-value', currentValue)
					} else {
						LI.setAttribute("value", currentValue);
					}
					currentValue = currentValue + increment;
				}
				LI = LI.nextElementSibling;
			}
			
			
		},
		
		//
		// reverts to automatic computation of the value of LI elements
		//
		unexpandListValues: function(OL) {
			if(!OL.hasAttribute('data-css-li-value-expanded')) return;
			OL.removeAttribute('data-css-li-value-expanded')
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
		// makes empty text nodes which cannot get "display: none" applied to them
		//
		listOfTextNodesForIE: [],
		hideTextNodesFromFragmentSource: function(nodes) {
			
			function visit(node,k) {
				var child, next;
				switch (node.nodeType) {
					case 3: // Text node
						
						if(!node.parentNode.getAttribute('data-css-regions-fragment-source')) {
							// we have to remove their content the hard way...
							node.cssRegionsSavedNodeValue = node.nodeValue;
							node.nodeValue = "";
							
							// HACK: OTHERWISE IE WILL GC THE TEXTNODE AND RETURNS YOU
							// A FRESH TEXTNODE THE NEXT TIME WHERE YOUR EXPANDO
							// IS NOWHERE TO BE SEEN!
							if(navigator.userAgent.indexOf('MSIE')>0 || navigator.userAgent.indexOf("Trident")>0) {
								if(cssRegionsHelpers.listOfTextNodesForIE.indexOf(node)==-1) {
									cssRegionsHelpers.listOfTextNodesForIE.push(node);
								}
							}
						}
						
						break;
						
					case 1: // Element node
						if(node.hasAttribute('data-css-regions-cloning')) {
							node.removeAttribute('data-css-regions-cloning');
							node.setAttribute('data-css-regions-cloned', true);
							if(node.currentStyle) node.currentStyle.display.toString(); // IEFIX FOR BAD STYLE RECALC
						}
						if(typeof(k)=="undefined") return;
						
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
		// makes emptied text nodes visible again
		//
		unhideTextNodesFromFragmentSource: function(nodes) {
			
			function visit(node) {
				var child, next;
				switch (node.nodeType) {
					case 3: // Text node
						
						// we have to remove their content the hard way...
						if("cssRegionsSavedNodeValue" in node) {
							node.nodeValue = node.cssRegionsSavedNodeValue;
							delete node.cssRegionsSavedNodeValue;
						}
						
						break;
						
					case 1: // Element node
						if(typeof(k)=="undefined") return;
						
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
		// prepares the content elements to return to ther normal css life
		//
		unmarkNodesAsFragmentSource: function(nodes) {
			
			function visit(node,k) {
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
						node.removeAttribute('data-css-regions-cloned');
						node.removeAttribute('data-css-regions-fragment-source');
						if(node.currentStyle) node.currentStyle.display.toString(); // IEFIX FOR BAD STYLE RECALC
						if(node.tagName=="OL") cssRegionsHelpers.unexpandListValues(node);
						if(typeof(k)!="undefined" && node.tagName=="LI") cssRegionsHelpers.unexpandListValues(node.parentNode);
						
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
		// marks cloned content as fragment instead of as fragment source (basically)
		//
		transformFragmentSourceToFragments: function(nodes) {
			
			function visit(node) {
				var child, next;
				switch (node.nodeType) {
					case 1: // Element node
						var id = node.getAttribute('data-css-regions-fragment-source');
						node.removeAttribute('data-css-regions-fragment-source');
						node.removeAttribute('data-css-regions-cloning');
						node.removeAttribute('data-css-regions-cloned');
						node.setAttribute('data-css-regions-fragment-of', id);
						if(node.id) node.id += "--fragment";
						
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
		// removes some invisible text nodes from the tree
		// (useful if you don't want to face browser bugs when dealing with them)
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
		// recover the previously removed invisible text nodes
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
			
		},
		
		///
		/// walk the two trees the same way, and copy all the styles
		/// BEWARE: if the DOMs are different, funny things will happen
		/// NOTE: this function will also remove elements put in another flow
		///
		copyStyle: function(root1, root2) {
			
			function visit(node1, node2, isRoot) {
				var child1, next1, child2, next2;
				switch (node1.nodeType) {
					case 1: // Element node
						
						// firstly, setup a cache of all css properties on the element
						var matchedRules = (node1.currentStyle && !window.opera) ? undefined : cssCascade.findAllMatchingRules(node1)
						
						// and compute the value of all css properties
						var properties = cssCascade.allCSSProperties || cssCascade.getAllCSSProperties();
						for(var p=properties.length; p--; ) {
							
							// if the property is computation-safe, use the computed value
							if(!(properties[p] in cssCascade.computationUnsafeProperties) && properties[p][0]!='-') {
								var style = getComputedStyle(node1).getPropertyValue(properties[p]);
								var defaultStyle = cssCascade.getDefaultStyleForTag(node1.tagName).getPropertyValue(properties[p]);
								if(style != defaultStyle) node2.style.setProperty(properties[p], style)
								continue;
							}
							
							// otherwise, get the element's specified value
							var cssValue = cssCascade.getSpecifiedStyle(node1, properties[p], matchedRules);
							if(cssValue && cssValue.length) {
								
								// if we have a specified value, let's use it
								node2.style.setProperty(properties[p], cssValue.toCSSString());
								
							} else if(isRoot && node1.parentNode && properties[p][0] != '-') {
								
								// NOTE: the root will be detached from its parent
								// Therefore, we have to inherit styles from it (oh no!)
								
								// TODO: create a list of inherited properties
								if(!(properties[p] in cssCascade.inheritingProperties)) continue;
								
								// if the property is computation-safe, use the computed value
								if((properties[p]=="font-size") || (!(properties[p] in cssCascade.computationUnsafeProperties) && properties[p][0]!='-')) {
									var style = getComputedStyle(node1).getPropertyValue(properties[p]);
									node2.style.setProperty(properties[p], style);
									//var parentStyle = style; try { parentStyle = getComputedStyle(node1.parentNode).getPropertyValue(properties[p]) } catch(ex){}
									//var defaultStyle = cssCascade.getDefaultStyleForTag(node1.tagName).getPropertyValue(properties[p]);
									
									//if(style === parentStyle) {
									//  node2.style.setProperty(properties[p], style)
									//}
									continue;
								}
								
								// otherwise, get the parent's specified value
								var cssValue = cssCascade.getSpecifiedStyle(node1, properties[p], matchedRules);
								if(cssValue && cssValue.length) {
									
									// if we have a specified value, let's use it
									node2.style.setProperty(properties[p], cssValue.toCSSString());
									
								}
								
							}
							
						}
						
						// now, let's work on ::after and ::before
						var importPseudo = function(node1,node2,pseudo) {
							
							//
							// we'll need to use getSpecifiedStyle here as the pseudo thing is slow
							//
							var mayExist = !!cssCascade.findAllMatchingRulesWithPseudo(node1,pseudo.substr(1)).length;
							if(!mayExist) return;
							
							var pseudoStyle = getComputedStyle(node1,pseudo);
							if(pseudoStyle.content!='none'){
								
								// let's create a stylesheet for the element
								var stylesheet = document.createElement('style');
								stylesheet.setAttribute('data-no-css-polyfill',true);
								
								// compute the value of all css properties
								var node2style = "";
								var properties = cssCascade.allCSSProperties || cssCascade.getAllCSSProperties();
								for(var p=properties.length; p--; ) {
									
									// we always use the computed value, because we don't have better
									var style = pseudoStyle.getPropertyValue(properties[p]);
									node2style += properties[p]+":"+style+";";
									
								}
								
								stylesheet.textContent = (
									'[data-css-regions-fragment-of="' + node1.getAttribute('data-css-regions-fragment-source') + '"]' 
									+':not([data-css-regions-starting-fragment]):not([data-css-regions-special-starting-fragment])'
									+':'+pseudo+'{'
									+node2style
									+"}"
								);
								
								node2.parentNode.insertBefore(stylesheet, node2);
								
							}
						}
						importPseudo(node1,node2,":before");
						importPseudo(node1,node2,":after");
						
						// retarget events
						cssRegionsHelpers.retargetEvents(node1,node2);
						
						
					case 9: // Document node
					case 11: // Document fragment node
						child1 = node1.firstChild;
						child2 = node2.firstChild;
						while (child1) {
							next1 = child1.nextSibling;
							next2 = child2.nextSibling;
							
							// decide between process style or hide
							if(child1.cssRegionsLastFlowIntoName && child1.cssRegionsLastFlowIntoType==="element") {
								node2.removeChild(child2);
							} else {
								visit(child1, child2);
							}
							
							child1 = next1;
							child2 = next2;
						}
						break;
				}
			}
			
			visit(root1, root2, true);
			
		},
		
		//
		// make sure the most critical events still fire in the fragment source
		// even if the browser initially fire them on the fragments
		//
		retargetEvents: function retargetEvents(node1,node2) {
			
			var retargetEvent = "cssRegionsHelpers.retargetEvent(this,event)";
			node2.setAttribute("onclick", retargetEvent);
			node2.setAttribute("ondblclick", retargetEvent);
			node2.setAttribute("onmousedown", retargetEvent);
			node2.setAttribute("onmouseup", retargetEvent);
			node2.setAttribute("onmousein", retargetEvent);
			node2.setAttribute("onmouseout", retargetEvent);
			node2.setAttribute("onmouseenter", retargetEvent);
			node2.setAttribute("onmouseleave", retargetEvent);
			
		},
		
		//
		// single hub for event retargeting operations.
		//
		retargetEvent: function retargeEvent(node2,e) {
			
			// get the node we should fire the event on
			var node1 = (
				(node2.cssRegionsFragmentSource) ||
				(node2.cssRegionsFragmentSource=document.querySelector('[data-css-regions-fragment-source="' + node2.getAttribute('data-css-regions-fragment-of') + '"]'))
			);
			
			if(node1) {
			
				// dispatch the event on the real node
				var ne = domEvents.cloneEvent(e);
				node1.dispatchEvent(ne);
				
				// prevent the event to fire on the region
				e.stopImmediatePropagation ? e.stopImmediatePropagation() : e.stopPropagation();
				
				// make sure to cancel the event if required
				if(ne.isDefaultPrevented || ne.defaultPrevented) { e.preventDefault(); return false; }
			
			}
			
		}
	};
	
	return cssRegionsHelpers;
	
})(window, document);