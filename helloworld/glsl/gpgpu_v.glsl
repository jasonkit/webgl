attribute vec2 a_vertexPos;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;
void main(void)
{
    gl_Position = vec4(a_vertexPos, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
