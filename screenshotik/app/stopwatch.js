'use strict';
class StopWatchResult {
    constructor(name, start, end){
        this.name = name;
        this.start = start;
        this.end = end;
    }
    get millis() {
        return this.end - this.start;
    }
    get seconds() {
        return (this.end - this.start)/1000;
    }
    toString() {
        return `timer[${this.name}] - ${this.millis} ms`;
    }
    toStringSeconds() {
        return `timer[${this.name}] - ${this.seconds} s`;
    }
    get [Symbol.toStringTag]() {
        return this.toString();
    }
}

class StopWatch {
    constructor(){
        this.timers = {};
    }
    start(name){
        this.timers[name] = this.now();
    }
    end(name){
        let result = new StopWatchResult(name, this.timers[name], this.now());
        this.timers[name] = result;
        return result;
    }
    now(){
        if (typeof window !== 'undefined'&&window.performance&&window.performance.now){
            return window.performance.now();
        }
        return new Date().getTime();
    }
}
module.exports = new StopWatch();