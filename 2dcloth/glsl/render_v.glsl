attribute vec4 a_vpos;

uniform vec2 u_resolution;

void main(void) {
    vec2 clip_pos = 2.0*(vec2(a_vpos.x, a_vpos.y)/u_resolution) - 1.0;
    clip_pos.y = -clip_pos.y;
    gl_Position = vec4(clip_pos, 0, 1);
}
