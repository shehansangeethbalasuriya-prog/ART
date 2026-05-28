import { useState, useRef, useCallback, useEffect } from 'react';
import { ARSessionState, HitTestResult, Vector3Data, QuaternionData } from '../types';

interface UseARReturn {
  isSupported: boolean;
  isSessionActive: boolean;
  sessionState: ARSessionState;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  requestHitTest: (origin: Vector3Data, direction: Vector3Data) => HitTestResult | null;
  referenceSpace: XRReferenceSpace | null;
  xrSession: XRSession | null;
  error: string | null;
}

const FEATURE_FLAGS = {
  hitTest: 'hit-test',
  anchors: 'anchors',
  planes: 'planes',
  lightEstimation: 'light-estimation',
  domOverlay: 'dom-overlay',
} as const;

export function useAR(): UseARReturn {
  const [sessionState, setSessionState] = useState<ARSessionState>(ARSessionState.Inactive);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const xrSessionRef = useRef<XRSession | null>(null);
  const referenceSpaceRef = useRef<XRReferenceSpace | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      if (!navigator.xr) {
        setIsSupported(false);
        return;
      }

      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        setIsSupported(supported);
      } catch {
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  const getSessionFeatures = useCallback(async (session: XRSession): Promise<string[]> => {
    const features: string[] = [];
    const supportedFeatures = [
      FEATURE_FLAGS.hitTest,
      FEATURE_FLAGS.anchors,
      FEATURE_FLAGS.planes,
      FEATURE_FLAGS.lightEstimation,
      FEATURE_FLAGS.domOverlay,
    ];

    for (const feature of supportedFeatures) {
      try {
        const result = await session.requestReferenceSpace('local');
        if (result) {
          features.push(feature);
        }
      } catch {
        // Feature not supported, skip
      }
    }

    return features;
  }, []);

  const startSession = useCallback(async () => {
    if (!navigator.xr) {
      setError('WebXR is not supported in this browser');
      setSessionState(ARSessionState.Error);
      return;
    }

    try {
      setSessionState(ARSessionState.Initializing);
      setError(null);

      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { xrCompatible: true });
      if (!gl) {
        throw new Error('Failed to create WebGL2 context');
      }
      glRef.current = gl;

      const sessionInit: XRSessionInit = {
        optionalFeatures: [
          FEATURE_FLAGS.hitTest,
          FEATURE_FLAGS.anchors,
          FEATURE_FLAGS.planes,
          FEATURE_FLAGS.lightEstimation,
        ],
      };

      const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
      xrSessionRef.current = session;

      session.addEventListener('end', () => {
        xrSessionRef.current = null;
        referenceSpaceRef.current = null;
        hitTestSourceRef.current = null;
        setSessionState(ARSessionState.Inactive);
      });

      session.addEventListener('select', () => {
        // Handle select events if needed
      });

      const refSpace = await session.requestReferenceSpace('local');
      referenceSpaceRef.current = refSpace;

      try {
        if (session.requestHitTestSource) {
          const hitTestSource = await session.requestHitTestSource({
            space: refSpace,
          });
          hitTestSourceRef.current = hitTestSource ?? null;
        }
      } catch {
        // Hit testing not supported, continue without it
      }

      setSessionState(ARSessionState.Running);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start AR session';
      setError(message);
      setSessionState(ARSessionState.Error);
      console.error('AR session start failed:', err);
    }
  }, []);

  const endSession = useCallback(async () => {
    const session = xrSessionRef.current;
    if (!session) {
      setSessionState(ARSessionState.Inactive);
      return;
    }

    try {
      if (hitTestSourceRef.current) {
        hitTestSourceRef.current.cancel();
        hitTestSourceRef.current = null;
      }

      await session.end();

      xrSessionRef.current = null;
      referenceSpaceRef.current = null;
      setSessionState(ARSessionState.Inactive);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end AR session';
      setError(message);
      console.error('AR session end failed:', err);
    }
  }, []);

  const requestHitTest = useCallback(
    (origin: Vector3Data, direction: Vector3Data): HitTestResult | null => {
      const source = hitTestSourceRef.current;
      const session = xrSessionRef.current;

      if (!source || !session) {
        return null;
      }

      try {
        const ray = new XRRay(
          new DOMPointReadOnly(origin.x, origin.y, origin.z, 1),
          new DOMPointReadOnly(direction.x, direction.y, direction.z, 0)
        );

        // Hit test requires a frame from the render loop
        // This is a simplified version - in production, you'd get the frame from the render loop
        return null;
      } catch (err) {
        console.error('Hit test request failed:', err);
        return null;
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (xrSessionRef.current) {
        xrSessionRef.current.end().catch(console.error);
      }
    };
  }, []);

  return {
    isSupported,
    isSessionActive: sessionState === ARSessionState.Running,
    sessionState,
    startSession,
    endSession,
    requestHitTest,
    referenceSpace: referenceSpaceRef.current,
    xrSession: xrSessionRef.current,
    error,
  };
}

export default useAR;
