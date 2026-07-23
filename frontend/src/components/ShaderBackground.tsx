import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// A real WebGL fragment shader: a slow, flowing aurora in the litmus spectrum
// (rose → amber → blue) over the near-black ground. Falls back to the CSS
// background if WebGL is unavailable, and freezes for prefers-reduced-motion.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = uv * vec2(uRes.x/uRes.y, 1.0);
  float t = uTime * 0.04;
  float n1 = fbm(p*1.4 + vec2(t, t*0.5));
  float n2 = fbm(p*1.9 + vec2(-t*0.6, t*0.35) + n1);
  float n3 = fbm(p*1.1 + n2*0.9 + vec2(t*0.25, 0.0));

  vec3 base  = vec3(0.039, 0.055, 0.094);
  vec3 blue  = vec3(0.31, 0.56, 0.97);
  vec3 rose  = vec3(0.937, 0.345, 0.459);
  vec3 amber = vec3(0.949, 0.663, 0.314);

  vec3 col = base;
  col = mix(col, blue,  smoothstep(0.30, 0.86, n1) * 0.75);
  col = mix(col, rose,  smoothstep(0.42, 0.92, n2) * 0.55);
  col = mix(col, amber, smoothstep(0.52, 0.95, n3) * 0.32);

  // settle toward the ground near the bottom so content stays legible
  col = mix(col, base, smoothstep(0.55, 1.15, uv.y));
  gl_FragColor = vec4(col, 1.0);
}
`

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('shader compile failed', gl.getShaderInfoLog(s))
    return null
  }
  return s
}

export function ShaderBackground({ className, speed = 1 }: { className?: string; speed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    const resize = () => {
      const w = Math.floor(canvas.clientWidth * dpr)
      const h = Math.floor(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const start = performance.now()
    const render = (now: number) => {
      resize()
      gl.uniform1f(uTime, ((now - start) / 1000) * speed)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!reduce) raf = requestAnimationFrame(render)
    }
    render(start)

    const onResize = () => reduce && render(performance.now())
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
