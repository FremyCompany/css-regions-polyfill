Transition to the new CSS Regions Polyfill
===========================================
If you are an user of the older Adobe's CSS Regions polyfill and want to transition to this new polyfill, this guide should help you understand what's needed and how to transition.

## Including the polyfill on your page
Like the previous polyfill, you need to include the polyfill using the `cssregions.min.js` file in a script tag. 

It's recommended to include the polyfill either in the HEAD section of your page (in which case the first region layout is done on DOMContentReady), or in the BODY just after the portion of content that uses regions on your page (in which case the layout is technically done immediately, or at least as soon as possible).

To improve page responsiveness, we recommend using the `async` attribute on the script like, like here:

	<script async src="/lib/cssregions.min.js"></script>

Please note that the decision to include the polyfill or not has to be taken by you in function of your needs. If the native, prefixed implementation of CSS Regions is sufficient for your needs, you may want to refrain from loading the polyfill. In that case, do not forget to include the prefixed properties in your CSS stylesheets.

## What is new in version 2.0?
Version 2.0 removes most of the JavaScript hooks used in version 1.0 and relies instead on the native browser API to provide a great experience. 

### Using CSS Regions on your page

#### Creating and consuming named flows
By default, the polyfill use an unprefixed version of the property:

    SELECTOR-REGIONS {
    	flow-from: articles;
    }
    
    SELECTOR-CONTENT {
    	flow-into: articles;
    }
    
and does not recognize anymore the -adobe- prefixed version of those properties.
    
#### Region breaking
The new polyfill also supports the new fragmentation properties:

	break-before: region;
	break-after: region;

even if only simple cases will work as expected for performance reasons.

#### Region breaking
You can also control the overflow of the last region using

	region-fragment: break;

#### Same-origin restriction

Like in version 1.0, the same-origin restriction continue to apply, however, to the stylesheets where you can use region-enabled code.

#### Fragments styling
To the contrary of the previous polyfill, fragments really inherit their style from their source element, which enable more compatibility with native implementations.

This means, however, that a script is computing the styles instead of the browser, which restricts the use of dynamic pseudo-classes like `:hover `or `:active`. To use those pseudo-classes, you may need to hack the code a bit using a DOM Inspector and creating rules that apply to the fragments directly.

In the future, we may add support for `:hover` styling but this is not guaranteed right now.

## How do you trigger a manual layout update?
The older polyfill didn't relayout the page by default when the page was changing, and required calls to functions like `CSSRegions.doLayout()` to properly recover from updates. 

**Most of the times, this is not necessary using the new polyfill and can safely be removed.**

However, if you face a situation where the auto-updater doesn't do its job, you can trigger a manual update on a per-flow basis using the following code:

    if(document.getNamedFlow) {
    	var namedFlow = document.getNamedFlow('articles');
    	if(namedFlow && namedFlow.relayout) namedFlow.relayout();
    }

Pay attention that this code will not run on a native implementation of CSS Regions, but a native implementation of region won't need that anyway.

In the case you only want to run a new layout if the size of the regions has been updated, please use the `relayoutIfSizeChanged` function instead.

## How do you execute code after a region layout?

Any region update function will not run synchronously, either. In the previous version, running "doLayout" did give you the guarantee the layout would be (kinda) up-to-date after the function return, and this is not the case here.

If you want to wait for the layout to be complete before doing some other work, and use the regionfragmentchange event to get a call back when the layout is complete.

It is, however, not recommended, to rely on region layout to perform other operations in a chain, as this can be very ineffective (which can become visible to the end-user, especially on lower-end devices).

## How do you use the CSS Regions API and events?
This new polyfill uses the new events and function names described in the CSS Regions spec as of August 2013. This is different from the CSS Regions implementation currently shipping in iOS 7 and Chrome Canary. However, the main differences reside in the naming of the events, it should be easy to cover the use cases by registering to the legacy event and the new events at the same time (only one can fire at a time).

## How better or worse is the performance?
The new polyfill is faster (to much faster, depending on the use cases) than the previous polyfill for nearly all benchmarks. If the previous polyfill was not a performance issue for you, the new one should not be either.

However, since the new polyfill works on a whole new range of device, you may want to test the performance on mobile devices as well, or make sure not to use regions for those mobile devices by isolating their use into min-sized media queries.


