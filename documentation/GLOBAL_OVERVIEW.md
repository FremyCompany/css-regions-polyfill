The CSS Region Polyfill
========================

	A single-script drop-in for awesomely 
	interoperable css-regions support 
	in most browsers.
	
	Just use unprefixed properties and drop the
	script on your page and watch the results!


## Scope and features

- Unprefixed flow-from / flow-to / region-fragment
- Unprefixed break-before(region) / break-after(region)

----

- Supports same-domain stylesheets and inline stylesheets (live detection)
	
- Live update when the css matching state of rules is changed
	
- Live (non-nested) media queries if matchMedia().addListener is supported
	- you can use a polyfill for IE9, it will work

----

- Best-in-class support for css-break-3
	- some limitations about replaced elements and border radiuses
	- but on average, it's still better than most browsers

----

- Styling of fragments really inherit the styling of the element
	- full support of all css selectors including DOM-related one like :last-of-type
	
- Content pseudo-elements (::after/::before) styling and non-nested counters
	- at least for most practical cases

----

- Supports breaking `<OL>` lists across fragments while keeping numbering

- Original elements stays in the DOM, can be restored when the region styling is retracted

- Mouse events fire correctly on the original elements

- Optimized code requiring only up to 2 layout passes per region box

----

**Known issues:**
	
- No region-specific styling (could be done, just being lazy here)
- No nested counters (would require computing all counters manually, could be slow)
- No Hover/Active pseudo-classes (basic cases could be supported via events)
- No dynamic elements like `<INPUT>`, `<FORM>` or `<DETAIL>` (unfixable)

	
## Supported browsers
 Browsers:
	
	- Tier 1:
		
		- IE (10+)
		- FireFox (recent)
		- Safari (recent)
		- Chrome (recent)
		- Opera (13+)
		
		- IE Mobile (10+)
		- Safari Mobile (iOS 6+)
		- Android Browser (4.0+)
		- Chrome Mobile (recent)
		- FireFox for Android (recent)
		
	- Tier 2:
		
		- IE and IE Mobile (9)
			
			may require additionnal polyfills for media queries
			latest version not tested on IE9, not sure everything works
			
			planning to fix any issue being reported
			but I don't promise investigating myself
			
		- Android Browser (3.0-)
		
			while most tests seem to be working, some issues do
			pop up from time to time. 
			
			planning to fix any issue being reported
			but I don't promise investigating myself		
	- Not supported:
		
		- Opera (12-)
			
			sometimes enters into IE code, but fails to comply with IE behavior
			
			seems to have a few bugs in Range functions
			granted webkit/blink had some bug there too but opera 12 is EOL
			
			planning to accept any pull request fixing bugs on opera
			
		- IE (8-)
			
			lacks too may features
			
			planning not to accept pull request for IE8
 
  
## Introduction to Parallia
Be excited! This [css-regions] polyfill is the first ever complete CSS property polyfill, in the sense that it interacts fully with your CSS stylesheets and replace almost transparently the browser for the following operations:

- live detection of new elements matching a css rule
- css value cascading and inheritance
- automatic layout updates

The brand-new framework behind this magic, called Parallia, is stored in a couple of files:

- `css-syntax.js` which is based on Tab Atkins's CSS parser
- `css-selector.js` which handle the live-update of rule matching
- `css-cascade.js` which handle the computation of the priority of a selector as well as the specified value of a property on an element

**From the CSS-Regions point of view, those files are not very relevant.** So, even if they are very interesting from the polyfilling point of view {and may be reused for different projects}, I recommend in a first time to skip them and consider them as an implementation of:

  	//
  	// ask the underlaying framework to monitor
  	// the rules affecting the mentioned properties
  	// and ping us back when a change is detected
  	//
	cssCascade.startMonitoringProperties(
		["flow-from","flow-into","region-fragment"],
		{
			//
			// this function is called when the value of
			// one of the previous property potentially
			// changed, up to us to figure that out
			//
			onupdate: function(element, rule) {
				//
				// refresh the affected region layouts
				//
			}
		}
	);

----
 
 
## CSS Regions polyfill
### Code review
The region-specific code is quite massive, and not complete already. Because I didn't want to break-even the 1000 LoC limit in a single file, I refactored that content into multiple files.

I advise you to start with `css-region.js`, which contains the basic code necessary to reflow regions, and install the polyfill. The process itself can be tricky to understand, because it involves a lot of things, but I tried to make it as straightforward as possible by including lots of comments.

This entry file depends on `css-regions-objectmodel.js` to expose its capabilities to the outside world, notably by supporting the necessary NamedFlow class, and a few methods. I didn't try to make the js classes hard to distinguish with native ones: for now it's a simple javascript implementation that should pass functional purposes, that's all.

Since I use a lot of tricky functions walking into the DOM to perform mutations and tracking, I refactored thse into a `css-regions-helpers.js` file. Understanding those functions may not be necessary to understand the big picture of the program, but I agree with you they should probably get more detailled comments anyway. They're easier to understand top-down in the context of their calling site than as a standalone functions, I think.

Finally, as the polyfill relies a lot on DOM Ranges, I created a few extensions to make them simpler to use for text flows with functions like "moveOneCharLeft" or "moveOneCharRight". Those extensions can be found in the `range-extension.js` file.

### Claimed compilance
Technically, the implementation already supports breaking into ordered lists (`<ol>` elements) and should work fine with counters in most practical use cases.

It also works fine when splitting elements featuring padding, borders and margins in any direction.

Additionnaly, the breaking algorithm depends on the css-break spec implementation, which covers complex things like positioned elements, text lines conservation (do not break inside a text line), and much more.

----
 
 
# CSS Fragmentation
The region-specific code also depends on the css-break specification which defines where a flow can be broken, and where it cannot. I implemented the spec in quite a lot of details, and you can find this implementation in the `css-break.js` file.

This file is probably best understood when read from the bottom (isPossibleBreakPoint) to the top (isReplaced) because right now the function are in bottom-up dependency order.

**KNOWN-ISSUES:** Some objects are considered unbreakable in JS because there's no way to break them in HTML/CSS, even if some implementation like Chrome still manage to break them by splitting their rendering like an image. 

Since the implementation relies on cloning and breaking elements into fragments, most scripting-related action will not work properly on those elements. Some basic scenarii have been fixed by clever scripting, however.

----

 
# Testing the implementation
Have a look at the `region-test-X.html` files in the `tests` folder of the project. Their complexity gradually increases, but they may cover different part of the code each.

<pre><a href="https://github.com/FremyCompany/css-regions-reflow/">https://github.com/FremyCompany/css-regions-reflow/</a>
{please note I don't recommend to rely on raw-github}</pre>

Some of the tests allow you to dynamically modify the DOM by inserting content (left click) or new regions (right click). 

The last region usually has "region-fragment: break" set to it, which means it won't overflow if you exceed it. However, as soon as you add a new region, this region will hold the remaining fragments (and will overflow since I didn't set "region-overflow" on the extra regions).

You can also look at the `w3tests` folder which contain some of the w3c tests for css regions, to which I added the polyfill. To the notable exception of the selection tests, which actually test things not being explicitely defined in any spec, you should find most of them passing. I may add an implementation report as a readme on the folder at some point.

<pre>Works in IE9+, FireFox, Safari and Chrome</pre>