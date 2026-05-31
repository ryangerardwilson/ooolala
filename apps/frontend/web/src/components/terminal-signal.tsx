import {useEffect, useRef} from 'react';

type ParticleField = {
  count: number;
  initial: Float32Array;
  target: Float32Array;
  positions: Float32Array;
};

export function TerminalSignalWordmark({word = 'ooolala'}: {word?: string}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const host = container;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cleanupThree: (() => void) | undefined;
    let cancelled = false;

    void Promise.all([
      import('three/src/renderers/WebGLRenderer.js'),
      import('three/src/scenes/Scene.js'),
      import('three/src/cameras/OrthographicCamera.js'),
      import('three/src/core/BufferGeometry.js'),
      import('three/src/core/BufferAttribute.js'),
      import('three/src/materials/PointsMaterial.js'),
      import('three/src/objects/Points.js')
    ]).then(([
      {WebGLRenderer},
      {Scene},
      {OrthographicCamera},
      {BufferGeometry},
      {BufferAttribute},
      {PointsMaterial},
      {Points}
    ]) => {
      if (cancelled) return;

      let frame = 0;
      let disposed = false;
      let field: ParticleField | null = null;

      let renderer: InstanceType<typeof WebGLRenderer>;

      try {
        renderer = new WebGLRenderer({alpha: true, antialias: false, powerPreference: 'low-power'});
      } catch {
        host.dataset.ooSignal = 'fallback';
        return;
      }

      host.dataset.ooSignal = 'three';
      renderer.setClearAlpha(0);
      renderer.domElement.className = 'oo-terminal-signal-canvas';
      host.replaceChildren(renderer.domElement);

      const scene = new Scene();
      const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1000);
      camera.position.z = 500;

      const geometry = new BufferGeometry();
      const material = new PointsMaterial({
        color: 0x4cc9a6,
        depthWrite: false,
        opacity: 0.36,
        size: 2.4,
        transparent: true
      });
      const points = new Points(geometry, material);
      scene.add(points);

      function resize() {
        const rect = host.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        const pixelRatio = Math.min(window.devicePixelRatio || 1, width < 560 ? 1.25 : 1.6);

        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);

        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        camera.updateProjectionMatrix();

        field = buildParticleField(word, width, height);
        geometry.setAttribute('position', new BufferAttribute(field.positions, 3));
        material.size = width < 560 ? 2.1 : 2.7;
        material.opacity = prefersReducedMotion ? 0.22 : 0.36;

        if (prefersReducedMotion) {
          field.positions.set(field.target);
          geometry.attributes.position.needsUpdate = true;
          renderer.render(scene, camera);
        }
      }

      function animate(startTime: number) {
        if (disposed) return;

        frame = window.requestAnimationFrame((now) => {
          if (!document.hidden && field) {
            updatePositions(field, now - startTime, prefersReducedMotion);
            geometry.attributes.position.needsUpdate = true;
            material.opacity = prefersReducedMotion ? 0.22 : settleOpacity(now - startTime);
            renderer.render(scene, camera);
          }

          if (!prefersReducedMotion) animate(startTime);
        });
      }

      resize();
      window.addEventListener('resize', resize);
      if (!prefersReducedMotion) animate(performance.now());

      cleanupThree = () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => {
      if (!cancelled) host.dataset.ooSignal = 'fallback';
    });

    return () => {
      cancelled = true;
      cleanupThree?.();
    };
  }, [word]);

  return (
    <div ref={containerRef} aria-hidden="true" className="oo-terminal-signal absolute inset-0 pointer-events-none">
      <span className="oo-terminal-signal-fallback">{word}</span>
    </div>
  );
}

function buildParticleField(word: string, width: number, height: number): ParticleField {
  const sample = sampleWord(word, width, height);
  const count = sample.length;
  const initial = new Float32Array(count * 3);
  const target = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);

  sample.forEach((point, index) => {
    const offset = index * 3;
    const spreadX = width * 0.42;
    const spreadY = height * 0.2;

    target[offset] = point.x;
    target[offset + 1] = point.y;
    target[offset + 2] = point.z;

    initial[offset] = point.x + (randomFor(index, 0) - 0.5) * spreadX;
    initial[offset + 1] = point.y + (randomFor(index, 1) - 0.5) * spreadY;
    initial[offset + 2] = (randomFor(index, 2) - 0.5) * 120;

    positions[offset] = initial[offset];
    positions[offset + 1] = initial[offset + 1];
    positions[offset + 2] = initial[offset + 2];
  });

  return {count, initial, target, positions};
}

function sampleWord(word: string, width: number, height: number) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) return [];

  canvas.width = width;
  canvas.height = height;

  const fontSize = clamp(width * 0.17, 64, 174);
  const centerY = height * (width < 560 ? 0.18 : 0.2);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, width / 2, centerY);

  const image = ctx.getImageData(0, 0, width, height).data;
  const step = width < 560 ? 6 : 6;
  const points = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = image[(y * width + x) * 4 + 3];
      if (alpha < 60) continue;

      points.push({
        x: x - width / 2,
        y: height / 2 - y,
        z: (randomFor(points.length, 3) - 0.5) * 16
      });
    }
  }

  const maxPoints = width < 560 ? 620 : 1600;
  return points.length > maxPoints ? thinPoints(points, maxPoints) : points;
}

function thinPoints<T>(points: T[], maxPoints: number) {
  const stride = points.length / maxPoints;
  return Array.from({length: maxPoints}, (_value, index) => points[Math.floor(index * stride)]);
}

function updatePositions(field: ParticleField, elapsedMs: number, reducedMotion: boolean) {
  const resolve = reducedMotion ? 1 : easeOutCubic(clamp(elapsedMs / 1500, 0, 1));
  const ambient = clamp((elapsedMs - 1400) / 1200, 0, 1);
  const seconds = elapsedMs / 1000;

  for (let index = 0; index < field.count; index++) {
    const offset = index * 3;
    const drift = ambient * Math.sin(seconds * 0.55 + index * 0.17) * 1.8;
    const shimmer = ambient * Math.cos(seconds * 0.42 + index * 0.11) * 1.2;

    field.positions[offset] = lerp(field.initial[offset], field.target[offset], resolve) + drift;
    field.positions[offset + 1] = lerp(field.initial[offset + 1], field.target[offset + 1], resolve) + shimmer;
    field.positions[offset + 2] = lerp(field.initial[offset + 2], field.target[offset + 2], resolve);
  }
}

function settleOpacity(elapsedMs: number) {
  const resolved = easeOutCubic(clamp((elapsedMs - 1000) / 1200, 0, 1));
  return lerp(0.36, 0.24, resolved);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomFor(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}
