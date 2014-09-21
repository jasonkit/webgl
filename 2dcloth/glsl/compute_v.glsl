attribute vec2 a_vpos;
attribute vec2 a_tpos;

varying vec2 v_tpos;
void main(void)
{
    gl_Position = vec4(a_vpos, 0.0, 1.0);
    v_tpos = a_tpos;
}
