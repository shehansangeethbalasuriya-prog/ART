import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../lib/store';

interface DetectedPlane {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  polygon: THREE.Vector3[];
  orientation: 'horizontal' | 'vertical';
  confidence: number;
  lastUpdated: number;
}

interface PlaneDetectionProps {
  visible?: boolean;
  floorColor?: string;
  wallColor?: string;
  opacity?: number;
  showBoundaries?: boolean;
  minConfidence?: number;
}

function PlaneMesh({
  plane,
  color,
  opacity,
  showBoundaries,
}: {
  plane: DetectedPlane;
  color: string;
  opacity: number;
  showBoundaries: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const geometry = useMemo(() => {
    if (plane.polygon.length < 3) {
      return new THREE.PlaneGeometry(0.1, 0.1);
    }

    const shape = new THREE.Shape();
    shape.moveTo(plane.polygon[0].x, plane.polygon[0].z);

    for (let i = 1; i < plane.polygon.length; i++) {
      shape.lineTo(plane.polygon[i].x, plane.polygon[i].z);
    }

    shape.closePath();

    return new THREE.ShapeGeometry(shape);
  }, [plane.polygon]);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: hovered ? opacity * 1.5 : opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [color, opacity, hovered]
  );

  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(1.5),
        transparent: true,
        opacity: opacity * 2,
      }),
    [color, opacity]
  );

  const edgeGeometry = useMemo(() => {
    if (plane.polygon.length < 3) return null;

    const points = plane.polygon.map(
      (p) => new THREE.Vector3(p.x, p.y + 0.001, p.z)
    );
    points.push(points[0].clone());

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [plane.polygon]);

  return (
    <group
      position={[plane.position.x, plane.position.y, plane.position.z]}
      quaternion={plane.rotation}
    >
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        rotation-x={-Math.PI / 2}
        position-y={0.001}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      />
      {showBoundaries && edgeGeometry && (
        <primitive object={new THREE.Line(edgeGeometry, edgeMaterial)} />
      )}
    </group>
  );
}

export function PlaneDetection({
  visible = true,
  floorColor = '#00ff00',
  wallColor = '#0088ff',
  opacity = 0.2,
  showBoundaries = true,
  minConfidence = 0.7,
}: PlaneDetectionProps) {
  const [planes, setPlanes] = useState<DetectedPlane[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) return;

    const checkForPlanes = () => {
      const xrSession = (navigator as any).xr?.sessions;
      if (!xrSession) return;

      const activeSession = Array.from(xrSession).find((s: any) => s.visible);
      if (!activeSession) return;

      const planeSpace = (activeSession as any).planeSpace;
      if (!planeSpace) return;

      const detectedPlanes: DetectedPlane[] = [];

      try {
        const planeIterator = planeSpace.values();
        for (const plane of planeIterator) {
          const pose = plane.geometry.planes;
          if (!pose) continue;

          const vertices = plane.geometry.vertices;
          if (!vertices || vertices.length < 3) continue;

          const polygon = vertices.map(
            (v: any) => new THREE.Vector3(v.x, v.y, v.z)
          );

          const centroid = polygon.reduce(
            (acc: THREE.Vector3, p: THREE.Vector3) => acc.add(p),
            new THREE.Vector3()
          ).divideScalar(polygon.length);

          const normal = plane.geometry.normals?.[0] || new THREE.Vector3(0, 1, 0);
          const isHorizontal = normal.y > 0.7;

          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

          detectedPlanes.push({
            id: plane.id || `plane-${Math.random()}`,
            position: centroid,
            rotation: quaternion,
            polygon,
            orientation: isHorizontal ? 'horizontal' : 'vertical',
            confidence: plane.confidence || 1.0,
            lastUpdated: Date.now(),
          });
        }
      } catch (err) {
        console.warn('Failed to detect planes:', err);
      }

      if (detectedPlanes.length > 0) {
        setPlanes((prev) => {
          const updated = [...prev];

          for (const newPlane of detectedPlanes) {
            const existingIndex = updated.findIndex((p) => p.id === newPlane.id);
            if (existingIndex >= 0) {
              updated[existingIndex] = newPlane;
            } else {
              updated.push(newPlane);
            }
          }

          return updated.filter((p) => Date.now() - p.lastUpdated < 5000);
        });
      }
    };

    const interval = setInterval(checkForPlanes, 100);

    return () => {
      clearInterval(interval);
      setPlanes([]);
    };
  }, [visible]);

  if (!visible || planes.length === 0) return null;

  return (
    <group>
      {planes
        .filter((plane) => plane.confidence >= minConfidence)
        .map((plane) => (
          <PlaneMesh
            key={plane.id}
            plane={plane}
            color={plane.orientation === 'horizontal' ? floorColor : wallColor}
            opacity={opacity}
            showBoundaries={showBoundaries}
          />
        ))}
    </group>
  );
}

export default PlaneDetection;