import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useHitTest } from '@react-three/xr';
import * as THREE from 'three';
import { useStore } from '../../lib/store';
import type { Vector3Data, QuaternionData } from '../../types';

interface HitTestReticleProps {
  visible?: boolean;
  size?: number;
  color?: string;
  pulseSpeed?: number;
  pulseScale?: number;
}

export function HitTestReticle({
  visible = true,
  size = 0.1,
  color = '#00ffff',
  pulseSpeed = 2,
  pulseScale = 0.3,
}: HitTestReticleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const dotRef = useRef<THREE.Mesh>(null);

  const setLocalPosition = useStore((s) => s.setLocalPosition);
  const setLocalRotation = useStore((s) => s.setLocalRotation);

  const reticleMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      }),
    [color]
  );

  const innerMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(1.5),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    [color]
  );

  const dotMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffffff'),
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  const ringGeometry = useMemo(() => new THREE.RingGeometry(size * 0.8, size, 64), [size]);
  const innerRingGeometry = useMemo(() => new THREE.RingGeometry(size * 0.4, size * 0.6, 64), [size]);
  const dotGeometry = useMemo(() => new THREE.CircleGeometry(size * 0.15, 32), [size]);

  useHitTest((hitMatrix) => {
    if (!groupRef.current || !visible) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    hitMatrix.decompose(position, quaternion, scale);

    groupRef.current.position.copy(position);
    groupRef.current.quaternion.copy(quaternion);

    const vector3Data: Vector3Data = {
      x: position.x,
      y: position.y,
      z: position.z,
    };

    const quaternionData: QuaternionData = {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    };

    setLocalPosition(vector3Data);
    setLocalRotation(quaternionData);
  });

  useFrame((state) => {
    if (!groupRef.current || !visible) return;

    const time = state.clock.getElapsedTime();
    const pulse = Math.sin(time * pulseSpeed) * 0.5 + 0.5;

    if (ringRef.current) {
      const scale = 1 + pulse * pulseScale;
      ringRef.current.scale.set(scale, scale, 1);
      reticleMaterial.opacity = 0.8 - pulse * 0.3;
    }

    if (innerRingRef.current) {
      const innerPulse = Math.sin(time * pulseSpeed + Math.PI) * 0.5 + 0.5;
      const innerScale = 1 + innerPulse * pulseScale * 0.5;
      innerRingRef.current.scale.set(innerScale, innerScale, 1);
      innerMaterial.opacity = 0.6 - innerPulse * 0.2;
    }

    if (dotRef.current) {
      const dotPulse = Math.sin(time * pulseSpeed * 1.5) * 0.5 + 0.5;
      dotMaterial.opacity = 0.9 - dotPulse * 0.4;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} rotation-x={-Math.PI / 2}>
      <mesh
        ref={ringRef}
        geometry={ringGeometry}
        material={reticleMaterial}
      />
      <mesh
        ref={innerRingRef}
        geometry={innerRingGeometry}
        material={innerMaterial}
        position={[0, 0, 0.001]}
      />
      <mesh
        ref={dotRef}
        geometry={dotGeometry}
        material={dotMaterial}
        position={[0, 0, 0.002]}
      />
    </group>
  );
}

export default HitTestReticle;