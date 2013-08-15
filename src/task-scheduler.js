"use strict";

(function() {

    // 
    // polyfill performance.now()
    //
    if(window.performance && window.performance.now) {
        var now = function() { return performance.now(); 
    } else if(Date.now) {
        var now = function() { return Date.now(); }
    } else {
        var now = function() { return Date().getTime(); }
    }
    
    // 
    // Encapsulate a task
    // 
    function Task(action, timeout) {
        
        this.timeout = timeout;
        this.expectedStartTime = (timeout ? now()+timeout : 0);
        this.action = action;
        
    }
    
    // 
    // Encapsulate task priority logic
    // 
    function TaskScheduler() {
        
        this.taskQueue = [];
        this.childSchedulers = [];
        
    }
    
}());