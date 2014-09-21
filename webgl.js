function WebGL(canvas)
{
    // member
    this.glContext = null;
    this.shaders = {};
    this.programs = {};
    this.numShaderToLoad = 0;
    this.onAllShadersReady = null;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.curProgram = null;
    this.shaderPathPrefix = "";

    // constructor
    try {
        this.glContext = canvas.getContext("experimental-webgl");
        this.viewportWidth = canvas.width;
        this.viewportHeight = canvas.height;
    } catch (e)
    {
        console.log(e);
    }

    if (!this.glContext) {
        console.log("Fail in obtaining WebGL interface");
    }

    this.glContext.viewport(0, 0, this.viewportWidth, this.viewportHeight);

    this.findVaribalesInShader = function (code) {
        var lines = code.split(";");
        var pattern = " +(highp|mediump|lowp)? ?(int|float|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler1D|sampler2D|sampler3D|samplerCube)+ +([A-Za-z0-9_]+)";
        var regexp_a = new RegExp("^attribute"+pattern);
        var regexp_u = new RegExp("^uniform"+pattern);

        var variables = [[],[]];

        for (var i=0; i<lines.length; i++) {
            var match = regexp_a.exec(lines[i].trim());
            if (match) {
                variables[0].push(match[3]);
            }
            
            match = regexp_u.exec(lines[i].trim());
            if (match) {
                variables[1].push(match[3]);
            }
        }
        return variables;
    };

    // method
    this.loadShader = function (id, type)
    {
        var gl = this;
        var _onload = function(data) {
            var shader = null;

            switch (type) {
                case "vertex":
                    shader = gl.glContext.createShader(gl.glContext.VERTEX_SHADER);
                break;
                
                case "fragment":
                    shader = gl.glContext.createShader(gl.glContext.FRAGMENT_SHADER);
                break;
            }

            gl.glContext.shaderSource(shader, data);
            gl.glContext.compileShader(shader);

            if (!gl.glContext.getShaderParameter(shader, gl.glContext.COMPILE_STATUS)) {
                console.log(gl.glContext.getShaderInfoLog(shader));
                return null;
            }

            var variables = gl.findVaribalesInShader(data);
            shader.attributes = variables[0];
            shader.uniforms = variables[1];
            gl.shaders[id] = shader;
            gl.numShaderToLoad--;

            if (gl.numShaderToLoad == 0) {
                if (typeof gl.onAllShadersReady === "function") {
                    gl.onAllShadersReady();
                    gl.onAllShadersReady = null;
                }
            }
        }
        
        gl.shaders[id] = null;
        gl.numShaderToLoad++;
        ikd.get(this.shaderPathPrefix + id + ".glsl", _onload, function(){console.log("Failed to load: " + id)});
    };

    this.loadFragmentShader = function (url) {
        this.loadShader(url, "fragment");
    };

    this.loadVertexShader = function (url) {
        this.loadShader(url, "vertex");
    };

    this.registerShaderReadyCallback = function (cb) {
        this.onAllShadersReady = cb;
        if(this.numShaderToLoad == 0 && typeof this.onAllShadersReady === "function") {
            this.onAllShadersReady();
            gl.onAllShadersReady = null;
        }
    };

    this.createProgram = function (id, shader_list)
    {
        var program = this.glContext.createProgram();
       
        if (!(shader_list instanceof Array)) {
            shader_list = [shader_list];
        }
        
        for (var i = 0; i<shader_list.length; ++i) {
             if (this.shaders[shader_list[i]] != undefined) {
                this.glContext.attachShader(program, this.shaders[shader_list[i]]); 
             }else{
                console.log("shader: "+shader_list[i]+" is not exists.");
                return false;
             }
        }

        this.glContext.linkProgram(program);

        if (!this.glContext.getProgramParameter(program, this.glContext.LINK_STATUS)) {
            console.log("Link porgram failed.");
            return false;
        }

        program.shaders = shader_list;

        this.programs[id] = program;
    };

    this.useProgram = function (id) {
        this.glContext.useProgram(this.programs[id]);
        this.curProgram = this.programs[id];

        this.programs[id].attributes = {};
        this.programs[id].uniforms = {};

        var shader_list = this.programs[id].shaders;
        for (var i = 0; i<shader_list.length; ++i) {
            for (var j=0; j<this.shaders[shader_list[i]].attributes.length; ++j) {
                var loc = this.glContext.getAttribLocation(this.curProgram, this.shaders[shader_list[i]].attributes[j]);
                this.programs[id].attributes[this.shaders[shader_list[i]].attributes[j]] = loc;
                this.glContext.enableVertexAttribArray(loc);
            }
            
            for (var j=0; j<this.shaders[shader_list[i]].uniforms.length; ++j) {
                var loc = this.glContext.getUniformLocation(this.curProgram, this.shaders[shader_list[i]].uniforms[j]);
                this.programs[id].uniforms[this.shaders[shader_list[i]].uniforms[j]] = loc;
            }
        }

    };

    this.assignUniform = function(uniform, type, value) {
        if (!/Matrix[2-4]|[1-4][if]/.exec(type)) {
            console.log("invalid uniform type:"+type);
            return false;
        }
         
        if (type.length > 2) {
            // matrix
            if (!(value instanceof Float32Array)) {
                value = new Float32Array(value);
            }
        }else{
            if (type[0] != "1" && type[1] == "f") { 
                if (!(value instanceof Float32Array)) {
                    value = new Float32Array(value);
                }
            }else if (type[0] != "1"){
                if (!(value instanceof Int32Array)) {
                    value = new Int32Array(value);
                }
            }
        }
       
        var method = "uniform"+type+(type[0]=="1"?"":"v");
        if (type.substring(0,6) == "Matrix") {
            this.glContext[method](this.curProgram.uniforms[uniform], false, value);
        }else{
            this.glContext[method](this.curProgram.uniforms[uniform], value);
        }
    };
}

