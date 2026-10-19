"use client";
// 3D 마음 친구: 모델 파일 없이 기본 도형으로 만든 「빛 방울」.
// 학생이 고른 몸 색·모양·눈·볼·무늬·팔다리·꾸미개를 입고, 감정 무리에 따라 표정·동작·둘레 빛이 바뀐다.
// cheer: 값이 바뀔 때마다 한 번 인사(폴짝 + 손 흔들기, 힘든 마음은 토닥 끄덕) · breath: 숨 고르기 시작부터 지난 ms.
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { BackSide, DoubleSide, type Group as ThreeGroup, type Mesh } from "three";
import { DEFAULT_LOOK, GROUPS, breathOf, groupOf, lighten, type BuddyAcc, type BuddyLook, type BuddyShape, type Group } from "@/lib/shared";

const FACE: Record<Group, { eyeY: number; mouth: number; tilt: number }> = {
  joy: { eyeY: 1, mouth: 1, tilt: 0 },
  calm: { eyeY: 1, mouth: 0.5, tilt: 0 },
  sad: { eyeY: 0.45, mouth: -1, tilt: 0 },
  angry: { eyeY: 0.45, mouth: -1, tilt: 0.35 },
  fear: { eyeY: 1.4, mouth: -0.4, tilt: 0 },
};
const SHAPE: Record<BuddyShape, [number, number, number]> = { round: [1, 1, 1], squish: [1.18, 0.84, 1.05], bean: [0.84, 1.16, 0.9] };
const INK = "#2d2a26";
// 점박이 무늬 자리(얼굴을 피해 옆·뒤·위에)
const SPOTS: [number, number, number][] = [
  [-0.82, 0.45, 0.35], [0.86, 0.32, 0.38], [-0.62, -0.58, 0.52], [0.55, -0.68, 0.48],
  [0.05, 0.92, -0.38], [-0.35, 0.25, -0.9], [0.6, 0.12, -0.79], [-0.9, -0.2, -0.38],
].map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [(x / l) * 0.94, (y / l) * 0.94, (z / l) * 0.94]; });

const Mat = ({ c, ...p }: { c: string; metalness?: number; roughness?: number }) => <meshStandardMaterial color={c} roughness={0.5} {...p} />;

