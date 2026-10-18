"use client";
// 3D 마음 친구: 모델 파일 없이 기본 도형으로 만든 「빛 방울」. 감정 무리에 따라 빛·표정·동작이 바뀐다.
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group as ThreeGroup, Mesh } from "three";
import { GROUPS, groupOf, type Group } from "@/lib/shared";

const FACE: Record<Group, { eyeY: number; mouth: number; tilt: number }> = {
  joy: { eyeY: 1, mouth: 1, tilt: 0 },
  calm: { eyeY: 1, mouth: 0.5, tilt: 0 },
  sad: { eyeY: 0.45, mouth: -1, tilt: 0 },
  angry: { eyeY: 0.45, mouth: -1, tilt: 0.35 },
  fear: { eyeY: 1.4, mouth: -0.4, tilt: 0 },
};

function Blob({ group, intensity }: { group: Group; intensity: number }) {
  const root = useRef<ThreeGroup>(null);
  const body = useRef<Mesh>(null);
  const f = FACE[group];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = root.current;
    if (!g) return;
    if (group === "joy") g.position.y = Math.abs(Math.sin(t * 3)) * 0.25;
    else if (group === "sad") g.position.y = -0.12 + Math.sin(t * 1.2) * 0.03;
    else if (group === "angry") g.position.x = Math.sin(t * 20) * 0.025;
    else if (group === "fear") g.scale.setScalar(0.9 + Math.sin(t * 6) * 0.02);
    else g.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
    if (body.current) body.current.rotation.y = Math.sin(t * 0.6) * 0.15;
  });
  const color = GROUPS[group].color;
  return (
    <group ref={root}>
      <mesh ref={body}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15 + intensity * 0.12} roughness={0.35} />
      </mesh>
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 0.18, 0.9]} scale={[1, f.eyeY, 1]} rotation={[0, 0, x < 0 ? -f.tilt : f.tilt]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#2d2a26" />
        </mesh>
      ))}
      {f.mouth !== 0 && (
        // 구의 맨 앞(z=1)에 띄워야 둥근 겉면에 입 가운데가 묻히지 않는다
        <mesh position={[0, f.mouth > 0 ? -0.18 : -0.3, 1]} rotation={[0, 0, f.mouth > 0 ? Math.PI : 0]} scale={Math.abs(f.mouth)}>
          <torusGeometry args={[0.18, 0.035, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#2d2a26" />
        </mesh>
      )}
      {group === "joy" &&
        [-0.55, 0.55].map((x) => (
          <mesh key={x} position={[x, -0.08, 0.8]} scale={[1, 0.55, 0.3]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color="#ff9eb0" transparent opacity={0.8} />
          </mesh>
        ))}
    </group>
  );
}

export default function Buddy({ emotion, intensity = 3, size = 200 }: { emotion?: string; intensity?: number; size?: number }) {
  const group = emotion ? groupOf(emotion) : "calm";
  return (
    <div style={{ width: size, height: size }} aria-hidden>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 3.4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 4]} intensity={1.4} />
        <Blob group={group} intensity={intensity} />
      </Canvas>
    </div>
  );
}
