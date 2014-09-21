precision highp float;
precision highp int;

varying vec2 v_texCoord;

uniform highp sampler2D u_sampler;
uniform vec2 u_size;

void main(void) {
    vec2 v = floor(v_texCoord*u_size);
    vec2 delta = 1.0/u_size;
    vec4 dat = texture2D(u_sampler, v_texCoord+delta);
    gl_FragColor = vec4(v, dat.r, dat.g);
}
