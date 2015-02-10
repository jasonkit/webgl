precision highp float;
uniform vec4 u_ambient;
uniform vec3 u_light_dir;

uniform highp sampler2D u_front_map;
uniform highp sampler2D u_back_map;

varying vec2 v_tpos;
varying vec3 n;

void main(void) {

    vec4 diffuse;
    vec4 ambient;
    
    float k_diffuse = max(dot(n,u_light_dir), 0.45);

    if (gl_FrontFacing) {
        diffuse = k_diffuse*texture2D(u_front_map, v_tpos);
        ambient = u_ambient*texture2D(u_front_map, v_tpos);
    }else{
        diffuse = k_diffuse*texture2D(u_back_map, v_tpos);
        ambient = u_ambient*texture2D(u_back_map, v_tpos);
    }
    diffuse = clamp(diffuse, 0.0, 1.0);
    
    gl_FragColor = diffuse + ambient;
}
