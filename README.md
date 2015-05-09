CSS Regions Polyfill
======================

The `css-regions` polyfill is an unprefixed JavaScript implementation of the CSS Regions specification. You can use the polyfill either to patch browsers which do not have a native regions implementation, or in all browsers. 

The advantage of the first method is that you get a faster experience on supported browsers, the disadvantage is that you have to deal with different experimental implementations.

## Using the Polyfill
You can install the polyfill simply by adding a script reference to it on your page. 

    <script src="/cssregions.min.js"></script>

Once the polyfill is installed, you can use unprefixed css-regions in any of your `<link>` or `<style>` stylesheets accessible to your domain, even the one generated via dynamic insertion of tags via JavaScript:

    .content-source {
        flow-into: content-flow contents;
    }
    
    .content-region {
    	flow-from: content-flow;
    	region-fragment: break;
    }

That's it. You're ready to go.

## Feature set

### Supported features

The polyfill supports almost all features of the latest css-regions spec. The polyfill has been tested using the W3C test suite to make sure it was actually valid in most corner cases, so that you can rely on it working properly.

	CSS:
		
		flow-into: <flow-nane>
		flow-into: <flow-name> contents
		
		flow-from: <flow-name>
		
		region-fragment: auto
		region-fragment: break
		
		break-before: region
		break-after: region
		
		auto-sized regions
		live-update on DOM changes
		styling of the fragments inherited from source
		mouse events working properly on the source
		
	JS:
		
		Element.regionOverset
		Element.getComputedRegionStyle(element)
		
		document.getNamedFlow(name)
		document.getNamedFlows()	
			
		NamedFlow.getContent()	
		NamedFlow.getRegions()	
		NamedFlow.getRegionsByContent()	
		NamedFlow.name
		NamedFlow.overset
		NamedFlow.firstEmptyRegionIndex
		
		NamedFlow.regionfragmentchange event
		NamedFlow.regionoversetchange event	

### Unsupported features

Some features are however not supported:

	CSS:
		
		Basic @region support (styling fragments based on current region)
		
	JS:
		
		NamedFlow.getRegionFlowRanges()
		
### Known issues
However, some caveats apply:

- Because the code is asynchronous, the only way to be sure you can act on a NamedFlow is to listen to its `regionfragmentchange` event. Unlike the browser which computes the layout of the page synchronously, the JavaScript implementation is asynchronous by nature and cannot perform synchronous operations.
- Another consequence of the code executing asynchronously is that screen flashing is possible in some cases, especially during the page load if correct `display:none` styling is not applied to hide the source content wrapper before the content itself is flown into a region. It's also advised to put `overflow: hidden` on regions when possible even if it shouldn't be strictly required.
- The `regionoversetchange` event is not guaranteed to fire only when the overset actually changes. Guaranteeing this would requires storing a lot of information and compare them at runtime, and I decided it would not be worth the time.
- Dynamic elements cannot be put into a flow without harming their functionnality (this incudes forms, and a lot of interactive objects). This implementation is only suitable for static or mostly static content.
- In the same vein, `hover` and `active` style do not apply to content inside a region. This limitation could possibly be lifted in some cases but I await feedback this is actually useful before proceeding.
- Because elements are actually cloned in the regions, you may receive those clones as a result of `getElementsByTagName` or `querySelectorAll` queries, as well as methods such a `elementsFromPoint`. The actual ID and class names of the objects are not preserved in the fragments to reduce the risk, but this is by no mean a complete guarantee. A solution is to check the `data-css-regions-fragment-of` attribute and recover the original source by using the `data-css-regions-fragment-source` attribute.
- Because computing nested `css-counters` manually would be very expensive in cpu horse power, I decided to leave this case as is. Most non-nested `css-counters` should work fine, however.

### Browser support
The polyfill has been tested successfully accross a large range of desktop and mobile browsers. Unsupported browsers include IE8, Opera 12.0 (Presto) and Android Browser 3.0.

For more information, please refer to the documentation at

    ./documentation/GENERAL_OVERVIEW.md
    
## Feedback
Please report any bug, pull or feature request on this repository, or contact the author by mail via `francois.remy.dev@outlook.com`. If you have comments on the specification itself, please send your mail to `www-style@w3.org` and includes `[css-regions]` in the subject of your mail.