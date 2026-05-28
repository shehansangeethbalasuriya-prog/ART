import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../lib/store';
import { createObject } from '../../services/objectService';
import { ObjectType } from '../../types';
import type { ARObject, Vector3Data, QuaternionData } from '../../types';

interface ObjectPlacerProps {
  isActive?: boolean;
  objectType?: ObjectType;
  objectColor?: string;
  objectName?: string;
  modelUrl?: string | null;
  previewOpacity?: number;
  previewScale?: number;
}

interface PreviewMeshProps {
  type: ObjectType;
  color: string;
  opacity: number;
  scale: number;
}

function PreviewMesh({ type, color, opacity, scale }: PreviewMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const pulse = Math.sin(time * 2) * 0.1 + 0.9;
    meshRef.current.scale.setScalar(scale * pulse);
  });

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

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity,
        wireframe: true,
      }),
    [color, opacity]
  );

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}

export function ObjectPlacer({
  isActive = false,
  objectType = ObjectType.Cube,
  objectColor = '#ffffff',
  objectName = 'New Object',
  modelUrl = null,
  previewOpacity = 0.5,
  previewScale = 1,
}: ObjectPlacerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  const localPosition = useStore((s) => s.localPosition);
  const localRotation = useStore((s) => s.localRotation);
  const currentRoom = useStore((s) => s.currentRoom);
  const user = useStore((s) => s.user);
  const addObject = useStore((s) => s.addObject);

  const position = useMemo(
    () => new THREE.Vector3(localPosition.x, localPosition.y, localPosition.z),
    [localPosition.x, localPosition.y, localPosition.z]
  );

  const rotation = useMemo(
    () =>
      new THREE.Quaternion(
        localRotation.x,
        localRotation.y,
        localRotation.z,
        localRotation.w
      ),
    [localRotation.x, localRotation.y, localRotation.z, localRotation.w]
  );

  useFrame(() => {
    if (!groupRef.current || !isActive) return;

    groupRef.current.position.lerp(position, 0.2);
    groupRef.current.quaternion.slerp(rotation, 0.2);
  });

  const handlePlace = useCallback(async () => {
    if (!currentRoom?.id || !user?.id || !isActive) return;

    setIsPlacing(true);

    try {
      const newObject: Omit<ARObject, 'id' | 'createdAt' | 'updatedAt'> = {
        type: objectType,
        modelUrl: modelUrl || null,
        position: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        rotation: {
          x: rotation.x,
          y: rotation.y,
          z: rotation.z,
          w: rotation.w,
        },
        scale: { x: 1, y: 1, z: 1 },
        ownerId: user.id,
        roomId: currentRoom.id,
        color: objectColor,
        name: objectName,
        visible: true,
        locked: false,
      };

      const createdObject = await createObject(currentRoom.id, newObject);
      addObject(createdObject);
    } catch (err) {
      console.error('Failed to place object:', err);
    } finally {
      setIsPlacing(false);
    }
  }, [
    currentRoom?.id,
    user?.id,
    isActive,
    objectType,
    modelUrl,
    position,
    rotation,
    objectColor,
    objectName,
    addObject,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isActive && !isPlacing) {
        e.preventDefault();
        handlePlace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isPlacing, handlePlace]);

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      <PreviewMesh
        type={objectType}
        color={objectColor}
        opacity={previewOpacity}
        scale={previewScale}
      />

      <mesh position-y={0.01} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.08, 0.1, 6]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group position-y={0.001} rotation-x={-Math.PI / 2}>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i * Math.PI) / 2;
          const x = Math.cos(angle) * 0.06;
          const y = Math.sin(angle) * 0.06;
          return (
            <mesh key={i} position={[x, y, 0]}>
              <circleGeometry args={[0.005, 16]} />
              <meshBasicMaterial color="#00ffff" transparent opacity={0.6} />
            </mesh>
          );
        })}
      </group>

      <pointLight position={[0, 0.1, 0]} intensity={0.3} color="#00ffff" distance={0.3} />
    </group>
  );
}

export default ObjectPlacer;