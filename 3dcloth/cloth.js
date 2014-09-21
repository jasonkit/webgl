function Cloth(w, h, resolution, webgl)
{
    var self = this;
    this.width = parseInt(w);
    this.height = parseInt(h);
    this.aspectRatio = w/h;

    this.m2p = 1000; // meter to pixel;
    this.nBuf = 2;

    this.disturbance = false;

    this.param = {
        gram_per_meter2: 150.0,
        g: 9.8,
        k: {
            stretch: 5,
            shear: 20,
            bend: 20
           },
        d: 1e-2
    };

    this.grid = {width:parseInt(resolution), height:parseInt(resolution/this.aspectRatio)};
    this.webgl = webgl;
    
    this.camera = [210, -this.height/2, -450.0];
    this.camera_q = quat.create();
    this.mat = {};

    var gl = webgl.glContext;

    this.init = function(cb) { 
        self.initCallback = cb;
        
        if(!webgl.glContext.getExtension("OES_texture_float")) {
            console.log("float texture not supported.");
            return;
        }

        self.initBuffers();
         
        webgl.loadVertexShader("compute_v");
        webgl.loadFragmentShader("compute_pos_f");
        webgl.loadFragmentShader("compute_vel_f");
        webgl.loadFragmentShader("init_f");
        webgl.loadVertexShader("render_v");
        webgl.loadFragmentShader("render_f");
        webgl.registerShaderReadyCallback(function() {
            webgl.createProgram("init_pos", ["compute_v", "init_f"]);
            webgl.createProgram("compute_pos", ["compute_v", "compute_pos_f"]);
            webgl.createProgram("compute_vel", ["compute_v", "compute_vel_f"]);
            webgl.createProgram("render", ["render_v", "render_f"]);
            
            self.initState(); 
            self.initMatrices();
            self.render();
            self.initCallback();
        });
    };

    this.initBuffers = function() {
        // prepare framebuffer for physical computation
        self.grid.textures = [];
        self.grid.curIdx = 0;
        self.grid.framebuffer = gl.createFramebuffer();
        self.grid.buf = new Float32Array(self.grid.width*self.grid.height*4);

        for (var i=0; i<self.nBuf*2; i++) {
            self.grid.textures[i] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, self.grid.textures[i]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, self.grid.width, self.grid.height, 0, gl.RGBA, gl.FLOAT, null);
        }
       
        self.grid.vtx_buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.vtx_buf);
        var vtx_dat = [-1,-1,  1,-1,  1,1,  -1,1];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vtx_dat), gl.STATIC_DRAW);

        self.grid.tc_buf = gl.createBuffer(); 
        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.tc_buf);
        var tc_dat = [0,0,  1,0,  1,1,  0,1];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tc_dat), gl.STATIC_DRAW);

        self.grid.idx_buf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.grid.idx_buf);
        var idx_dat = [0,1,2,  0,2,3];
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx_dat), gl.STATIC_DRAW);

        self.grid.render_idx_buf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.grid.render_idx_buf);
        var render_idx_dat = [];
        for (var i=0; i<self.grid.height; i++) {
            for (var j=0; j<self.grid.width; j++) {
                if (j < self.grid.width-1) {
                    render_idx_dat.push(i*self.grid.width + j);
                    render_idx_dat.push(i*self.grid.width + j+1);
                }
                if (i < self.grid.height-1) { 
                    render_idx_dat.push(i*self.grid.width + j);
                    render_idx_dat.push((i+1)*self.grid.width + j);
                }
            } 
        }
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(render_idx_dat), gl.STATIC_DRAW); 
        self.grid.render_idx_buf.nitems = render_idx_dat.length;
        
        self.grid.render_vtx_buf = gl.createBuffer();
    };

    this.initState = function() {
        webgl.useProgram("init_pos");
        webgl.assignUniform("u_size", "2f", [self.width, self.height]);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.grid.framebuffer);
        
        // init position
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.grid.textures[0], 0);
        self.runProgram();
        gl.readPixels(0, 0, self.grid.width, self.grid.height, gl.RGBA, gl.FLOAT, self.grid.buf);

        // init velocity (set zero)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.grid.textures[1], 0);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    this.initMatrices = function ()
    { 
        self.mat.model = mat4.create();
        self.mat.view = mat4.create();
        self.mat.projection = mat4.create();
        self.mat.mvp = mat4.create();

        mat4.translate(self.mat.model, self.mat.model, [-self.width/2, -self.height,0]);
        
        // In Camera Frame is L.H.S (looking at -ve Z direction)
        // However all those coorindate given to lookAt is measure in World Coordinate frame which is R.H.S

        mat4.perspective(self.mat.projection, 0.25*Math.PI, webgl.viewportWidth/webgl.viewportHeight, 0, -1500);
        
        self.updateMVP();
    }

    this.updateCameraRotation = function(q) {
        self.camera_q = q;
        self.updateMVP();
    }
    
    this.updateCamera = function() {
        vec3.transformQuat(self.camera, self.camera, self.camera_q);
        quat.identity(self.camera_q);
        self.updateMVP();
    }

    this.translateCamera = function(v) {
        vec3.add(self.camera, self.camera, v);
        self.updateMVP();
    }

    this.updateMVP = function()
    {
        var eye = vec3.create();
        vec3.transformQuat(eye, self.camera, self.camera_q);

        mat4.lookAt(self.mat.view, eye, [0,-self.height/2,0], [0,-1,0]);
        mat4.mul(self.mat.mvp, self.mat.view, self.mat.model);  
        mat4.mul(self.mat.mvp, self.mat.projection, self.mat.mvp);
        return self.mat.mvp;
    }

    this.update = function(h)
    {
        if (h > 0.004) {
            h = 0.004;
        }
        var next_buf_idx = (this.grid.curIdx+1)%this.nBuf;
        // update velocity
        webgl.useProgram("compute_vel");
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, self.grid.textures[self.grid.curIdx*2]);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, self.grid.textures[self.grid.curIdx*2+1]);

        webgl.assignUniform("u_pos_map", "1i", 0);
        webgl.assignUniform("u_vel_map", "1i", 1);
        webgl.assignUniform("u_size", "2i", [self.grid.width, self.grid.height]);
        webgl.assignUniform("u_L", "2f", [self.width/self.grid.width, 
                                          self.height/self.grid.height]);
        webgl.assignUniform("u_param", "3f",[
            self.param.gram_per_meter2*self.width*self.height/(self.m2p*self.m2p*1000.0),
            self.param.g,
            self.param.d,
        ]);
        
        webgl.assignUniform("u_k", "3f",[self.param.k.stretch, self.param.k.shear, self.param.k.bend]);
        webgl.assignUniform("u_h", "1f", h);
       
        if (self.disturbance) {
            webgl.assignUniform("u_disturbance", "1f", 1000.0);
            self.disturbance = false;
        }else{
            webgl.assignUniform("u_disturbance", "1f", 0.0);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, self.grid.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.grid.textures[next_buf_idx*2+1], 0); 
        self.runProgram();
        
        // update position
        webgl.useProgram("compute_pos");
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, self.grid.textures[self.grid.curIdx*2]);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, self.grid.textures[next_buf_idx*2+1]);

        webgl.assignUniform("u_pos_map", "1i", 0);
        webgl.assignUniform("u_vel_map", "1i", 1);
        webgl.assignUniform("u_size", "2i", [self.grid.width, self.grid.height]);
        webgl.assignUniform("u_h", "1f", h);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.grid.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.grid.textures[next_buf_idx*2], 0); 
        self.runProgram();
        
        gl.readPixels(0, 0, self.grid.width, self.grid.height, gl.RGBA, gl.FLOAT, self.grid.buf);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        this.grid.curIdx = next_buf_idx;
    }

    this.runProgram = function() {
        
        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.vtx_buf);
        gl.vertexAttribPointer(webgl.curProgram.attributes["a_vpos"], 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.tc_buf);
        gl.vertexAttribPointer(webgl.curProgram.attributes["a_tpos"], 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.grid.idx_buf);
        gl.viewport(0, 0, self.grid.width, self.grid.height);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        
    };

    this.render = function () { 
        webgl.useProgram("render");

        webgl.assignUniform("u_MVP", "Matrix4f", self.mat.mvp);
        webgl.assignUniform("u_color", "4f", [.7,.5,1,1]);

        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.render_vtx_buf);
        gl.bufferData(gl.ARRAY_BUFFER, self.grid.buf, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(webgl.curProgram.attributes["a_vpos"], 4, gl.FLOAT, false, 0, 0);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.grid.render_idx_buf);

        gl.viewport(0, 0, webgl.viewportWidth, webgl.viewportHeight);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawElements(gl.LINES, self.grid.render_idx_buf.nitems, gl.UNSIGNED_SHORT, 0);
    };

    this.triggerDisturbance = function()
    {
        self.disturbance = true;
    };

}
