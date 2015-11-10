/*jslint browserify:true*/
/*global console*/
"use strict";
var fs = require("fs");
var createBuffer = require("gl-buffer");
var createTexture2D = require("gl-texture2d");
var createShader = require("gl-shader");
var mat4 = require("gl-matrix").mat4;
var mat3 = require("gl-matrix").mat3;
var vec3 = require("gl-matrix").vec3;
var quat = require("gl-matrix").quat;

function Cloth(w, h, resolution, viewport, gl) {
  this.width = parseInt(w, 10);
  this.height = parseInt(h, 10);
  this.aspectRatio = w / h;

  this.pixelPerMeter = 1000;
  this.nBuf = 2;

  this.grid = {
    width: parseInt(resolution, 10),
    height: parseInt(resolution / this.aspectRatio, 10),
    textures: [],
    curIdx: 0,
    computeBuffer: {
      vertices: null,
      texCoords: null,
      indices: null,
      textures: [],
      frameBufferObject: null,
      frameBuffer: null
    },
    renderBuffer: {
      vertices: null,
      normals: null,
      indices: null,
      texCoords: null,
      textures: [],
      normalBuffer: null,
      normalTexture: null
    },
  };

  var s1 = 1.0 / (this.grid.width * this.grid.height);
  var s2 = (resolution / 100.0);
  s2 = s1 * s2 * s2;

  this.disturbanceForce = 500 * s1;
  this.param = {
    gramPerMeterSq: 150.0,
    gravity: 9.8,
    k: {
      stretch: 5 * s2,
      shear: 20 * s2,
      bend: 20 * s2
    },
    damping: s1 * 1e-2
  };

  this.shaderSources = {
    vertShaders: {},
    fragShaders: {}
  };

  this.shaderPrograms = {};

  this.mat = {
    model: mat4.create(),
    view: mat4.create(),
    projection: mat4.create(),
    mvp: mat4.create(),
    mv: mat4.create(),
    normal: mat3.create()
  };

  this.light = {
    direction: vec3.create(),
    ambient: [0.1, 0.1, 0.1, 1.0]
  };

  vec3.normalize(this.light.direction, [-0.5 * this.width, -1.5 * this.height, -900]);

  this.camera = [210, -this.height / 2, -450.0];
  this.camera_q = quat.create();

  this.viewport = viewport;
  this.gl = gl;

  this.maxDelta = 0.004;

  this.stateUpdated = false;
  this.wireframe = false;
  this.disturbance = false;

  this.debugBuf = null;
}

Cloth.prototype.generateWireframeVertices = function () {
  var i, j;
  var w = this.grid.width;
  var h = this.grid.height;
  var idx = [];
  for (i = 0; i < h; i++) {
    for (j = 0; j < w; j++) {
      if (j < w - 1) {
        idx.push(i * w + j);
        idx.push(i * w + j + 1);
      }
      if (i < h - 1) {
        idx.push(i * w + j);
        idx.push((i + 1) * w + j);
      }
    }
  }
  return idx;
};

