// @ts-nocheck
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";

const FloatingBlob = ({
  color = "#60a5fa",
  position = [0, 0, 0],
  scale = 1,
}) => {
  return (
    <mesh position={position as any} scale={scale}>
      <icosahedronGeometry args={[1, 2]} />
      <meshStandardMaterial
        color={color}
        roughness={0.2}
        metalness={0.6}
        emissive={color}
        emissiveIntensity={0.25}
      />
    </mesh>
  );
};

const ThreeBackdrop = () => {
  return (
    <div className="absolute inset-0 -z-10 opacity-70">
      <Canvas camera={{ position: [0, 0, 6] }}>
        <color attach="background" args={["#0f172a"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <Suspense fallback={null}>
          <FloatingBlob color="#3AA18A" position={[-2.2, 0.8, -1]} scale={1.6} />
          <FloatingBlob color="#79D3B6" position={[2.3, -0.6, 0]} scale={1.2} />
          <FloatingBlob color="#F6C867" position={[0, 1.8, -2]} scale={0.9} />
        </Suspense>
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.8} />
      </Canvas>
    </div>
  );
};

export default ThreeBackdrop;

