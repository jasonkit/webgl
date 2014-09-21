function Cloth(w, h, resolution, webgl)
{
    var self = this;
    this.width = parseInt(w);
    this.height = parseInt(h);
    this.aspectRatio = w/h;

    this.m2p = 1000; // meter to pixel;

    this.param = {
        gram_per_meter2: 150.0,
        g: 9.8,
        k: {
            stretch: 10,
            shear: 50,
            bend: 50
           },
        d: 1e-2
    };

    this.grid = {width:parseInt(resolution), height:parseInt(resolution/this.aspectRatio)};
    this.webgl = webgl;
    
    var gl = webgl.glContext;

    this.initBuffers = function() {
        // prepare framebuffer for physical computation
        self.grid.textures = [];
        self.grid.curIdx = 0;
        self.grid.framebuffer = gl.createFramebuffer();
        self.grid.buf = new Float32Array(self.grid.width*self.grid.height*4);

        for (var i=0; i<2; i++) {
            self.grid.textures[i] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, self.grid.textures[i]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, self.grid.width, self.grid.height, 0, gl.RGBA, gl.FLOAT, null);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.grid.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.grid.textures[0], 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

       
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

    this.runProgram = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.vtx_buf);
        gl.vertexAttribPointer(webgl.curProgram.attributes["a_vpos"], 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.tc_buf);
        gl.vertexAttribPointer(webgl.curProgram.attributes["a_tpos"], 2, gl.FLOAT, false, 0, 0);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.grid.framebuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.grid.idx_buf);
        gl.viewport(0, 0, self.grid.width, self.grid.height);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.readPixels(0, 0, self.grid.width, self.grid.height, gl.RGBA, gl.FLOAT, self.grid.buf);

        self.grid.curIdx = self.grid.curIdx?0:1;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.grid.textures[self.grid.curIdx], 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);     
    };

    this.init = function(cb) { 
        self.initCallback = cb;
        
        if(!webgl.glContext.getExtension("OES_texture_float")) {
            console.log("float texture not supported.");
            return;
        }

        self.initBuffers();
        
        webgl.loadVertexShader("compute_v");
        webgl.loadFragmentShader("compute_f");
        webgl.loadFragmentShader("init_f");
        webgl.loadVertexShader("render_v");
        webgl.loadFragmentShader("render_f");
        webgl.registerShaderReadyCallback(function() {
            webgl.createProgram("init", ["compute_v", "init_f"]);
            webgl.createProgram("compute", ["compute_v", "compute_f"]);
            webgl.createProgram("render", ["render_v", "render_f"]);
            
            webgl.useProgram("init");
            webgl.assignUniform("u_size", "2f", [self.width, self.height]);
            webgl.assignUniform("u_offset", "2f", [(webgl.viewportWidth-self.width)/2, (webgl.viewportHeight-self.height)/4]);
            self.runProgram();
            
            self.render();
            self.initCallback(); 
        });
    };

    this.render = function () { 
        webgl.useProgram("render");

        webgl.assignUniform("u_resolution", "2f", [webgl.viewportWidth, webgl.viewportHeight]);
        webgl.assignUniform("u_color", "4f", [.7,.5,1,1]);

        gl.bindBuffer(gl.ARRAY_BUFFER, self.grid.render_vtx_buf);
        gl.bufferData(gl.ARRAY_BUFFER, self.grid.buf, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(webgl.curProgram.attributes["a_vpos"], 4, gl.FLOAT, false, 0, 0);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.grid.render_idx_buf);

        gl.viewport(0, 0, webgl.viewportWidth, webgl.viewportHeight);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawElements(gl.LINES, self.grid.render_idx_buf.nitems, gl.UNSIGNED_SHORT, 0);
    }

    this.update = function(h)
    {
        webgl.useProgram("compute");
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, self.grid.textures[self.grid.curIdx?0:1]);
        webgl.assignUniform("u_data", "1i", 0);
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
        self.runProgram();
    }
}
