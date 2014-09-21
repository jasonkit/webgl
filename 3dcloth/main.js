function show_memory(buf, w, h, size) {
    var table = document.createElement("table");
    for (var i=0; i<h; i++) {
        var tr = document.createElement("tr");
        for (var j=0; j<w; j++) {
            var td = document.createElement("td");
            var cell = "";
            for (var k=0; k<size; k++) {
                if (k>0) {
                    cell += " / ";
                }
                cell += buf[i*w*size + j*size +k];
            }
            td.textContent = cell;
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    table.setAttribute("border",1);
    table.style.border = "1px";
    table.style.fontSize = "10pt";
    document.getElementsByTagName("body")[0].appendChild(table);
}

var dbgbuf = null;

function Animation() {
    this.step = null;
    this.timer = null; 
    this.isStop = false;
    
    var self = this;

    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                                   window.webkitRequestAnimationFrame || window.oRequestAnimationFrame; 

    this.start = function()
    {
        if (typeof self.step === "function") {
            window.requestAnimationFrame(self.tick);
        }else{
            console.log("step function is not set");
        }
    };

    this.tick = function(ts)
    {
        var interval = 0;
        if (self.timer) {
            interval = ts - self.timer;
        }

        self.step(interval);
        self.timer = ts;
        
        if (!self.isStop) {
            window.requestAnimationFrame(self.tick);
        }else{
            self.isStop = false;
            self.timer = null;
        }
    }

    this.stop = function()
    {
        self.isStop = true;
    }
}

function main()
{
    var canvas = document.getElementById("canvas");

    var webgl = new WebGL(canvas);
    webgl.shaderPathPrefix = "glsl/";

    var cloth = new Cloth(300,200,100,webgl);
    
    var animation = new Animation();
    animation.step = function(interval) {
        var niter = 20;
        for (var i=0; i<niter; i++){
            cloth.update(interval/(niter*1000.0));
        }
        cloth.render(); 
        document.getElementById("fps").textContent = "FPS:" + Math.round(1000.0/interval);
    }

    var scenectrl = new SceneControl(canvas);
    
    cloth.init(function(){
        console.log("init done");
        scenectrl.init(cloth.updateCameraRotation, cloth.updateCamera, cloth.translateCamera, cloth.triggerDisturbance);
        dbgbuf=cloth.grid.buf;
        /*
        for(var i=0; i<1000; i++) {
         cloth.update(1e-3);
        }
        cloth.render();
        show_memory(cloth.grid.buf, cloth.grid.width, cloth.grid.height, 4);
        */


        animation.start();
    });
}

function init()
{
    ikd.load(["http://cdnjs.cloudflare.com/ajax/libs/gl-matrix/2.1.0/gl-matrix-min.js",
              "../webgl.js", "cloth.js", "scene_ctrl.js"], main);
}

window.addEventListener("load", init);
