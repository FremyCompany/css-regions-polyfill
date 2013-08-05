"use script";

var basicObjectModel = {
    
    EventTarget: {
        implementsIn: function(eventClass, static) {
            
            if(!static && typeof(eventClass)=="function") eventClass=eventClass.prototype;
            
            eventClass.dispatchEvent = basicObjectModel.EventTarget.prototype.dispatchEvent;
            eventClass.addEventListener = basicObjectModel.EventTarget.prototype.addEventListener;
            eventClass.removeEventListener = basicObjectModel.EventTarget.prototype.removeEventListener;
            
        },
        prototype: {}
    }
    
};

basicObjectModel.EventTarget.prototype.addEventListener = function(eventType,f) {
    if(!this.eventListeners) this.eventListeners=[];
    
    var ls = (this.eventListeners[eventType] || (this.eventListeners[eventType]=[]));
    if(ls.indexOf(f)==-1) {
        ls.push(f);
    }
    
}

basicObjectModel.EventTarget.prototype.removeEventListener = function(eventType,f) {
    if(!this.eventListeners) this.eventListeners=[];

    var ls = (this.eventListeners[eventType] || (this.eventListeners[eventType]=[])), i;
    if((i=ls.indexOf(f))==-1) {
        ls.splice(i,1);
    }
    
}

basicObjectModel.EventTarget.prototype.dispatchEvent = function(event_or_type) {
    if(!this.eventListeners) this.eventListeners=[];
    
    // abort quickly when no listener has been set up
    if(typeof(event_or_type) == "string") {
        if(!this.eventListeners[event_or_type] || this.eventListeners[event_or_type].length==0) {
            return;
        }
    } else {
        if(!this.eventListeners[event_or_type.type] || this.eventListeners[event_or_type.type].length==0) {
            return;
        }
    }
    
    // convert the event
    var event = event_or_type;
    function setUpPropertyForwarding(e,ee,key) {
        Object.defineProperty(ee,key,{
            get:function() {
                var v = e[key]; 
                if(typeof(v)=="function") {
                    return v.bind(e);
                } else {
                    return v;
                }
            },
            set:function(v) {
                e[key] = v;
            }
        });
    }
    function setUpTarget(e,v) {
        try { Object.defineProperty(e,"target",{get:function() {return v}}); }
        catch(ex) {}
        finally {
            
            if(e.target !== v) {
                
                var ee = Object.create(Object.getPrototypeOf(e));
                ee = setUpTarget(ee,v);
                for(key in e) {
                    if(key != "target") setUpPropertyForwarding(e,ee,key);
                }
                return ee;
                
            } else {
                
                return e;
                
            }
            
        }
    }
    
    // try to set the target
    if(typeof(event)=="object") {
        try { event=setUpTarget(event,this); } catch(ex) {}
        
    } else if(typeof(event)=="string") {
        event = document.createEvent("CustomEvent");
        event.initCustomEvent(event_or_type, /*canBubble:*/ true, /*cancelable:*/ false, /*detail:*/this);
        try { event=setUpTarget(event,this); } catch(ex) {}
        
    } else {
        throw new Error("dispatchEvent expect an Event object or a string containing the event type");
    }
    
    // call all listeners
    var ls = (this.eventListeners[event.type] || (this.eventListeners[event.type]=[]));
    for(var i=ls.length; i--;) {
        try { 
            ls[i](event);
        } catch(ex) {
            setImmediate(function() { throw ex; });
        }
    }
    
    return event.isDefaultPrevented;
}