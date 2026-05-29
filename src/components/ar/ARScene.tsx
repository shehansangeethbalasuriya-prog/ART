import { useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, useXR, startSession, stopSession } from '@react-three/xr';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../lib/store';
import { HitTestReticle } from './HitTestReticle';
import { ARObject } from './ARObject';
import { PlaneDetection } from './PlaneDetection';
import { ObjectPlacer } from './ObjectPlacer';
import { ARControls } from './ARControls';
import { subscribeToObjects } from '../../services/objectService';
import { ARSessionState } from '../../types';

interface ARSceneProps {
  roomId: string;
  className?: string;
}

function SessionManager() {
  const isPresenting = useXR((s) => s.isPresenting);
  const arSessionState = useStore((s) => s.arSessionState);
  const setARSessionState = useStore((s) => s.setARSessionState);

  useEffect(() => {
    if (arSessionState === ARSessionState.Initializing && !isPresenting) {
      startSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'anchors', 'plane-detection'],
      })
        .then(() => setARSessionState(ARSessionState.Running))
        .catch((err: unknown) => {
          console.error('Failed to enter AR:', err);
          setARSessionState(ARSessionState.Error);
        });
    } else if (arSessionState === ARSessionState.Initializing && isPresenting) {
      setARSessionState(ARSessionState.Running);
    }
  }, [arSessionState, isPresenting, setARSessionState]);

  useEffect(() => {
    if (arSessionState === ARSessionState.Inactive && isPresenting) {
      stopSession().catch(console.error);
    }
  }, [arSessionState, isPresenting]);

  return null;
}

function SceneContent() {
  const { camera } = useThree();
  const objects = useStore((s) => s.objects);
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const arSessionState = useStore((s) => s.arSessionState);
  const setSelectedObjectId = useStore((s) => s.setSelectedObjectId);

  useFrame(() => {
    camera.updateMatrixWorld();
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <pointLight position={[0, 3, 0]} intensity={0.2} color="#ffffff" />

      <Environment preset="apartment" background={false} />

      {arSessionState === ARSessionState.Running && (
        <>
          <HitTestReticle />
          <PlaneDetection />
          <ObjectPlacer />
        </>
      )}

      {objects.map((obj) => (
        <ARObject
          key={obj.id}
          object={obj}
          isSelected={selectedObjectId === obj.id}
          onSelect={() => setSelectedObjectId(
            selectedObjectId === obj.id ? null : obj.id
          )}
        />
      ))}

      <ARControls />
      <fog attach="fog" args={['#000000', 10, 50]} />
    </>
  );
}

export function ARScene({ roomId, className = '' }: ARSceneProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setARSessionState = useStore((s) => s.setARSessionState);
  const setObjects = useStore((s) => s.setObjects);
  const arSessionState = useStore((s) => s.arSessionState);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToObjects(
      roomId,
      (objects) => {
        setObjects(objects);
      },
      (err) => {
        console.error('Error subscribing to objects:', err);
        setError('Failed to sync objects');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [roomId, setObjects]);

  const handleEnterAR = useCallback(async () => {
    setARSessionState(ARSessionState.Initializing);
  }, [setARSessionState]);

  const handleExitAR = useCallback(async () => {
    setARSessionState(ARSessionState.Inactive);
  }, [setARSessionState]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 ${className}`}>
        <div className="text-white text-lg">Loading AR Scene...</div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      {error && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-red-500/90 text-white p-4 rounded-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-white/80 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [0, 1.6, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#000000'), 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <XR>
          <SessionManager />
          <SceneContent />
        </XR>
      </Canvas>

      {arSessionState !== ARSessionState.Running ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleEnterAR}
            disabled={arSessionState === ARSessionState.Initializing}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl
              shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-all duration-200
              active:scale-95 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {arSessionState === ARSessionState.Initializing ? 'Initializing...' : 'Enter AR'}
          </button>
        </div>
      ) : (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleExitAR}
            className="px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-xl
              border border-white/20 hover:bg-white/20 transition-all duration-200
              active:scale-95 font-medium"
          >
            Exit AR
          </button>
        </div>
      )}
    </div>
  );
}

export default ARScene;
