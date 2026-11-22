import * as THREE from 'three';

/**
 * Rich Illuminated Christmas Twilight -> Blazing Aurora Borealis Sky & Snowy Mountain Silhouettes.
 * Never washes out into white fog: starts immediately in enchanting blue-violet Alpine twilight
 * with visible Aurora shimmer, intensifying to full Northern Lights splendor at 2,000m!
 */
export function createAuroraBackdrop(): {
  mesh: THREE.Mesh;
  uniforms: {
    uTime: { value: number };
    uIntensity: { value: number };
  };
} {
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.72 }, // 0.72 = Twilight Village Aurora -> 1.0 = Full Chomp Line Aurora
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vUv;

        // Concept-art palette: deep royal winter twilight zenith -> soft lavender-rose horizon alpenglow
        vec3 zenith = mix(vec3(0.06, 0.11, 0.25), vec3(0.03, 0.06, 0.17), uIntensity);
        vec3 midSky = mix(vec3(0.18, 0.23, 0.42), vec3(0.10, 0.16, 0.34), uIntensity);
        vec3 horizonGlow = mix(vec3(0.68, 0.48, 0.64), vec3(0.46, 0.34, 0.56), uIntensity);

        vec3 sky = mix(horizonGlow, midSky, smoothstep(0.14, 0.52, uv.y));
        sky = mix(sky, zenith, smoothstep(0.48, 0.96, uv.y));

        // Subtle crisp twinkling stars
        vec2 sg = floor(uv * vec2(190.0, 95.0));
        float r = hash(sg);
        if (r > 0.985 && uv.y > 0.35) {
          float tw = 0.5 + 0.5 * sin(uTime * 2.8 + r * 70.0);
          sky += vec3(0.88, 0.94, 1.0) * tw * smoothstep(0.35, 0.65, uv.y) * 0.7;
        }

        // Lush vertical-curtain Aurora Borealis ribbons (emerald, turquoise, violet)
        float w1 = sin(uv.x * 6.0 + uTime * 0.36 + fbm(vec2(uv.x * 2.8, uTime * 0.12)) * 2.4);
        float ribbon1 = exp(-abs(uv.y - (0.64 + w1 * 0.10)) * 8.5);
        float rays1 = pow(fbm(vec2(uv.x * 18.0 - uTime * 0.20, uv.y * 1.4)), 1.35);

        float w2 = cos(uv.x * 4.6 - uTime * 0.28 + fbm(vec2(uv.x * 2.2 + 3.0, uTime * 0.1)) * 2.1);
        float ribbon2 = exp(-abs(uv.y - (0.54 + w2 * 0.08)) * 10.5);
        float rays2 = pow(fbm(vec2(uv.x * 14.0 + uTime * 0.15, uv.y * 1.6 + 2.0)), 1.3);

        vec3 auroraGreen = vec3(0.16, 0.96, 0.68);
        vec3 auroraCyan = vec3(0.24, 0.85, 1.0);
        vec3 auroraViolet = vec3(0.68, 0.36, 0.95);

        vec3 aurora = auroraGreen * ribbon1 * (0.38 + 0.82 * rays1)
                    + mix(auroraCyan, auroraViolet, smoothstep(0.45, 0.85, uv.y)) * ribbon2 * (0.35 + 0.78 * rays2);
        sky += aurora * (0.36 + uIntensity * 0.36) * smoothstep(0.22, 0.50, uv.y);

        // Distant jagged snowy Alpine peaks silhouette
        float ridge1 = 0.34 + 0.14 * abs(sin(uv.x * 4.8 + 0.5)) * sin(uv.x * 2.4 + 0.3)
                     + 0.06 * fbm(vec2(uv.x * 13.0, 1.8));
        float ridge2 = 0.26 + 0.09 * abs(cos(uv.x * 6.4 - 0.8)) + 0.045 * fbm(vec2(uv.x * 16.0, 4.2));

        vec3 farMtn = vec3(0.24, 0.32, 0.52);
        vec3 nearMtn = vec3(0.36, 0.46, 0.66);

        // Soft moonlit snow sheen on upper mountain slopes
        float snowCrest1 = smoothstep(ridge1 - 0.06, ridge1, uv.y);
        farMtn = mix(farMtn, vec3(0.68, 0.78, 0.94), snowCrest1 * 0.78);
        float snowCrest2 = smoothstep(ridge2 - 0.05, ridge2, uv.y);
        nearMtn = mix(nearMtn, vec3(0.78, 0.86, 0.97), snowCrest2 * 0.76);

        // Soft luminous twilight snow mist blending mountain base into the bright snowy slope
        float mist = smoothstep(0.20, 0.02, uv.y);
        nearMtn = mix(nearMtn, vec3(0.76, 0.84, 0.96), mist * 0.72);

        float m1 = smoothstep(ridge1 + 0.008, ridge1 - 0.004, uv.y);
        float m2 = smoothstep(ridge2 + 0.008, ridge2 - 0.004, uv.y);

        sky = mix(sky, farMtn, m1);
        sky = mix(sky, nearMtn, m2);

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  const geo = new THREE.PlaneGeometry(290, 56);
  const mesh = new THREE.Mesh(geo, material);
  return { mesh, uniforms };
}

