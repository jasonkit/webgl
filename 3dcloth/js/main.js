/*jslint browserify:true*/
/*global console*/
"use strict";

var Cloth = require("./cloth.js");
var Animation = require("./animation.js");
var SceneControl = require("./scene_control.js");

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

function main()
{
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("experimental-webgl");

    var cloth = new Cloth(250, 250, 100, {width: canvas.width, height: canvas.height}, gl);
    var animation = new Animation();

    animation.step = function(interval) {
        var niter = 25;
        var i;
        for (i=0; i<niter; i++){
            cloth.simulate(interval/niter);
        }
        cloth.render(); 
    };

    var sceneCtrl = new SceneControl(canvas);

    cloth.init();
    sceneCtrl.init(
        function (q) {
            cloth.updateCameraRotation(q);
        },
        function () {
            cloth.updateCamera();
        },
        function (v) {
            cloth.translateCamera(v);
        },
        function () {
            cloth.triggerDisturbance(); 
        });
    console.log("init done");
    animation.start();
}

window.addEventListener("load", main);
