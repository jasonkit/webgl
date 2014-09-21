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
        canvas.addEventListener("mousewheel", this.onMouseWheel);
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
        self.startPos.x = e.x
        self.startPos.y = e.y;
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
        var axis = [self.startPos.y-e.y, e.x-self.startPos.x,0];
        var rad = vec3.length(axis)/200.0;
        vec3.normalize(axis, axis);
        quat.setAxisAngle(q, axis, rad)

        if (typeof self.mouseMoveCallBack === "function") {
            self.mouseMoveCallBack(q);
        }
        
        e.preventDefault();
        e.stopPropagation();
    };

    this.onMouseWheel = function(e)
    {
        if (typeof self.mouseMoveCallBack === "function") {
            self.mouseWheelCallBack([0,0,e.wheelDeltaY]);
        }
        e.preventDefault();
        e.stopPropagation();
    };

}