function Eye({ x, kind, f }: { x: number; kind: BuddyLook["eyes"]; f: (typeof FACE)[Group] }) {
  return (
    <group position={[x, 0.18, 0.9]} scale={[1, f.eyeY, 1]} rotation={[0, 0, x < 0 ? -f.tilt : f.tilt]}>
      {kind === "big" && (
        <mesh position={[0, 0, -0.02]} scale={[1, 1.1, 0.5]}>
          <sphereGeometry args={[0.17, 20, 20]} />
          <Mat c="#ffffff" />
        </mesh>
      )}
      <mesh position={[0, kind === "big" ? -0.02 : 0, kind === "big" ? 0.07 : 0]}>
        <sphereGeometry args={[kind === "dot" ? 0.1 : kind === "sparkle" ? 0.125 : 0.095, 16, 16]} />
        <Mat c={INK} roughness={0.2} />
      </mesh>
      {kind !== "dot" && (
        <mesh position={[0.04, 0.05, kind === "big" ? 0.15 : 0.1]}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}

function Accessory({ acc, body }: { acc: BuddyAcc; body: string }) {
  if (acc === "sprout")
    return (
      <group position={[0, 0.98, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 0.3, 10]} />
          <Mat c="#4f8f43" />
        </mesh>
        {[-1, 1].map((d) => (
          <mesh key={d} position={[d * 0.15, 0.32, 0]} rotation={[0, 0, -d * 0.5]} scale={[1, 0.45, 0.6]}>
            <sphereGeometry args={[0.17, 16, 16]} />
            <Mat c="#7cc36a" />
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
            <Mat c="#ff5c8a" />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.08, 12, 12]} />
          <Mat c="#e2406f" />
        </mesh>
      </group>
    );
  if (acc === "party")
    return (
      <group position={[0.05, 0.9, 0]} rotation={[0, 0, -0.18]}>
        <mesh position={[0, 0.37, 0]}>
          <coneGeometry args={[0.36, 0.74, 32]} />
          <Mat c="#7fb5f0" />
        </mesh>
        {[0.15, 0.4].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.36 * (1 - y / 0.74) + 0.012, 0.36 * (1 - (y - 0.06) / 0.74) + 0.012, 0.06, 32, 1, true]} />
            <Mat c="#ffffff" />
          </mesh>
        ))}
        <mesh position={[0, 0.78, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <Mat c="#f6c445" />
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
            <group key={i}>
              <mesh position={[Math.sin(a) * 0.42, 0.28, Math.cos(a) * 0.42]}>
                <coneGeometry args={[0.08, 0.18, 10]} />
                <Mat c="#f2b705" metalness={0.5} roughness={0.3} />
              </mesh>
              <mesh position={[Math.sin(a) * 0.45, 0.1, Math.cos(a) * 0.45]}>
                <sphereGeometry args={[0.045, 10, 10]} />
                <Mat c={["#e2406f", "#5cc8c0", "#7fb5f0", "#b79cf0", "#7cc88f"][i]} roughness={0.2} />
              </mesh>
            </group>
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
            <Mat c={INK} />
          </mesh>
        ))}
        <mesh position={[0, 0.2, 0.98]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
          <Mat c={INK} />
        </mesh>
      </group>
    );
  if (acc === "cat")
    return (
      <group>
        {[-1, 1].map((d) => (
          <group key={d} position={[d * 0.48, 0.82, 0]} rotation={[0, 0, -d * 0.4]}>
            <mesh position={[0, 0.16, 0]}>
              <coneGeometry args={[0.22, 0.4, 4]} />
              <Mat c={body} />
            </mesh>
            <mesh position={[0, 0.13, 0.08]} scale={0.6}>
              <coneGeometry args={[0.22, 0.4, 4]} />
              <Mat c="#ffb3c4" />
            </mesh>
          </group>
        ))}
      </group>
    );
  if (acc === "bunny")
    return (
      <group>
        {[-1, 1].map((d) => (
          <group key={d} position={[d * 0.3, 0.95, 0]} rotation={[0, 0, -d * 0.18]}>
            <mesh position={[0, 0.38, 0]} scale={[0.32, 1, 0.2]}>
              <sphereGeometry args={[0.45, 20, 20]} />
              <Mat c={body} />
            </mesh>
            <mesh position={[0, 0.38, 0.06]} scale={[0.18, 0.8, 0.12]}>
              <sphereGeometry args={[0.45, 16, 16]} />
              <Mat c="#ffb3c4" />
            </mesh>
          </group>
        ))}
      </group>
    );
  if (acc === "flower")
    return (
      <group position={[-0.5, 0.78, 0.4]} rotation={[0.3, -0.4, 0.4]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.1, 14, 14]} />
              <Mat c="#ff8fb0" />
            </mesh>
          );
        })}
        <mesh position={[0, 0, 0.04]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <Mat c="#f6c445" />
        </mesh>
      </group>
    );
  if (acc === "headphones")
    return (
      <group position={[0, 0.05, 0]}>
        <mesh>
          <torusGeometry args={[1.04, 0.06, 10, 40, Math.PI]} />
          <Mat c="#5b6470" />
        </mesh>
        {[-1, 1].map((d) => (
          <group key={d} position={[d * 1.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh>
              <cylinderGeometry args={[0.24, 0.24, 0.16, 24]} />
              <Mat c="#ff7a59" />
            </mesh>
            <mesh position={[0, d * 0.09, 0]}>
              <cylinderGeometry args={[0.17, 0.17, 0.04, 24]} />
              <Mat c="#5b6470" />
            </mesh>
          </group>
        ))}
      </group>
    );
  return null;
}

function Blob({ group, intensity, look, cheer = 0, breath }: { group: Group; intensity: number; look: BuddyLook; cheer?: number; breath?: number }) {
  const root = useRef<ThreeGroup>(null);
  const body = useRef<Mesh>(null);
  const arms = useRef<(ThreeGroup | null)[]>([]);
  const hop = useRef({ key: cheer, at: -9 }); // 처음 그릴 때는 인사하지 않음
  const puff = useRef(0);
  const f = FACE[group];
  const hard = group === "sad" || group === "angry" || group === "fear";
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = root.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    if (cheer !== hop.current.key) hop.current = { key: cheer, at: t };
    const since = t - hop.current.at;
    const cheering = breath === undefined && since < 1.8;
    if (breath !== undefined) {
      puff.current += (breathOf(breath) - puff.current) * 0.15; // 부모가 0.1초마다 주는 값을 부드럽게 따라감
      g.scale.setScalar(1 + 0.28 * puff.current);
    } else if (cheering) {
      const q = since / 1.8;
      if (hard) g.rotation.x = Math.sin(q * Math.PI * 4) * 0.16 * (1 - q); // 토닥토닥 끄덕
      else g.position.y = Math.abs(Math.sin(q * Math.PI * 2)) * 0.35; // 제자리에서 두 번 폴짝(돌지 않음)
    } else if (group === "joy") g.position.y = Math.abs(Math.sin(t * 3)) * 0.25;
    else if (group === "sad") g.position.y = -0.12 + Math.sin(t * 1.2) * 0.03;
    else if (group === "angry") g.position.x = Math.sin(t * 20) * 0.025;
    else if (group === "fear") g.scale.setScalar(0.9 + Math.sin(t * 6) * 0.02);
    else g.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
    if (body.current) body.current.rotation.y = Math.sin(t * 0.6) * 0.15;
    // 팔: 평소엔 살랑, 인사할 땐 손 흔들기, 힘든 마음엔 축 처짐
    arms.current.forEach((a, i) => {
      if (!a) return;
      const d = i === 0 ? -1 : 1;
      const wave = cheering && !hard ? Math.sin(since * 14) * 0.5 + 0.9 : 0;
      a.rotation.z = d * (hard ? 0.15 : 0.55 + Math.sin(t * 2 + i) * 0.08 + wave);
    });
  });
  const mood = GROUPS[group].color;
  const color = look.color || mood;
  const soft = lighten(color, 0.45);
  return (
    <group position={[0, -0.15, 0]}>
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
          {look.pattern === "spots" &&
            SPOTS.map((p, i) => (
              <mesh key={i} position={p}>
                <sphereGeometry args={[0.13, 14, 14]} />
                <meshStandardMaterial color={soft} emissive={soft} emissiveIntensity={0.2} roughness={0.4} />
              </mesh>
            ))}
          {look.pattern === "belly" && (
            // 입보다 아래(입 맨 아래 y≈-0.36)에 두어 표정을 가리지 않게
            <mesh position={[0, -0.68, 0.48]} scale={[0.5, 0.26, 0.28]}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshStandardMaterial color={soft} emissive={soft} emissiveIntensity={0.2} roughness={0.4} />
            </mesh>
          )}
          {look.limbs !== "none" &&
            [-1, 1].map((d, i) => (
              <group key={d} ref={(el) => { arms.current[i] = el; }} position={[d * 0.9, -0.12, 0.1]}>
                <mesh position={[d * 0.16, -0.08, 0]} scale={[1, 0.62, 0.62]}>
                  <sphereGeometry args={[0.22, 16, 16]} />
                  <Mat c={color} />
                </mesh>
              </group>
            ))}
          {look.limbs === "both" &&
            [-1, 1].map((d) => (
              <mesh key={d} position={[d * 0.4, -0.95, 0.2]} scale={[1.15, 0.55, 1.35]}>
                <sphereGeometry args={[0.24, 16, 16]} />
                <Mat c={color} />
              </mesh>
            ))}
          {[-0.32, 0.32].map((x) => <Eye key={x} x={x} kind={look.eyes} f={f} />)}
          {f.mouth !== 0 && (
            // 구의 맨 앞(z=1)에 띄워야 둥근 겉면에 입 가운데가 묻히지 않는다
            <mesh position={[0, f.mouth > 0 ? -0.18 : -0.3, 1]} rotation={[0, 0, f.mouth > 0 ? Math.PI : 0]} scale={Math.abs(f.mouth)}>
              <torusGeometry args={[0.18, 0.035, 8, 24, Math.PI]} />
              <Mat c={INK} />
            </mesh>
          )}
          {(group === "joy" || look.cheek === "blush") &&
            [-0.55, 0.55].map((x) => (
              <mesh key={x} position={[x, -0.08, 0.8]} scale={[1, 0.55, 0.3]}>
                <sphereGeometry args={[0.13, 16, 16]} />
                <meshStandardMaterial color="#ff9eb0" transparent opacity={0.8} />
              </mesh>
            ))}
          {look.cheek === "freckle" &&
            [-1, 1].flatMap((d) =>
              [[0.5, -0.02], [0.58, -0.1], [0.44, -0.12]].map(([x, y], j) => (
                <mesh key={`${d}${j}`} position={[d * x, y, Math.sqrt(1 - x * x - y * y) + 0.005]}>
                  <sphereGeometry args={[0.025, 8, 8]} />
                  <Mat c="#a0623c" />
                </mesh>
              )),
            )}
          <Accessory acc={look.acc} body={color} />
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
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 4.6], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 4]} intensity={1.4} />
        <Blob group={group} intensity={intensity} look={look} cheer={cheer} breath={breath} />
      </Canvas>
    </div>
  );
}
