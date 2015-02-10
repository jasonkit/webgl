precision highp float;
precision highp int;

varying vec2 v_tpos;

uniform highp sampler2D u_pos_map;
uniform ivec2 u_size;

void main(void) {
    ivec2 coord = ivec2(floor(v_tpos*vec2(u_size)));
    vec4 pos_dat = texture2D(u_pos_map, v_tpos);
    
    vec3 p0 = vec3(pos_dat.x, pos_dat.y, pos_dat.z);
  
    vec2 coord_offset[4];
    int noffset = 0;
    vec3 normal = vec3(0,0,0);
   
    vec2 delta = vec2(1.0/float(u_size.x), 1.0/float(u_size.y));

    if (coord.x == 0 && coord.y == 0) {
        coord_offset[0] = vec2(0, delta.y);
        coord_offset[1] = vec2(delta.x, 0);
        noffset = 2;
    } else if (coord.x == u_size.x-1 && coord.y == 0) {
        coord_offset[0] = vec2(-delta.x, 0);
        coord_offset[1] = vec2(0, delta.y);
        noffset = 2;
    } else if (coord.x == 0 && coord.y == u_size.y-1) {
        coord_offset[0] = vec2(delta.x, 0);
        coord_offset[1] = vec2(0, -delta.y);
        noffset = 2;
    } else if (coord.x == u_size.x-1 && coord.y == u_size.y-1) {
        coord_offset[0] = vec2(0, -delta.y);
        coord_offset[1] = vec2(-delta.x, 0);
        noffset = 2;
    } else if (coord.x == 0) {
        coord_offset[0] = vec2(0, delta.y);
        coord_offset[1] = vec2(delta.x, 0);
        coord_offset[2] = vec2(0, -delta.y);
        noffset = 3;
    } else if (coord.x == u_size.x-1) {
        coord_offset[0] = vec2(0, -delta.y);
        coord_offset[1] = vec2(-delta.x, 0);
        coord_offset[2] = vec2(0, delta.y);
        noffset = 3;
    } else if (coord.y == 0) {
        coord_offset[0] = vec2(-delta.x, 0);
        coord_offset[1] = vec2(0, delta.y);
        coord_offset[2] = vec2(delta.x, 0);
        noffset = 3;
    } else if (coord.y == u_size.y-1) {
        coord_offset[0] = vec2(delta.x, 0);
        coord_offset[1] = vec2(0, -delta.y);
        coord_offset[2] = vec2(-delta.x, 0);
        noffset = 3;
    } else{
        coord_offset[0] = vec2(delta.x, 0);
        coord_offset[1] = vec2(0, -delta.y);
        coord_offset[2] = vec2(-delta.x, 0);
        coord_offset[3] = vec2(0, delta.y);
        noffset = 4;
    }

    for (int i=0; i<4; i++){
        if (i >= noffset-1) {
            break;
        }

        vec4 p1_dat = texture2D(u_pos_map, v_tpos + coord_offset[i]);
        vec3 p1 = vec3(p1_dat.x, p1_dat.y, p1_dat.z) - p0;
        vec4 p2_dat = texture2D(u_pos_map, v_tpos + coord_offset[i+1]);
        vec3 p2 = vec3(p2_dat.x, p2_dat.y, p2_dat.z) - p0;

        normal += normalize(cross(p1,p2));
    }

    if (noffset == 4) {
        vec4 p1_dat = texture2D(u_pos_map, v_tpos + coord_offset[3]);
        vec3 p1 = vec3(p1_dat.x, p1_dat.y, p1_dat.z) - p0;
        vec4 p2_dat = texture2D(u_pos_map, v_tpos + coord_offset[0]);
        vec3 p2 = vec3(p2_dat.x, p2_dat.y, p2_dat.z) - p0;
         
        normal += normalize(cross(p1,p2));
        normal /= 4.0;
    }else if (noffset == 3) {
        normal /= 2.0;
    }

    gl_FragColor = vec4(normal, 1);
}
