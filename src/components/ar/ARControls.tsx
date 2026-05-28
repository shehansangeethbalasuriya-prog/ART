import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../lib/store';
import { deleteObject, updateObject as updateObjectService } from '../../services/objectService';

interface TouchState {
  identifier: number;
  position: THREE.Vector2;
}

interface ARControlsProps {
  enableDrag?: boolean;
  enablePinch?: boolean;
  enableRotate?: boolean;
  doubleTapDelay?: number;
  dragThreshold?: number;
}

export function ARControls({
  enableDrag = true,
  enablePinch = true,
  enableRotate = true,
  doubleTapDelay = 300,
  dragThreshold = 0.01,
}: ARControlsProps) {
  const { gl, camera, scene } = useThree();
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const currentRoom = useStore((s) => s.currentRoom);
  const setSelectedObjectId = useStore((s) => s.setSelectedObjectId);
  const removeObject = useStore((s) => s.removeObject);

  const touchesRef = useRef<Map<number, TouchState>>(new Map());
  const lastTapTimeRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<THREE.Vector3 | null>(null);
  const initialPinchDistanceRef = useRef<number>(0);
  const initialObjectScaleRef = useRef<THREE.Vector3 | null>(null);

  const raycaster = useRef(new THREE.Raycaster());

  const getTouchPosition = useCallback((touch: Touch): THREE.Vector2 => {
    const rect = gl.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((touch.clientX - rect.left) / rect.width) * 2 - 1,
      -((touch.clientY - rect.top) / rect.height) * 2 + 1
    );
  }, [gl]);

  const getIntersectedObject = useCallback(
    (position: THREE.Vector2): THREE.Object3D | null => {
      raycaster.current.setFromCamera(position, camera);
      const intersects = raycaster.current.intersectObjects(scene.children, true);

      for (const intersect of intersects) {
        let obj: THREE.Object3D | null = intersect.object;
        while (obj) {
          if ((obj as any).userData?.objectId) {
            return obj;
          }
          obj = obj.parent;
        }
      }
      return null;
    },
    [camera, scene]
  );

  const handleTap = useCallback(
    (position: THREE.Vector2) => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      lastTapTimeRef.current = now;

      const intersectedObj = getIntersectedObject(position);

      if (intersectedObj) {
        const objectId = (intersectedObj as any).userData?.objectId;

        if (timeSinceLastTap < doubleTapDelay && objectId === selectedObjectId) {
          handleDoubleTap(objectId);
          return;
        }

        setSelectedObjectId(objectId);
      } else {
        setSelectedObjectId(null);
      }
    },
    [getIntersectedObject, selectedObjectId, setSelectedObjectId, doubleTapDelay]
  );

  const handleDoubleTap = useCallback(
    async (objectId: string) => {
      if (!currentRoom?.id) return;

      try {
        await deleteObject(currentRoom.id, objectId);
        removeObject(objectId);
        setSelectedObjectId(null);
      } catch (err) {
        console.error('Failed to delete object:', err);
      }
    },
    [currentRoom?.id, removeObject, setSelectedObjectId]
  );

  const handleDragStart = useCallback(
    (position: THREE.Vector2) => {
      if (!selectedObjectId || !enableDrag) return;

      const intersectedObj = getIntersectedObject(position);
      if (intersectedObj) {
        isDraggingRef.current = true;
        dragStartRef.current = intersectedObj.position.clone();
      }
    },
    [selectedObjectId, enableDrag, getIntersectedObject]
  );

  const handleDragMove = useCallback(
    (position: THREE.Vector2) => {
      if (!isDraggingRef.current || !selectedObjectId) return;

      raycaster.current.setFromCamera(position, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPoint = new THREE.Vector3();

      raycaster.current.ray.intersectPlane(plane, intersectPoint);
      if (intersectPoint) {
        const selectedObj = scene.getObjectByProperty('uuid', selectedObjectId);
        if (selectedObj) {
          selectedObj.position.copy(intersectPoint);
        }
      }
    },
    [selectedObjectId, camera, scene]
  );

  const handleDragEnd = useCallback(async () => {
    if (!isDraggingRef.current || !selectedObjectId || !currentRoom?.id) {
      isDraggingRef.current = false;
      return;
    }

    const selectedObj = scene.getObjectByProperty('uuid', selectedObjectId);
    if (selectedObj) {
      try {
        await updateObjectService(currentRoom.id, selectedObjectId, {
          position: {
            x: selectedObj.position.x,
            y: selectedObj.position.y,
            z: selectedObj.position.z,
          },
        });
      } catch (err) {
        console.error('Failed to update object position:', err);
      }
    }

    isDraggingRef.current = false;
    dragStartRef.current = null;
  }, [selectedObjectId, currentRoom?.id, scene]);

  const handlePinchStart = useCallback(
    (touch1: THREE.Vector2, touch2: THREE.Vector2) => {
      if (!selectedObjectId || !enablePinch) return;

      initialPinchDistanceRef.current = touch1.distanceTo(touch2);

      const selectedObj = scene.getObjectByProperty('uuid', selectedObjectId);
      if (selectedObj) {
        initialObjectScaleRef.current = selectedObj.scale.clone();
      }
    },
    [selectedObjectId, enablePinch, scene]
  );

  const handlePinchMove = useCallback(
    (touch1: THREE.Vector2, touch2: THREE.Vector2) => {
      if (!selectedObjectId || !initialObjectScaleRef.current) return;

      const currentDistance = touch1.distanceTo(touch2);
      const scale = currentDistance / initialPinchDistanceRef.current;

      const selectedObj = scene.getObjectByProperty('uuid', selectedObjectId);
      if (selectedObj) {
        const newScale = initialObjectScaleRef.current.clone().multiplyScalar(scale);
        newScale.clampScalar(0.1, 3.0);
        selectedObj.scale.copy(newScale);
      }
    },
    [selectedObjectId, scene]
  );

  const handlePinchEnd = useCallback(async () => {
    if (!selectedObjectId || !currentRoom?.id) return;

    const selectedObj = scene.getObjectByProperty('uuid', selectedObjectId);
    if (selectedObj) {
      try {
        await updateObjectService(currentRoom.id, selectedObjectId, {
          scale: {
            x: selectedObj.scale.x,
            y: selectedObj.scale.y,
            z: selectedObj.scale.z,
          },
        });
      } catch (err) {
        console.error('Failed to update object scale:', err);
      }
    }

    initialPinchDistanceRef.current = 0;
    initialObjectScaleRef.current = null;
  }, [selectedObjectId, currentRoom?.id, scene]);

  const handleRotateStart = useCallback(
    (touch1: THREE.Vector2, touch2: THREE.Vector2) => {
      if (!selectedObjectId || !enableRotate) return;
    },
    [selectedObjectId, enableRotate]
  );

  const handleRotateMove = useCallback(
    (touch1: THREE.Vector2, touch2: THREE.Vector2) => {
      if (!selectedObjectId) return;

      const selectedObj = scene.getObjectByProperty('uuid', selectedObjectId);
      if (selectedObj) {
        const angle = Math.atan2(touch2.y - touch1.y, touch2.x - touch1.x);
        selectedObj.rotation.y = angle;
      }
    },
    [selectedObjectId, scene]
  );

  useEffect(() => {
    const canvas = gl.domElement;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();

      for (const touch of Array.from(e.changedTouches)) {
        touchesRef.current.set(touch.identifier, {
          identifier: touch.identifier,
          position: getTouchPosition(touch),
        });
      }

      if (touchesRef.current.size === 1) {
        const touch = Array.from(touchesRef.current.values())[0];
        handleTap(touch.position);
        handleDragStart(touch.position);
      } else if (touchesRef.current.size === 2 && enablePinch) {
        const touches = Array.from(touchesRef.current.values());
        handlePinchStart(touches[0].position, touches[1].position);
        handleRotateStart(touches[0].position, touches[1].position);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      for (const touch of Array.from(e.changedTouches)) {
        const existing = touchesRef.current.get(touch.identifier);
        if (existing) {
          existing.position = getTouchPosition(touch);
        }
      }

      if (touchesRef.current.size === 1) {
        const touch = Array.from(touchesRef.current.values())[0];
        handleDragMove(touch.position);
      } else if (touchesRef.current.size === 2 && enablePinch) {
        const touches = Array.from(touchesRef.current.values());
        handlePinchMove(touches[0].position, touches[1].position);
        handleRotateMove(touches[0].position, touches[1].position);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      for (const touch of Array.from(e.changedTouches)) {
        touchesRef.current.delete(touch.identifier);
      }

      if (touchesRef.current.size === 0) {
        handleDragEnd();
        if (enablePinch) {
          handlePinchEnd();
        }
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [
    gl,
    getTouchPosition,
    handleTap,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    handleRotateStart,
    handleRotateMove,
    enablePinch,
  ]);

  return null;
}

export default ARControls;