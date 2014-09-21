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

function simple_draw(webgl)
{
    var gl = webgl.glContext;

    webgl.createProgram("p", ["v","f"]);
    webgl.useProgram("p");
    webgl.assignUniform("u_resolution", "2f", [webgl.viewportWidth, webgl.viewportHeight]);
    
    var vertex_buf = gl.createBuffer();
    var index_buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buf);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buf);
   
    // bottom left is (0,0)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        100,100,
        100,200,
        200,200,
        200,100
    ]), gl.DYNAMIC_DRAW);

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
        0,1, 1,2,
        2,3, 3,0
    ]), gl.STATIC_DRAW);

    var vertex_loc = gl.getAttribLocation(webgl.curProgram, "a_vertex");
    gl.enableVertexAttribArray(vertex_loc);
    gl.vertexAttribPointer(vertex_loc, 2, gl.FLOAT, gl.FALSE, 0, 0);

    gl.clearColor(0,0,0,1);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.lineWidth(2);
    gl.drawElements(gl.LINES, 8, gl.UNSIGNED_SHORT, 0);
}

function test_gpgpu(webgl)
{
    var gl = webgl.glContext;
 
    if(!gl.getExtension("OES_texture_float")) {
        console.log("float texture not supported.");
    }

    webgl.createProgram("p1", ["gpgpu_v", "gpgpu_f1"]);
    webgl.useProgram("p1");

    // init buffer
    var buf_size = 16;
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    fb.width = buf_size;
    fb.height = buf_size;
  
    var buf_src = new Float32Array(buf_size*buf_size*4);
    for (var i=0; i<buf_size; i++) {
        for (var j=0; j<buf_size; j++) {
            buf_src[i*buf_size*4 + j*4] = j; 
            buf_src[i*buf_size*4 + j*4+1] = i; 
            buf_src[i*buf_size*4 + j*4+2] = 0; 
            buf_src[i*buf_size*4 + j*4+3] = 0; 
        }
    }

    var tex_src = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex_src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fb.width, fb.height, 0, gl.RGBA, gl.FLOAT, buf_src);

    var buf_dst = new Float32Array(buf_size*buf_size*4);
    var tex_dst = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex_dst);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fb.width, fb.height, 0, gl.RGBA, gl.FLOAT, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex_dst, 0);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // init data 
    var vtx_buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vtx_buf);
    // range of cliped space is [-1,1]
    vtx_dat = [-1, -1,  // BL
                1, -1,  // BR
                1,  1,  // TR
               -1,  1]; // TL
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vtx_dat), gl.STATIC_DRAW);
    vtx_buf.itemSize = 2;
    vtx_buf.numItems = 4;

    var tc_buf = gl.createBuffer(); 
    gl.bindBuffer(gl.ARRAY_BUFFER, tc_buf);
    // range of texture space is [0,1]
    tc_dat = [0, 0,  // BL
              1, 0,  // BR
              1, 1,  // TR
              0, 1]; // TL
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tc_dat), gl.STATIC_DRAW);
    tc_buf.itemSize = 2;
    tc_buf.numItems = 4;

    var idx_buf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx_buf);
    var idx_dat = [0,1,2,  // Triangle 1 
                   0,2,3]; // Triangle 2 
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx_dat), gl.STATIC_DRAW);
    idx_buf.itemSize = 3;
    idx_buf.numItems = 2;

    // assign vtx_buf to a_vertexPos
    gl.bindBuffer(gl.ARRAY_BUFFER, vtx_buf);
    gl.vertexAttribPointer(webgl.curProgram.attributes["a_vertexPos"], vtx_buf.itemSize, gl.FLOAT, false, 0, 0);
    
    // assign tc_buf to a_texCoord
    gl.bindBuffer(gl.ARRAY_BUFFER, tc_buf);
    gl.vertexAttribPointer(webgl.curProgram.attributes["a_texCoord"], tc_buf.itemSize, gl.FLOAT, false, 0, 0);

    // using tex_src as texture0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex_src);
    webgl.assignUniform("u_sampler", "1i", 0);
    
    webgl.assignUniform("u_size", "2f", [buf_size, buf_size]);
    
    // using idx_buf as element array buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx_buf);

    // render to fb
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    
    // assing output buffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex_dst, 0);

    gl.viewport(0, 0, buf_size, buf_size);
    
    // set output buffer to zeros
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // start computation
    gl.drawElements(gl.TRIANGLES, idx_buf.numItems*idx_buf.itemSize, gl.UNSIGNED_SHORT, 0);
    
    // read back result
    gl.readPixels(0, 0, buf_size, buf_size, gl.RGBA, gl.FLOAT, buf_dst);
    
    // revert to default output buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    show_memory(buf_dst,buf_size,buf_size,4);
}

function main()
{
    var canvas = document.getElementById("canvas");
    var webgl = new WebGL(canvas);
    var gl = webgl.glContext;

    webgl.shaderPathPrefix = "glsl/";
    webgl.loadVertexShader("v");
    webgl.loadFragmentShader("f");
    webgl.loadVertexShader("gpgpu_v");
    webgl.loadFragmentShader("gpgpu_f1");
    webgl.registerShaderReadyCallback(function() {
        simple_draw(webgl);
        test_gpgpu(webgl);
    });
}

function init()
{
    ikd.load(["http://cdnjs.cloudflare.com/ajax/libs/gl-matrix/2.1.0/gl-matrix-min.js", "../webgl.js"], main);
}

window.addEventListener("load", init);
