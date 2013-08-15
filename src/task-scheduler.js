"use strict";

(function() {

    // 
    // polyfill performance.now()
    //
    if(window.performance && window.performance.now) {
        var now = function() { return performance.now(); }
    } else if(Date.now) {
        var now = function() { return Date.now(); }
    } else {
        var now = function() { return Date().getTime(); }
    }
    
    //
    // polyfill setImmediate
    //
    var setImmediate = window.setImmediate || function(f) {
        setTimeout(f,0);
    }
    
    //
    // polyfill rAF
    //
    var requestAnimationFrame = window.requestAnimationFrame || function(f) {
        setTimeout(f,16);
    }
    
    // 
    // Encapsulate a task
    // 
    function Task(action) {
        this.call = action;
    }
    
    // 
    // Encapsulate task priority logic
    // 
    function TaskScheduler(parent) {
        
        this.isRunning = false;
        this.isScheduledNow = false;
        
        this.taskQueue = [];
        this.delayedTasks = 0;
        this.childSchedulers = [];
        this.parentScheduler = parent;
        if(parent) { parent.childSchedulers.push(this); }
        
        var This = this;
        This.tryRun = function() {
            if(This.parentScheduler) {
                This.parentScheduler.tryRun();
            } else {
                This.run();
            }
        }
        This.run = function() {
            
            This.isRunning = true;
            
            // calling code should not face scheduler errors
            try {
                
                // 
                // walk through all tasks
                // 
                if(This.taskQueue.length !== 0) {
                    
                    var task; while(task=This.taskQueue.shift()) {
                        
                        // run the task
                        // (the loop should not break if a task fails)
                        try { task.call(); } 
                        catch(ex) { setImmediate(function() { throw ex; }) }
                        
                    }
                    
                }
                
                // 
                // let child schedulers execute if no task is pending
                // 
                if(This.delayedTasks === 0) {
                    
                    for(var i=0; i<This.childSchedulers.length; i++) {
                        
                        // run the scheduler
                        // (the loop should not break if a scheduler fails)
                        try { This.childSchedulers[i].run(); } 
                        catch(ex) { setImmediate(function() { throw ex; }) }
                        
                    }
                    
                }
                
                //
                // execute new immediates, if any
                //
                if(This.taskQueue.length !== 0) {
                    
                    This.run();
                    
                }
                
                
            } catch(ex) { setImmediate(function() { throw ex; }) }
            
            This.isRunning = false;
            
        }
        
    }
    
    TaskScheduler.prototype.pushTask = function(f) {
        
        // push the task
        this.taskQueue.push(f);
        
        // ensure the scheduler will run soon
        this.scheduleNow();
        
    };
    
    TaskScheduler.prototype.pushDelayedTask = function(f, scheduler) {
        
        // ask for a delayed execution
        var This = this;
        var result = scheduler(function() {
            
            // push the task
            This.pushTask(f);
            This.delayedTasks--;
            
            // empty the queue
            This.tryRun();
            
        });
        
        // record the future task
        this.delayedTasks++;
        
        // return scheduler-relative info
        return result;
        
    }
    
    // aliases for common web functions
    TaskScheduler.prototype.setImmediate = TaskScheduler.prototype.pushTask;
    TaskScheduler.prototype.setTimeout = function(f,d) {
        this.pushDelayedTask(f, function(f) { setTimeout(f,d) })
    }
    TaskScheduler.prototype.requestAnimationFrame = function(f,d) {
        this.pushDelayedTask(f, requestAnimationFrame);
    }
    
    TaskScheduler.prototype.scheduleNow = function() {
        
        // avoid creating multiple running 
        // version of the scheduler
        if(this.isRunning) return;
        if(this.isScheduledNow) return;
        
        // schedule a new run
        setImmediate(this.tryRun);
        
    }
    
    window.JSTaskScheduler = TaskScheduler;
    
}());