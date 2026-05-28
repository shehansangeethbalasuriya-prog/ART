import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Vector3, RoomObject } from '../types';

interface ARSessionState {
  isSessionActive: boolean;
  sessionState: 'inactive' | 'running' | 'interrupted' | 'ended';
  arSupported: boolean;
}

interface HitTestState {
  reticlePosition: Vector3 | null;
  reticleRotation: Vector3 | null;
  isHitTesting: boolean;
}

interface CameraState {
  position: Vector3;
  rotation: Vector3;
  fov: number;
}

interface ARStoreState {
  session: ARSessionState;
  hitTest: HitTestState;
  camera: CameraState;
  selectedObject: RoomObject | null;
  isPlacingObject: boolean;
  placingModelUrl: string | null;

  startSession: () => void;
  stopSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  setSessionState: (
    state: ARSessionState['sessionState']
  ) => void;
  setARSupported: (supported: boolean) => void;

  setReticlePosition: (position: Vector3 | null) => void;
  setReticleRotation: (rotation: Vector3 | null) => void;
  setHitTesting: (testing: boolean) => void;
  clearHitTest: () => void;

  setCameraPosition: (position: Vector3) => void;
  setCameraRotation: (rotation: Vector3) => void;
  setCameraFOV: (fov: number) => void;
  updateCamera: (updates: Partial<CameraState>) => void;

  selectObject: (object: RoomObject | null) => void;
  clearSelection: () => void;

  startPlacingObject: (modelUrl: string) => void;
  cancelPlacingObject: () => void;
  finishPlacingObject: () => void;

  reset: () => void;
}

const initialCameraState: CameraState = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  fov: 60,
};

const initialState = {
  session: {
    isSessionActive: false,
    sessionState: 'inactive' as const,
    arSupported: false,
  },
  hitTest: {
    reticlePosition: null,
    reticleRotation: null,
    isHitTesting: false,
  },
  camera: initialCameraState,
  selectedObject: null,
  isPlacingObject: false,
  placingModelUrl: null,
};

export const useARStore = create<ARStoreState>()(
  devtools(
    (set) => ({
      ...initialState,

      startSession: () =>
        set(
          {
            session: {
              isSessionActive: true,
              sessionState: 'running',
              arSupported: true,
            },
          },
          false,
          'startSession'
        ),

      stopSession: () =>
        set(
          {
            session: {
              isSessionActive: false,
              sessionState: 'ended',
              arSupported: true,
            },
            hitTest: initialState.hitTest,
            selectedObject: null,
            isPlacingObject: false,
            placingModelUrl: null,
          },
          false,
          'stopSession'
        ),

      pauseSession: () =>
        set(
          (state) => ({
            session: {
              ...state.session,
              sessionState: 'interrupted',
            },
          }),
          false,
          'pauseSession'
        ),

      resumeSession: () =>
        set(
          (state) => ({
            session: {
              ...state.session,
              sessionState: 'running',
            },
          }),
          false,
          'resumeSession'
        ),

      setSessionState: (sessionState) =>
        set(
          (state) => ({
            session: {
              ...state.session,
              sessionState,
              isSessionActive: sessionState === 'running',
            },
          }),
          false,
          'setSessionState'
        ),

      setARSupported: (supported) =>
        set(
          (state) => ({
            session: {
              ...state.session,
              arSupported: supported,
            },
          }),
          false,
          'setARSupported'
        ),

      setReticlePosition: (position) =>
        set(
          (state) => ({
            hitTest: {
              ...state.hitTest,
              reticlePosition: position,
            },
          }),
          false,
          'setReticlePosition'
        ),

      setReticleRotation: (rotation) =>
        set(
          (state) => ({
            hitTest: {
              ...state.hitTest,
              reticleRotation: rotation,
            },
          }),
          false,
          'setReticleRotation'
        ),

      setHitTesting: (testing) =>
        set(
          (state) => ({
            hitTest: {
              ...state.hitTest,
              isHitTesting: testing,
            },
          }),
          false,
          'setHitTesting'
        ),

      clearHitTest: () =>
        set(
          (state) => ({
            hitTest: {
              reticlePosition: null,
              reticleRotation: null,
              isHitTesting: false,
            },
          }),
          false,
          'clearHitTest'
        ),

      setCameraPosition: (position) =>
        set(
          (state) => ({
            camera: {
              ...state.camera,
              position,
            },
          }),
          false,
          'setCameraPosition'
        ),

      setCameraRotation: (rotation) =>
        set(
          (state) => ({
            camera: {
              ...state.camera,
              rotation,
            },
          }),
          false,
          'setCameraRotation'
        ),

      setCameraFOV: (fov) =>
        set(
          (state) => ({
            camera: {
              ...state.camera,
              fov: Math.max(30, Math.min(120, fov)),
            },
          }),
          false,
          'setCameraFOV'
        ),

      updateCamera: (updates) =>
        set(
          (state) => ({
            camera: {
              ...state.camera,
              ...updates,
            },
          }),
          false,
          'updateCamera'
        ),

      selectObject: (object) =>
        set(
          { selectedObject: object },
          false,
          'selectObject'
        ),

      clearSelection: () =>
        set(
          { selectedObject: null },
          false,
          'clearSelection'
        ),

      startPlacingObject: (modelUrl) =>
        set(
          {
            isPlacingObject: true,
            placingModelUrl: modelUrl,
            selectedObject: null,
          },
          false,
          'startPlacingObject'
        ),

      cancelPlacingObject: () =>
        set(
          {
            isPlacingObject: false,
            placingModelUrl: null,
          },
          false,
          'cancelPlacingObject'
        ),

      finishPlacingObject: () =>
        set(
          {
            isPlacingObject: false,
            placingModelUrl: null,
          },
          false,
          'finishPlacingObject'
        ),

      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'ARStore' }
  )
);

export default useARStore;
