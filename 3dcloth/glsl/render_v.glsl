precision highp float;
attribute vec4 a_vpos;
attribute vec4 a_normal;
attribute vec2 a_tpos;

uniform mat4 u_MVP;
uniform mat4 u_MV;
uniform mat3 u_N;

varying vec3 n;
varying vec2 v_tpos;

void main(void) {
    n = vec3(a_normal.x, a_normal.y, a_normal.z);
    n = u_N * n;
    
    v_tpos = a_tpos;
    
    gl_Position = u_MVP*a_vpos;
}
