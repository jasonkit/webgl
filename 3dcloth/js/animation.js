/*jslint browserify:true*/
/*global console*/
"use strict";

function Animation() {
    this.step = null;
    this.timer = null; 
    this.isStop = false;

    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                                   window.webkitRequestAnimationFrame || window.oRequestAnimationFrame; 

}

Animation.prototype.start = function ()
{
    var self = this;
    if (typeof this.step === "function") {
        window.requestAnimationFrame(function (ts) {
            self.tick(ts); 
        });
    }else{
        console.log("step function is not set");
    }
};

Animation.prototype.tick = function(ts)
{
    var self = this;
    var interval = 0;
    if (this.timer) {
        interval = ts - this.timer;
    }

    this.step(interval);
    this.timer = ts;
    
    if (!this.isStop) {
        window.requestAnimationFrame(function (ts){
            self.tick(ts);
        });
    }else{
        this.isStop = false;
        this.timer = null;
    }
};

Animation.prototype.stop = function()
{
    this.isStop = true;
};

module.exports = Animation;
