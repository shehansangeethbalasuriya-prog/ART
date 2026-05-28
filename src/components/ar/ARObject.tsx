import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../lib/store';
import { updateObject as updateObjectService } from '../../services/objectService';
import { ObjectType } from '../../types';
import type { ARObject as ARObjectType } from '../../types';

interface ARObjectProps {
  object: ARObjectType;
  isSelected: boolean;
  onSelect: () => void;
  enableControls?: boolean;
}

const MATERIAL_CACHE = new Map<string, THREE.Material>();

function getMaterial(color: string, isSelected: boolean): THREE.Material {
  const key = `${color}-${isSelected}`;
  if (MATERIAL_CACHE.has(key)) {
    return MATERIAL_CACHE.get(key)!;
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: isSelected ? 0.3 : 0.5,
    metalness: isSelected ? 0.7 : 0.4,
    envMapIntensity: isSelected ? 1.5 : 1.0,
  });

  MATERIAL_CACHE.set(key, material);
  return material;
}

interface GeometryObjectProps {
  type: ObjectType;
  color: string;
  isSelected: boolean;
  scale: THREE.Vector3;
}

function GeometryObject({ type, color, isSelected, scale }: GeometryObjectProps) {
  const material = useMemo(() => getMaterial(color, isSelected), [color, isSelected]);

  const geometry = useMemo(() => {
    switch (type) {
      case ObjectType.Cube:
        return new THREE.BoxGeometry(0.1, 0.1, 0.1);
      case ObjectType.Sphere:
        return new THREE.SphereGeometry(0.05, 32, 32);
      case ObjectType.Cylinder:
        return new THREE.CylinderGeometry(0.05, 0.05, 0.1, 32);
      case ObjectType.Cone:
        return new THREE.ConeGeometry(0.05, 0.1, 32);
      case ObjectType.Torus:
        return new THREE.TorusGeometry(0.04, 0.015, 16, 100);
      default:
        return new THREE.BoxGeometry(0.1, 0.1, 0.1);
    }
  }, [type]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      scale={scale}
    />
  );
}

interface GLTFObjectProps {
  url: string;
  color: string;
  isSelected: boolean;
  scale: THREE.Vector3;
}

function GLTFObject({ url, color, isSelected, scale }: GLTFObjectProps) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = getMaterial(color, isSelected);
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene, color, isSelected]);

  return <primitive object={scene.clone()} scale={scale} />;
}

function SelectionHighlight({ children }: { children: React.ReactNode }) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const pulse = Math.sin(time * 3) * 0.1 + 0.9;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={meshRef}>
      {children}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.15}
          wireframe
        />
      </mesh>
    </group>
  );
}

export function ARObject({
  object,
  isSelected,
  onSelect,
  enableControls = true,
}: ARObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const currentPosition = useRef(new THREE.Vector3());
  const currentRotation = useRef(new THREE.Quaternion());
  const currentScale = useRef(new THREE.Vector3());

  const roomId = useStore((s) => s.currentRoom?.id);

  const position = useMemo(
    () => new THREE.Vector3(object.position.x, object.position.y, object.position.z),
    [object.position.x, object.position.y, object.position.z]
  );

  const rotation = useMemo(
    () =>
      new THREE.Quaternion(
        object.rotation.x,
        object.rotation.y,
        object.rotation.z,
        object.rotation.w
      ),
    [object.rotation.x, object.rotation.y, object.rotation.z, object.rotation.w]
  );

  const scale = useMemo(
    () => new THREE.Vector3(object.scale.x, object.scale.y, object.scale.z),
    [object.scale.x, object.scale.y, object.scale.z]
  );

  useEffect(() => {
    currentPosition.current.copy(position);
    currentRotation.current.copy(rotation);
    currentScale.current.copy(scale);
  }, [position, rotation, scale]);

  useFrame(() => {
    if (!groupRef.current) return;

    if (!isDragging) {
      groupRef.current.position.lerp(position, 0.1);
      const targetQ = new THREE.Quaternion().copy(rotation);
      groupRef.current.quaternion.slerp(targetQ, 0.1);
      groupRef.current.scale.lerp(scale, 0.1);
    }
  });

  const handlePointerDown = (e: any) => {
    if (!enableControls || object.locked) return;
    e.stopPropagation();
    setIsDragging(true);
    onSelect();
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerUp = (e: any) => {
    if (!isDragging || !roomId) return;
    setIsDragging(false);
    (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);

    if (groupRef.current) {
      const pos = groupRef.current.position;
      const quat = groupRef.current.quaternion;
      const scl = groupRef.current.scale;

      updateObjectService(roomId, object.id, {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
        scale: { x: scl.x, y: scl.y, z: scl.z },
      });
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging || !groupRef.current) return;
    e.stopPropagation();

    const intersection = (e as any).intersections?.[0];
    if (intersection) {
      groupRef.current.position.copy(intersection.point);
    }
  };

  if (!object.visible) return null;

  const isGLTF = object.type === ObjectType.GLTFModel || object.type === ObjectType.CustomModel;

  return (
    <group
      ref={groupRef}
      position={[position.x, position.y, position.z]}
      quaternion={rotation}
      scale={[scale.x, scale.y, scale.z]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {isSelected && <SelectionHighlight>
        {isGLTF && object.modelUrl ? (
          <GLTFObject
            url={object.modelUrl}
            color={object.color}
            isSelected={isSelected}
            scale={new THREE.Vector3(1, 1, 1)}
          />
        ) : (
          <GeometryObject
            type={object.type}
            color={object.color}
            isSelected={isSelected}
            scale={new THREE.Vector3(1, 1, 1)}
          />
        )}
      </SelectionHighlight>}

      {!isSelected && (
        isGLTF && object.modelUrl ? (
          <GLTFObject
            url={object.modelUrl}
            color={object.color}
            isSelected={isSelected}
            scale={new THREE.Vector3(1, 1, 1)}
          />
        ) : (
          <GeometryObject
            type={object.type}
            color={object.color}
            isSelected={isSelected}
            scale={new THREE.Vector3(1, 1, 1)}
          />
        )
      )}

      {isDragging && (
        <mesh position={[0, -0.05, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.02, 0.03, 32]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

export default ARObject;