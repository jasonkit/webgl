precision highp float;
precision highp int;

varying vec2 v_tpos;

uniform highp sampler2D u_data;
uniform ivec2 u_size;
uniform vec2 u_L;
uniform vec3 u_k;
uniform vec3 u_param;
uniform float u_h;

vec2 calculateForce(vec2 p, vec4 dat, float k, float L)
{
    vec2 q = vec2(dat.x, dat.y);
    float dist = length(q-p);
    return (k*(dist-L)/dist)*(q-p);
}

void main(void) {
    float m = u_param.x;
    vec2  g = vec2(0,u_param.y);
    float d = u_param.z;
    float h = u_h;

    ivec2 pos = ivec2(floor(v_tpos*vec2(u_size)));
    vec2 delta = 1.0/vec2(u_size);
    vec4 dat = texture2D(u_data, v_tpos);

    //if ((pos.x==0 && pos.y==0) || (pos.x==u_size.x-1 && pos.y==0)) { 
    if ((abs(float(pos.x-(u_size.x/2))) <3.0 && pos.y==0)) { 
        gl_FragColor = vec4(dat.x, dat.y, 0, 0);
    }else{
        vec2 p = vec2(dat.x, dat.y);
        vec2 v = vec2(dat.z, dat.w);
        vec2 F = m*g - d*v;
        
        // stretch
        if (pos.x>0) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(-1,0));
            F += calculateForce(p, dat, u_k.x, u_L.x);
        }
        if (pos.x<u_size.x-1) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(1,0));
            F += calculateForce(p, dat, u_k.x, u_L.x);
        }
        if (pos.y>0) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(0,-1));
            F += calculateForce(p, dat, u_k.x, u_L.y);
        }
        if (pos.y<u_size.y-1) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(0,1));
            F += calculateForce(p, dat, u_k.x, u_L.y);
        }
       
        // shear
        float nL = length(u_L);
        if (pos.x>0 && pos.y<u_size.y-1) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(-1,1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        if (pos.x<u_size.x-1 && pos.y>0) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(1,-1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        if (pos.x>0 && pos.y>0) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(-1,-1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        if (pos.x<u_size.x-1 && pos.y<u_size.y-1) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(1,1));
            F += calculateForce(p, dat, u_k.y, nL);
        }
        
        // bend
        if (pos.x>1) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(-2,0));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.x);
        }
        if (pos.x<u_size.x-2) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(2,0));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.x);
        }
        if (pos.y>1) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(0,-2));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.y);
        }
        if (pos.y<u_size.y-2) { 
            vec4 dat = texture2D(u_data, v_tpos + delta*vec2(0,2));
            F += calculateForce(p, dat, u_k.z, 2.0*u_L.y);
        }

        v = v + h*F/m;
        p = p + h*v;
        
        gl_FragColor = vec4(p,v);
    }
}