/**
 * Custom Post-Processing ShaderPass:
 * - Creamy Snow-Globe Macro Tilt-Shift Depth-of-Field at top & bottom edges
 * - Subtle warm Christmas filmic contrast + Boost speed shimmer + Yeti frost-crimson rim
 */
export const DioramaPostShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uBoost: { value: 0.0 },
    uDanger: { value: 0.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uBoost;
    uniform float uDanger;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      // Gentle macro tilt-shift focus band: ultra sharp in center gameplay area, dreamy bokeh at corners
      float distFromBand = max(0.0, abs(vUv.y - 0.50) - 0.28);
      float blurAmount = smoothstep(0.0, 0.22, distFromBand) * 3.0;

      vec2 texel = 1.0 / uResolution;
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      if (blurAmount > 0.05) {
        vec3 acc = col * 0.22;
        acc += texture2D(tDiffuse, vUv + vec2( blurAmount * texel.x,  0.0)).rgb * 0.13;
        acc += texture2D(tDiffuse, vUv + vec2(-blurAmount * texel.x,  0.0)).rgb * 0.13;
        acc += texture2D(tDiffuse, vUv + vec2( 0.0,  blurAmount * texel.y)).rgb * 0.13;
        acc += texture2D(tDiffuse, vUv + vec2( 0.0, -blurAmount * texel.y)).rgb * 0.13;
        acc += texture2D(tDiffuse, vUv + vec2( blurAmount * texel.x,  blurAmount * texel.y) * 0.72).rgb * 0.065;
        acc += texture2D(tDiffuse, vUv + vec2(-blurAmount * texel.x,  blurAmount * texel.y) * 0.72).rgb * 0.065;
        acc += texture2D(tDiffuse, vUv + vec2( blurAmount * texel.x, -blurAmount * texel.y) * 0.72).rgb * 0.065;
        acc += texture2D(tDiffuse, vUv + vec2(-blurAmount * texel.x, -blurAmount * texel.y) * 0.72).rgb * 0.065;
        col = acc;
      }

      // Soft cinematic vignette
      vec2 centered = vUv - 0.5;
      float r = length(centered * vec2(1.12, 1.0));
      float vig = smoothstep(0.46, 0.94, r);
      col *= mix(1.0, 0.82, vig);

      // Boost golden-cyan shimmer streaks at screen rim
      if (uBoost > 0.01) {
        float angle = atan(centered.y, centered.x);
        float streaks = pow(abs(sin(angle * 20.0 + uTime * 8.0)), 6.0);
        float rim = smoothstep(0.35, 0.78, r);
        col += vec3(0.38, 0.88, 1.0) * streaks * rim * uBoost * 0.22;
        col += vec3(1.0, 0.80, 0.42) * rim * uBoost * 0.08;
      }

      // Yeti close crimson-frost heartbeat edge
      if (uDanger > 0.01) {
        float pulse = 0.6 + 0.4 * sin(uTime * 10.0);
        float rim = smoothstep(0.38, 0.82, r);
        col = mix(col, vec3(0.84, 0.15, 0.28), rim * uDanger * pulse * 0.30);
      }

      // Warm holiday richness lift
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 1.12);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
