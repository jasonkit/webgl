attribute vec4 a_vpos;

uniform mat4 u_MVP;

void main(void) {
    gl_Position = u_MVP*a_vpos;
}