Cloth.prototype.generateFabricPattern = function (is_front) {
  var canvas = document.createElement("canvas");
  var size = 1024;
  canvas.width = size;
  canvas.height = size;

  var context = canvas.getContext("2d");

  if (is_front) {
    context.fillStyle = "rgb(223,31,25)";
  } else {
    context.fillStyle = "rgb(9,59,147)";
  }

  context.fillRect(0, 0, size, size);

  var boundaryCircleRadius = size / 8.5;
  var margin = boundaryCircleRadius * 0.75;
  var circleRadius = boundaryCircleRadius * 0.55;

  var longArmLength = circleRadius * 0.75;
  var shortArmLength = circleRadius * 0.6;
  var armWidth = circleRadius * 0.25;

  context.strokeStyle = "rgb(9,6,5)";

  var i, j;
  var isOddRow = true;
  for (i = 0; i < size; i += boundaryCircleRadius * Math.sqrt(2)) {
    for (j = 0; j < size + boundaryCircleRadius; j += boundaryCircleRadius * 2) {
      var cx = j + ((Math.random() * 2 - 1) * (margin - circleRadius));
      var cy = i + ((Math.random() * 2 - 1) * (margin - circleRadius));

      if (!isOddRow) {
        cx += boundaryCircleRadius;
      }

      if (is_front) {
        context.fillStyle = "rgb(252,248,133)";
      } else {
        context.fillStyle = "rgb(205,230,231)";
      }
      context.lineWidth = 4;

      context.beginPath();
      context.arc(cx, cy, circleRadius, 0, 2 * Math.PI);
      context.fill();
      context.stroke();

      var theta = Math.random() * 2 * Math.PI;
      var phi = Math.random() * (135.0 / 180.0) * Math.PI + (45.0 / 180) * Math.PI;

      context.fillStyle = "rgb(9,6,5)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cx + shortArmLength * Math.cos(theta), cy + shortArmLength * Math.sin(theta));
      context.lineTo(cx + 0.5 * armWidth * Math.cos(theta + phi * 0.5), cy + 0.5 * armWidth * Math.sin(theta + phi * 0.5));
      context.lineTo(cx + longArmLength * Math.cos(theta + phi), cy + longArmLength * Math.sin(theta + phi));
      context.lineTo(cx - 0.5 * armWidth * Math.cos(theta + phi * 0.5), cy - 0.5 * armWidth * Math.sin(theta + phi * 0.5));
      context.lineTo(cx + shortArmLength * Math.cos(theta), cy + shortArmLength * Math.sin(theta));
      context.fill();
      context.stroke();
    }
    isOddRow = !isOddRow;
  }

  var texture = createTexture2D(this.gl, canvas);
  texture.generateMipmap();
  texture.minFilter = this.gl.LINEAR_MIPMAP_LINEAR;
  texture.magFilter = this.gl.LINEAR;
  return texture;
};

Cloth.prototype.generateTriangleStripsVertices = function () {
  var x, y;
  var w = this.grid.width;
  var h = this.grid.height;
  var idx = [];
  for (y = 0; y < h - 1; y++) {
    for (x = 0; x < w; x++) {
      idx.push(y * w + x);
      idx.push((y + 1) * w + x);
      if (x == w - 1) {
        // degenerate triangle
        idx.push((y + 1) * w + x);
        idx.push((y + 1) * w);
      }
    }
  }

  return idx;
};

