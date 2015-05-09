**How to read this document:** This document tries to cover the possible use cases of a polyfill in its broad meaning acceptance (aka from the *prototype reference implementation{r}* that aims at find bugs in a spec to the true *polyfill{f}* that eases differences between native implementations, via the *prollyfill{t}* that basically tries to shape the future of a spec by implementing it early and letting authors play with it and see how well it actually helps solving the author use-cases)

-------- 
 
# Summary
A web platform extension can serve multiple goals, but in particular they generally cover one of those two use cases:

- **As an experiment or proof of concept** that help creating demos, writing a spec, writing tests and many of the other things listed in the spec editor/UA manager/test roles. `{r}`

  - Their scope can be limited to a part of the API.
  
  - There can be limitations to their performance or practibility.
  
  - They may rely on plugins or non-standards stuff.

- **As a mature implementation** that enables to use a feature accross a broad range of engines powering the web platform and aims to be used in production. `{f,t}`

  - This does not necessarily require implementing a standard API. If you can make the platform the same everywhere, it's a win e.g. jQuery. 
  
  - These days we prefer to call these 'frameworks' and reserve polyfilling to describe 'time patching': getting tomorrow's web platform today. Frameworks are meant to last, polyfills are hoped to be temporary.
  
  - Polyfills refer to features that can rely on native implementation in some browsers because they're mostly interoperable while prollyfills refer to features not being stable enough to rely on any browser implementation and working in pure javascript only.

 

-------- 

**More specifically, they cover those use cases:**

# As a Web Developer:

- I want to use the latest css features as early as possible `{t,f}`

- I want to be in control of the features I'm using and not have to update my website each time the specification or an implementation gets updated, even if the browser implementations are unstable `{t}`

- I want to provide a consistent experience across a broad range of user agents, including older ones `{t,f}`

- I want to know how reliable are the features I'm working with, and testsuites are important to that matter `{t,f}`

- I want to be sure my website never gets slow because of the external librairies I'm using `{f}`

- I want to be able to add new features to the web platform I deem useful for my web applications in a plug-and-play fashion `{t}`

- I want the effort I put in shipping extensions for my app to somehow contribute to the web platform `{r,t}`



# As a Specification Editor:

- I want to be able to freely prototype new ideas and proposals to see how practical they are before writing an actual specification `{r}`

- I want to be able to prototype my specification and dogfood in order to detect issues before browser vendors starts an actual implementation `{r,t}`

- I want to be able to get feedback from the prototype implementation in order to kickstart the standardization process `{r,t}`

- I want to be able to generate excitement from demos of the prototype, even if they do not cover all the features included in the spec or rely on plugins or experimental features unavailable to the masses `{r,t}`




# As a UA Program Manager:

- I want to be able to evaluate how long a project may take to implement based on the time the polyfill did require and its level of completeness `{r,t}`

- I want to identify the potential pain points of the implementations understanding the limitations of the polyfill `{r,t}`

- I want to undestand how the specification covers the use-cases by looking at a prototype being used in real conditions `{r,t}`




# As a Test Coordinator:

- I want to be able to import the test suites developed for the polyfill to test the actual implementations `{r,t}`

- I want to be able to test the testsuite on the polyfill to identify bugs in the tests early and get them fixed `{r,t}`

- I want to be able to run my tests on prefixed or beta version of implementation by mapping the current syntax to older drafts of prefixed versions of the syntax to detect inconsistencies between implementations earlier `{f}`

 
 
-------- 


    
**How would I describe the css-regions polyfill:** My current take on the [css-regions] polyfill is that it maps to the `{t}` category (prollyfills) in the sense that:

- the spec isn't finalized yet and still competes with other proposals at this time

- the implementation do not rely on beta native implementations to provide consistent results accross browsers

- the implementation is aimed to be stable enough to enable its use on a broad range of websites, not just as a prototype for demos and spec-proofing