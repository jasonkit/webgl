/*jslint browserify:true*/
var mat4 = require("gl-matrix").mat4;
var vec3 = require("gl-matrix").vec3;
var quat = require("gl-matrix").quat;

function SceneControl(canvas)
{
    var self = this;
    this.canvas = canvas;
    this.isMouseDown = false;
    this.startPos = {};
    this.moved = false;

    this.mouseMoveCallBack = null;
    this.mouseUpCallBack = null;
    this.mouseWheelCallBack = null;
    this.clickCallBack = null;

    this.init = function(mmcb, mucb, mwcb, ccb) {
        canvas.addEventListener("mousedown", this.onMouseDown);
        canvas.addEventListener("wheel", this.onMouseWheel);
        window.addEventListener("mouseup", this.onMouseUp);
        window.addEventListener("mousemove", this.onMouseMove);
        self.mouseMoveCallBack = mmcb;
        self.mouseUpCallBack = mucb;
        self.mouseWheelCallBack = mwcb;
        self.clickCallBack = ccb;
    };

    this.onMouseDown = function(e)
    {
        self.isMouseDown = true; 
        self.startPos.x = e.clientX;
        self.startPos.y = e.clientY;
        self.moved = false;
    };
    
    this.onMouseUp = function(e)
    {
        if (self.isMouseDown) {
            self.isMouseDown = false; 
            
            if (typeof self.mouseMoveCallBack === "function") {
                self.mouseUpCallBack();
            }

            if (!self.moved) {
                self.clickCallBack();
            }
        }    
    };

    this.onMouseMove = function(e)
    {
        if (!self.isMouseDown) return;
        
        self.moved = true;
        
        var q = quat.create();
        var axis = [self.startPos.y-e.clientY, e.clientX-self.startPos.x,0];
        var rad = vec3.length(axis)/200.0;
        vec3.normalize(axis, axis);
        quat.setAxisAngle(q, axis, rad);

        if (typeof self.mouseMoveCallBack === "function") {
            self.mouseMoveCallBack(q);
        }
        
        e.preventDefault();
        e.stopPropagation();
    };

    this.onMouseWheel = function(e)
    {
        if (typeof self.mouseMoveCallBack === "function") {
            self.mouseWheelCallBack(vec3.fromValues(0,0,e.deltaY));
        }
        e.preventDefault();
        e.stopPropagation();
    };

}

module.exports = SceneControl;
