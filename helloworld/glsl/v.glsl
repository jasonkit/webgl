attribute vec2 a_vertex;

uniform vec2 u_resolution;

void main(void) {
    vec2 clip_pos = 2.0*(a_vertex/u_resolution) - 1.0; 
    gl_Position = vec4(clip_pos, 0, 1);
}