Cloth.prototype.initBuffers = function () {
  var i, j;
  var gl = this.gl;
  var w = this.grid.width;
  var h = this.grid.height;


  var computeBuffer = this.grid.computeBuffer;
  computeBuffer.vertices = createBuffer(gl, [-1, -1, 1, -1, 1, 1, -1, 1], gl.ARRAY_BUFFER, gl.STATIC_DRAW);
  computeBuffer.texCoords = createBuffer(gl, [0, 0, 1, 0, 1, 1, 0, 1], gl.ARRAY_BUFFER, gl.STATIC_DRAW);
  computeBuffer.indices = createBuffer(gl, [0, 1, 2, 0, 2, 3], gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
  computeBuffer.frameBufferObject = gl.createFramebuffer();
  computeBuffer.frameBuffer = new Float32Array(w * h * 4);

  //this.debugBuf = new Float32Array(w*h*4);

  for (i = 0; i < this.nBuf * 2; i++) {
    computeBuffer.textures[i] = createTexture2D(gl, w, h, gl.RGBA, gl.FLOAT);
  }

  var renderBuffer = this.grid.renderBuffer;
  var renderIndicesData;

  if (this.wireframe) {
    renderIndicesData = this.generateWireframeVertices();
  } else {
    renderIndicesData = this.generateTriangleStripsVertices();
  }

  var texCoordData = new Float32Array(w * h * 2);
  for (i = 0; i < h; i++) {
    for (j = 0; j < w; j++) {
      texCoordData[i * w * 2 + j * 2] = j / (w - 1);
      texCoordData[i * w * 2 + j * 2 + 1] = i / (h - 1);
    }
  }

  renderBuffer.indices = createBuffer(gl, renderIndicesData, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
  renderBuffer.indices.nItems = renderIndicesData.length;
  renderBuffer.vertices = createBuffer(gl, computeBuffer.frameBuffer);
  renderBuffer.texCoords = createBuffer(gl, texCoordData, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
  renderBuffer.textures[0] = this.generateFabricPattern(true);
  renderBuffer.textures[1] = this.generateFabricPattern(false);
  renderBuffer.normalBuffer = new Float32Array(w * h * 4);
  renderBuffer.normals = createBuffer(gl, renderBuffer.normalBuffer);
  renderBuffer.normalTexture = createTexture2D(gl, w, h, gl.RGBA, gl.FLOAT);
};

Cloth.prototype.initMatrices = function () {
  var mat = this.mat;
  mat.model = mat4.create();
  mat.view = mat4.create();
  mat.projection = mat4.create();
  mat.mvp = mat4.create();

  mat4.translate(mat.model, mat.model, [-this.width / 2, -this.height, 0]);

  // In Camera Frame is L.H.S (looking at -ve Z direction)
  // However all those coorindate given to lookAt is measure in World Coordinate frame which is R.H.S

  // near and for must > 0
  mat4.perspective(mat.projection, 0.25 * Math.PI, this.viewport.width / this.viewport.height, 1, 10000);

  this.updateMVP();
};

Cloth.prototype.initState = function () {
  var gl = this.gl;
  var fbo = this.grid.computeBuffer.frameBufferObject;
  var textures = this.grid.computeBuffer.textures;

  var initProgram = this.shaderPrograms.init_pos;
  initProgram.bind();
  initProgram.uniforms.u_size = [this.width, this.height];

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  // position initialization
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[0].handle, 0);
  this.runProgram(initProgram);
  gl.readPixels(0, 0, this.grid.width, this.grid.height, gl.RGBA, gl.FLOAT, this.grid.computeBuffer.frameBuffer);

  // velocity initialization (set to zeros)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[1].handle, 0);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

Cloth.prototype.init = function () {
  var gl = this.gl;

  if (gl.getExtension("OES_texture_flaot")) {
    console.log("float texture not supported");
    return;
  }

  var vertShaders = this.shaderSources.vertShaders;
  var fragShaders = this.shaderSources.fragShaders;
  vertShaders.compute = fs.readFileSync("./glsl/compute_v.glsl", "utf8");
  vertShaders.render_wireframe = fs.readFileSync("./glsl/render_wireframe_v.glsl", "utf8");
  vertShaders.render = fs.readFileSync("./glsl/render_v.glsl", "utf8");
  fragShaders.compute_pos = fs.readFileSync("./glsl/compute_pos_f.glsl", "utf8");
  fragShaders.compute_vel = fs.readFileSync("./glsl/compute_vel_f.glsl", "utf8");
  fragShaders.compute_normal = fs.readFileSync("./glsl/compute_normal_f.glsl", "utf8");
  fragShaders.init = fs.readFileSync("./glsl/init_f.glsl", "utf8");
  fragShaders.render_wireframe = fs.readFileSync("./glsl/render_wireframe_f.glsl", "utf8");
  fragShaders.render = fs.readFileSync("./glsl/render_f.glsl", "utf8");

  this.shaderPrograms.init_pos = createShader(gl, vertShaders.compute, fragShaders.init);
  this.shaderPrograms.compute_pos = createShader(gl, vertShaders.compute, fragShaders.compute_pos);
  this.shaderPrograms.compute_vel = createShader(gl, vertShaders.compute, fragShaders.compute_vel);
  this.shaderPrograms.render_wireframe = createShader(gl, vertShaders.render_wireframe, fragShaders.render_wireframe);
  this.shaderPrograms.render = createShader(gl, vertShaders.render, fragShaders.render);
  this.shaderPrograms.compute_normal = createShader(gl, vertShaders.compute, fragShaders.compute_normal);

  this.initBuffers();
  this.initState();
  this.initMatrices();
  this.render();
};

Cloth.prototype.updateCameraRotation = function (q) {
  this.camera_q = q;
  this.updateMVP();
};

Cloth.prototype.updateCamera = function () {
  vec3.transformQuat(this.camera, this.camera, this.camera_q);
  quat.identity(this.camera_q);
  this.updateMVP();
};

Cloth.prototype.translateCamera = function (v) {
  vec3.add(this.camera, this.camera, v);
  this.updateMVP();
};

Cloth.prototype.updateMVP = function () {
  var eye = vec3.create();
  var mat = this.mat;
  vec3.transformQuat(eye, this.camera, this.camera_q);

  mat4.lookAt(mat.view, eye, [0, -this.height / 2, 0], [0, -1, 0]);
  mat4.mul(mat.mv, mat.view, mat.model);
  mat4.mul(mat.mvp, mat.projection, mat.mv);

  mat3.normalFromMat4(mat.normal, mat.mv);
  return mat.mvp;
};

Cloth.prototype.runProgram = function (program) {
  var computeBuffer = this.grid.computeBuffer;
  var gl = this.gl;

  computeBuffer.vertices.bind();
  program.attributes.a_vpos.pointer();

  computeBuffer.texCoords.bind();
  program.attributes.a_tpos.pointer();

  computeBuffer.indices.bind();
  gl.viewport(0, 0, this.grid.width, this.grid.height);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
};

Cloth.prototype.computeNormal = function () {
  var gl = this.gl;
  var textures = this.grid.computeBuffer.textures;
  var computeNormalProgram = this.shaderPrograms.compute_normal;

  computeNormalProgram.bind();
  textures[this.grid.curIdx * 2].bind(0);
  computeNormalProgram.uniforms.u_pos_map = 0;
  computeNormalProgram.uniforms.u_size = [this.grid.width, this.grid.height];

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.grid.renderBuffer.normalTexture.handle, 0);
  this.runProgram(computeNormalProgram);
  gl.readPixels(0, 0, this.grid.width, this.grid.height, gl.RGBA, gl.FLOAT, this.grid.renderBuffer.normalBuffer);
};

Cloth.prototype.render = function () {
  var renderBuffer = this.grid.renderBuffer;
  var gl = this.gl;

  if (this.stateUpdated) {
    // transfer the computed position from GPU ram to CPU ram
    gl.readPixels(0, 0, this.grid.width, this.grid.height, gl.RGBA, gl.FLOAT, this.grid.computeBuffer.frameBuffer);
  } else {
    return;
  }

  var renderProgram;
  var textures = this.grid.renderBuffer.textures;

  if (this.wireframe) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderProgram = this.shaderPrograms.render_wireframe;
    renderProgram.bind();
    renderProgram.uniforms.u_MVP = this.mat.mvp;
    renderProgram.uniforms.u_color = [0.7, 0.5, 1.0, 1.0];

    renderBuffer.vertices.bind();
    renderBuffer.vertices.update(this.grid.computeBuffer.frameBuffer, 0);
    renderProgram.attributes.a_vpos.pointer();

    renderBuffer.indices.bind();
    gl.viewport(0, 0, this.viewport.width, this.viewport.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.LINES, renderBuffer.indices.nItems, gl.UNSIGNED_SHORT, 0);
  } else {
    this.computeNormal();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderProgram = this.shaderPrograms.render;

    renderProgram.bind();

    textures[0].bind(0);
    renderProgram.uniforms.u_front_map = 0;

    textures[1].bind(1);
    renderProgram.uniforms.u_back_map = 1;

    renderProgram.uniforms.u_MVP = this.mat.mvp;
    renderProgram.uniforms.u_MV = this.mat.mv;
    renderProgram.uniforms.u_N = this.mat.normal;
    renderProgram.uniforms.u_ambient = this.light.ambient;

    var currentLightDirection = vec3.create();
    vec3.transformMat3(currentLightDirection, this.light.direction, this.mat.normal);
    vec3.normalize(currentLightDirection, currentLightDirection);
    renderProgram.uniforms.u_light_dir = currentLightDirection;

    renderBuffer.vertices.bind();
    renderBuffer.vertices.update(this.grid.computeBuffer.frameBuffer, 0);
    renderProgram.attributes.a_vpos.pointer();

    renderBuffer.texCoords.bind();
    renderProgram.attributes.a_tpos.pointer();

    renderBuffer.normals.bind();
    renderBuffer.normals.update(renderBuffer.normalBuffer, 0);
    renderProgram.attributes.a_normal.pointer();

    renderBuffer.indices.bind();
    gl.viewport(0, 0, this.viewport.width, this.viewport.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.DEPTH_TEST);
    gl.drawElements(gl.TRIANGLE_STRIP, renderBuffer.indices.nItems, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.DEPTH_TEST);
  }
};

Cloth.prototype.triggerDisturbance = function () {
  this.disturbance = true;
};

Cloth.prototype.simulate = function (delta) {
  var gl = this.gl;

  if (delta > this.maxDelta) {
    delta = this.maxDelta;
  }

  var nextBufIdx = (this.grid.curIdx + 1) % this.nBuf;
  var computeVelocityProgram = this.shaderPrograms.compute_vel;
  var computePositionProgram = this.shaderPrograms.compute_pos;
  var textures = this.grid.computeBuffer.textures;
  var fbo = this.grid.computeBuffer.frameBufferObject;

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  // compute velocity
  computeVelocityProgram.bind();

  textures[this.grid.curIdx * 2].bind(0);
  computeVelocityProgram.uniforms.u_pos_map = 0;

  textures[this.grid.curIdx * 2 + 1].bind(1);
  computeVelocityProgram.uniforms.u_vel_map = 1;

  computeVelocityProgram.uniforms.u_size = [this.grid.width, this.grid.height];
  computeVelocityProgram.uniforms.u_L = [this.width / this.grid.width,
                                              this.height / this.grid.height];
  computeVelocityProgram.uniforms.u_param = [
        this.param.gramPerMeterSq * this.width * this.height / (this.grid.width * this.grid.height * this.pixelPerMeter * this.pixelPerMeter * 1000.0),
        this.param.gravity,
        this.param.damping
    ];
  computeVelocityProgram.uniforms.u_k = [this.param.k.stretch, this.param.k.shear, this.param.k.bend];
  computeVelocityProgram.uniforms.u_h = delta;

  if (this.disturbance) {
    computeVelocityProgram.uniforms.u_disturbance = this.disturbanceForce;
    this.disturbance = false;
  } else {
    computeVelocityProgram.uniforms.u_disturbance = 0.0;
  }

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[nextBufIdx * 2 + 1].handle, 0);
  this.runProgram(computeVelocityProgram);

  // compute position
  computePositionProgram.bind();

  textures[this.grid.curIdx * 2].bind(0);
  computePositionProgram.uniforms.u_pos_map = 0;

  textures[nextBufIdx * 2 + 1].bind(1);
  computePositionProgram.uniforms.u_vel_map = 1;

  computePositionProgram.uniforms.u_size = [this.grid.width, this.grid.height];
  computePositionProgram.uniforms.u_h = delta;

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[nextBufIdx * 2].handle, 0);
  this.runProgram(computePositionProgram);

  this.stateUpdated = true;

  this.grid.curIdx = nextBufIdx;
};

module.exports = Cloth;
