precision highp float;
precision highp int;

varying vec2 v_tpos;

uniform highp sampler2D u_pos_map;
uniform highp sampler2D u_vel_map;
uniform ivec2 u_size;
uniform float u_h;

void main(void) {
    ivec2 pos = ivec2(floor(v_tpos*vec2(u_size)));
    vec4 prev_pos_dat = texture2D(u_pos_map, v_tpos);
    vec4 cur_vel_dat = texture2D(u_vel_map, v_tpos);

    vec3 p = vec3(prev_pos_dat.x, prev_pos_dat.y, prev_pos_dat.z);
    vec3 v = vec3(cur_vel_dat.x, cur_vel_dat.y, cur_vel_dat.z);
    
    if ((pos.x<3 && pos.y<3) || (pos.x>u_size.x-4 && pos.y<3)) { 
    //if ((abs(float(pos.x-(u_size.x/2))) <3.0 && pos.y==0)) { 
        gl_FragColor = vec4(p, 1);
    }else{
        p += u_h*v; 
        gl_FragColor = vec4(p, 1);
    }
}
