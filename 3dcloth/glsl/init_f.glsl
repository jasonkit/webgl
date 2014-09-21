precision highp float;
precision highp int;

varying vec2 v_tpos;
uniform vec2 u_size;

void main(void) {
    vec2 p = v_tpos*u_size;
    gl_FragColor = vec4(p, p.y/1000.0, 1);
}
