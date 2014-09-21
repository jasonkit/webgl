precision highp float;
precision highp int;

varying vec2 v_tpos;
uniform vec2 u_size;
uniform vec2 u_offset;

void main(void) {
    vec2 v = v_tpos*u_size + u_offset;
    gl_FragColor = vec4(v, 0, 0);
}
