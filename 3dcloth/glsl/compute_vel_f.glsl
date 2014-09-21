precision highp float;
precision highp int;

varying vec2 v_tpos;

uniform highp sampler2D u_pos_map;
uniform highp sampler2D u_vel_map;
uniform ivec2 u_size;
uniform vec2 u_L;
uniform vec3 u_k;
uniform vec3 u_param;
uniform float u_h;
uniform float u_disturbance;

vec3 calculateForce(vec3 p, vec4 dat, float k, float L)
{
    vec3 q = vec3(dat.x, dat.y, dat.z);
    float dist = length(q-p);
    return (k*(dist-L)/dist)*(q-p);
}

void main(void) {
    float m = u_param.x;
    vec3  g = vec3(0,u_param.y,0);
    float d = u_param.z;

    ivec2 pos = ivec2(floor(v_tpos*vec2(u_size)));
    vec2 delta = 1.0/vec2(u_size);
    vec4 prev_pos_dat = texture2D(u_pos_map, v_tpos);
    vec4 prev_vel_dat = texture2D(u_vel_map, v_tpos);
    
    vec3 v = vec3(prev_vel_dat.x, prev_vel_dat.y, prev_vel_dat.z);

    if ((pos.x<3 && pos.y<3) || (pos.x>u_size.x-4 && pos.y<3)) { 
    //if ((abs(float(pos.x-(u_size.x/2))) <3.0 && pos.y==0)) { 
        gl_FragColor = vec4(v, 0);
    }else{
        vec3 p = vec3(prev_pos_dat.x, prev_pos_dat.y, prev_pos_dat.z);
        vec3 F = m*g - d*v;
        
        // stretch
        if (pos.x>0) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(-1,0));
            F += calculateForce(p, dat, u_k.x, u_L.x);
        }
        if (pos.x<u_size.x-1) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(1,0));
            F += calculateForce(p, dat, u_k.x, u_L.x);
        }
        if (pos.y>0) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(0,-1));
            F += calculateForce(p, dat, u_k.x, u_L.y);
        }
        if (pos.y<u_size.y-1) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(0,1));
            F += calculateForce(p, dat, u_k.x, u_L.y);
        }
       
        // shear
        float nL = length(u_L);
        if (pos.x>0 && pos.y<u_size.y-1) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(-1,1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        if (pos.x<u_size.x-1 && pos.y>0) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(1,-1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        if (pos.x>0 && pos.y>0) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(-1,-1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        if (pos.x<u_size.x-1 && pos.y<u_size.y-1) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(1,1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        // bend
        if (pos.x>1) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(-2,0));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.x);
        }
        if (pos.x<u_size.x-2) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(2,0));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.x);
        }
        if (pos.y>1) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(0,-2));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.y);
        }
        if (pos.y<u_size.y-2) { 
            vec4 dat = texture2D(u_pos_map, v_tpos + delta*vec2(0,2));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.y);
        }

        if ((abs(float(pos.x-(u_size.x/2))) <3.0) && (abs(float(pos.y-(u_size.y/2))) < 3.0)) {
            F += vec3(0,0,u_disturbance); 
        }

        v += u_h*F/m;
        
        gl_FragColor = vec4(v,0);
    }
}
