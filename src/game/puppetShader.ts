import * as THREE from 'three';

/**
 * Clean, Expressive Stop-Motion Puppet Shaders:
 * - ZERO distortion on the skier's face/head (keeps their rosy cheeks & expression crisp and natural!)
 * - Subtle wind flutter ONLY on the far trailing scarf tip (u > 0.68, h > 0.56)
 * - Clean whole-body spring squash/stretch & grounded ski anchor
 * - Matte felt/wool color fidelity (no plastic sheen!)
 */

export interface SkierPuppetUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uMap: { value: THREE.Texture };
  uTime: { value: number };
  uSpeed: { value: number };
  uSquash: { value: number };
  uCrouch: { value: number };
  uFlipX: { value: number };
}

export function createSkierPuppetMaterial(tex: THREE.Texture): {
  material: THREE.ShaderMaterial;
  uniforms: SkierPuppetUniforms;
} {
  const uniforms: SkierPuppetUniforms = {
    uMap: { value: tex },
    uTime: { value: 0 },
    uSpeed: { value: 1.0 },
    uSquash: { value: 0 },
    uCrouch: { value: 0 },
    uFlipX: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSpeed;
      uniform float uSquash;
      uniform float uCrouch;
      uniform float uFlipX;

      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float h = uv.y;
        float u = uv.x;

        // 1. ONLY flutter the far trailing knitted scarf tip (u > 0.68, h > 0.56).
        //    Face & head (u = 0.20..0.66) remain 100% crisp, rigid, and expressive!
        float scarfTip = smoothstep(0.68, 0.86, u) * smoothstep(0.56, 0.72, h);
        float windFreq = 10.0 + uSpeed * 4.5;
        pos.y += sin(uTime * windFreq - u * 12.0) * 0.14 * scarfTip;
        pos.z += cos(uTime * windFreq - u * 10.0) * 0.12 * scarfTip;

        // 2. Clean whole-body squash & stretch anchored at the skis (never melts the face!)
        float sy = 1.0 + uSquash - uCrouch * 0.08;
        float sx = 1.0 - uSquash * 0.55 + uCrouch * 0.05;
        float pivotY = -2.15;
        pos.y = pivotY + (pos.y - pivotY) * sy;
        pos.x *= sx;

        // Apply left/right flip cleanly
        pos.x *= uFlipX;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv;

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        if (texel.a < 0.12) discard;
        // True, warm matte felt/wool colors — zero plastic sheen or artificial glow wash
        gl_FragColor = vec4(texel.rgb * 1.06, texel.a);
      }
    `,
  });

  return { material, uniforms };
}

export interface YetiPuppetUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uMap: { value: THREE.Texture };
  uTime: { value: number };
  uStride: { value: number };
  uLunge: { value: number };
  uFlipX: { value: number };
}

/**
 * Clean Stop-Motion Yeti Puppet Shader:
 * Keeps the Yeti's expressive roaring face razor-sharp while animating his
 * outer waving arms, alternating stomping feet, and twinkling fairy lights!
 */
export function createYetiPuppetMaterial(tex: THREE.Texture): {
  material: THREE.ShaderMaterial;
  uniforms: YetiPuppetUniforms;
} {
  const uniforms: YetiPuppetUniforms = {
    uMap: { value: tex },
    uTime: { value: 0 },
    uStride: { value: 0 },
    uLunge: { value: 0 },
    uFlipX: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    vertexShader: /* glsl */ `
      uniform float uStride;
      uniform float uLunge;
      uniform float uFlipX;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float s = floor(uStride * 2.5) / 2.5;
        float h = uv.y;
        float u = uv.x;

        // Alternating stomping legs (only bottom 28% so face & torso stay clean)
        float legMask = 1.0 - smoothstep(0.10, 0.30, h);
        float sideSign = u < 0.5 ? -1.0 : 1.0;
        pos.y += max(0.0, sin(s + sideSign * 1.57)) * 0.36 * legMask;

        // Outer raised waving hands/arms only (|u - 0.5| > 0.28 so face is untouched!)
        float armMask = smoothstep(0.54, 0.78, h) * smoothstep(0.28, 0.44, abs(u - 0.5));
        pos.y += sin(s * 1.15 + sideSign * 0.7) * 0.32 * armMask;

        // Whole-body rhythmic lumbering bounce & forward lean
        pos.y += abs(sin(s)) * 0.16;
        pos.z += uLunge * 0.55 * h;
        pos.x *= uFlipX;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        if (texel.a < 0.12) discard;
        vec3 col = texel.rgb * 1.08;
        float isLight = smoothstep(0.82, 0.99, max(texel.r, max(texel.g, texel.b)));
        col += texel.rgb * isLight * (0.08 + 0.08 * sin(uTime * 10.0 + vUv.x * 16.0));
        gl_FragColor = vec4(col, texel.a);
      }
    `,
  });

  return { material, uniforms };
}
