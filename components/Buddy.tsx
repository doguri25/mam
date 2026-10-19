"use client";
// 3D 마음 친구: 모델 파일 없이 기본 도형으로 만든 「빛 방울」.
// 학생이 고른 몸 색·모양·꾸미개를 입고, 감정 무리에 따라 표정·동작·둘레 빛이 바뀐다.
// cheer: 값이 바뀔 때마다 한 번 인사(폴짝·토닥) · breath: 숨 고르기 시작부터 지난 ms — 8초에 한 번 부풀었다 줄어든다.
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { BackSide, DoubleSide, type Group as ThreeGroup, type Mesh } from "three";
import { DEFAULT_LOOK, GROUPS, breathOf, groupOf, type BuddyAcc, type BuddyLook, type BuddyShape, type Group } from "@/lib/shared";

const FACE: Record<Group, { eyeY: number; mouth: number; tilt: number }> = {
  joy: { eyeY: 1, mouth: 1, tilt: 0 },
  calm: { eyeY: 1, mouth: 0.5, tilt: 0 },
  sad: { eyeY: 0.45, mouth: -1, tilt: 0 },
  angry: { eyeY: 0.45, mouth: -1, tilt: 0.35 },
  fear: { eyeY: 1.4, mouth: -0.4, tilt: 0 },
};
const SHAPE: Record<BuddyShape, [number, number, number]> = { round: [1, 1, 1], squish: [1.18, 0.84, 1.05], bean: [0.84, 1.16, 0.9] };
const ease = (x: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;

function Accessory({ acc }: { acc: BuddyAcc }) {
  if (acc === "sprout")
    return (
      <group position={[0, 0.98, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 0.3, 10]} />
          <meshStandardMaterial color="#4f8f43" />
        </mesh>
        {[-1, 1].map((d) => (
          <mesh key={d} position={[d * 0.15, 0.32, 0]} rotation={[0, 0, -d * 0.5]} scale={[1, 0.45, 0.6]}>
            <sphereGeometry args={[0.17, 16, 16]} />
            <meshStandardMaterial color="#7cc36a" />
          </mesh>
        ))}
      </group>
    );
  if (acc === "ribbon")
    return (
      <group position={[0.52, 0.8, 0.25]} rotation={[0, 0, -0.45]}>
        {[-1, 1].map((d) => (
          <mesh key={d} position={[d * 0.17, 0, 0]} rotation={[0, 0, (d * -Math.PI) / 2]}>
            <coneGeometry args={[0.15, 0.3, 16]} />
            <meshStandardMaterial color="#ff5c8a" />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#e2406f" />
        </mesh>
      </group>
    );
  if (acc === "party")
    return (
      <group position={[0.05, 0.9, 0]} rotation={[0, 0, -0.18]}>
        <mesh position={[0, 0.37, 0]}>
          <coneGeometry args={[0.36, 0.74, 32]} />
          <meshStandardMaterial color="#7fb5f0" />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#f6c445" />
        </mesh>
      </group>
    );
  if (acc === "crown")
    return (
      <group position={[0, 0.9, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.42, 0.46, 0.2, 24, 1, true]} />
          <meshStandardMaterial color="#f2b705" metalness={0.5} roughness={0.3} side={DoubleSide} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.42, 0.28, Math.cos(a) * 0.42]}>
              <coneGeometry args={[0.08, 0.18, 10]} />
              <meshStandardMaterial color="#f2b705" metalness={0.5} roughness={0.3} />
            </mesh>
          );
        })}
      </group>
    );
  if (acc === "glasses")
    return (
      <group>
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} position={[x, 0.18, 0.96]}>
            <torusGeometry args={[0.17, 0.03, 10, 28]} />
            <meshStandardMaterial color="#2d2a26" />
          </mesh>
        ))}
        <mesh position={[0, 0.2, 0.98]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
          <meshStandardMaterial color="#2d2a26" />
        </mesh>
      </group>
    );
  return null;
}

function Blob({ group, intensity, look, cheer = 0, breath }: { group: Group; intensity: number; look: BuddyLook; cheer?: number; breath?: number }) {
  const root = useRef<ThreeGroup>(null);
  const body = useRef<Mesh>(null);
  const hop = useRef({ key: cheer, at: -9 }); // 처음 그릴 때는 인사하지 않음
  const puff = useRef(0);
  const f = FACE[group];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = root.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    if (cheer !== hop.current.key) hop.current = { key: cheer, at: t };
    const since = t - hop.current.at;
    if (breath !== undefined) {
      puff.current += (breathOf(breath) - puff.current) * 0.15; // 부모가 0.1초마다 주는 값을 부드럽게 따라감
      g.scale.setScalar(1 + 0.28 * puff.current);
    } else if (since < 1.8) {
      const q = since / 1.8;
      if (group === "joy" || group === "calm") {
        g.position.y = Math.sin(q * Math.PI) * 0.45; // 폴짝 뛰며 한 바퀴
        g.rotation.y = ease(q) * Math.PI * 2;
      } else g.rotation.x = Math.sin(q * Math.PI * 4) * 0.16 * (1 - q); // 토닥토닥 끄덕
    } else if (group === "joy") g.position.y = Math.abs(Math.sin(t * 3)) * 0.25;
    else if (group === "sad") g.position.y = -0.12 + Math.sin(t * 1.2) * 0.03;
    else if (group === "angry") g.position.x = Math.sin(t * 20) * 0.025;
    else if (group === "fear") g.scale.setScalar(0.9 + Math.sin(t * 6) * 0.02);
    else g.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
    if (body.current) body.current.rotation.y = Math.sin(t * 0.6) * 0.15;
  });
  const mood = GROUPS[group].color;
  const color = look.color || mood;
  return (
    <group position={[0, -0.2, 0]}>
      <group ref={root}>
        <group scale={SHAPE[look.shape]}>
          {look.color && (
            // 몸 색을 골랐어도 감정이 보이게, 감정 색 빛무리를 뒤에 두른다
            <mesh scale={1.16}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial color={mood} transparent opacity={0.22 + intensity * 0.04} side={BackSide} />
            </mesh>
          )}
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
          <Accessory acc={look.acc} />
        </group>
      </group>
    </group>
  );
}

export interface BuddyProps {
  emotion?: string;
  intensity?: number;
  look?: BuddyLook;
  cheer?: number;
  breath?: number;
  size?: number;
  className?: string;
}

// className을 주면 그 상자 크기를 따른다(화면 폭에 따라 크기를 바꾸려고)
export default function Buddy({ emotion, intensity = 3, look = DEFAULT_LOOK, cheer, breath, size = 200, className }: BuddyProps) {
  const group = emotion ? groupOf(emotion) : "calm";
  return (
    <div className={className} style={className ? undefined : { width: size, height: size }} aria-hidden>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 4.4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 4]} intensity={1.4} />
        <Blob group={group} intensity={intensity} look={look} cheer={cheer} breath={breath} />
      </Canvas>
    </div>
  );
}
