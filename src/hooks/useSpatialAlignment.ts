import { useState, useCallback, useRef, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import QRCode from 'qrcode';
import { db } from '../firebase/config';
import { SpatialAnchor, Vector3Data, QuaternionData } from '../types';

interface AlignmentData {
  anchorId: string;
  position: Vector3Data;
  rotation: QuaternionData;
  qrCode: string;
  imageUrl: string | null;
  createdAt: number;
}

interface UseSpatialAlignmentReturn {
  generateAlignment: (roomId: string) => Promise<AlignmentData>;
  scanAlignment: (qrData: string) => Promise<SpatialAnchor | null>;
  calculateAlignment: (
    scannedAnchor: SpatialAnchor,
    localPosition: Vector3Data,
    localRotation: QuaternionData
  ) => { position: Vector3Data; rotation: QuaternionData };
  isAligned: boolean;
  alignmentMatrix: Float32Array | null;
  currentAnchor: SpatialAnchor | null;
  anchors: SpatialAnchor[];
  error: string | null;
}

const ANCHORS_COLLECTION = 'spatial_anchors';

export function useSpatialAlignment(roomId: string | null): UseSpatialAlignmentReturn {
  const [isAligned, setIsAligned] = useState(false);
  const [alignmentMatrix, setAlignmentMatrix] = useState<Float32Array | null>(null);
  const [currentAnchor, setCurrentAnchor] = useState<SpatialAnchor | null>(null);
  const [anchors, setAnchors] = useState<SpatialAnchor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!roomId) {
      setAnchors([]);
      setCurrentAnchor(null);
      setIsAligned(false);
      setAlignmentMatrix(null);
      return;
    }

    if (unsubRef.current) {
      unsubRef.current();
    }

    const q = query(
      collection(db, ANCHORS_COLLECTION),
      where('roomId', '==', roomId)
    );

    unsubRef.current = onSnapshot(
      q,
      (snapshot) => {
        const anchorsData = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as SpatialAnchor
        );
        setAnchors(anchorsData);

        if (anchorsData.length > 0 && !currentAnchor) {
          setCurrentAnchor(anchorsData[0]);
          setIsAligned(true);
        }
      },
      (err) => {
        console.error('Anchors subscription error:', err);
        setError('Failed to sync spatial anchors');
      }
    );

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
      }
    };
  }, [roomId, currentAnchor]);

  const generateAlignment = useCallback(
    async (targetRoomId: string): Promise<AlignmentData> => {
      setError(null);

      try {
        const anchorId = `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const qrPayload = JSON.stringify({
          type: 'spatial_anchor',
          anchorId,
          roomId: targetRoomId,
          timestamp: Date.now(),
        });

        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 256,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        const anchorData: Omit<SpatialAnchor, 'id'> = {
          roomId: targetRoomId,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          qrCode: qrPayload,
          imageUrl: qrDataUrl,
          createdAt: Date.now(),
        };

        const docRef = await addDoc(collection(db, ANCHORS_COLLECTION), {
          ...anchorData,
          createdAt: serverTimestamp(),
        });

        const newAnchor: SpatialAnchor = {
          id: docRef.id,
          ...anchorData,
        };

        setCurrentAnchor(newAnchor);
        setIsAligned(true);

        return {
          anchorId: docRef.id,
          position: newAnchor.position,
          rotation: newAnchor.rotation,
          qrCode: qrPayload,
          imageUrl: qrDataUrl,
          createdAt: newAnchor.createdAt,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate alignment';
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  const scanAlignment = useCallback(
    async (qrData: string): Promise<SpatialAnchor | null> => {
      setError(null);

      try {
        const payload = JSON.parse(qrData);

        if (payload.type !== 'spatial_anchor') {
          throw new Error('Invalid QR code: Not a spatial anchor');
        }

        const anchorsQuery = query(
          collection(db, ANCHORS_COLLECTION),
          where('roomId', '==', payload.roomId)
        );

        const snapshot = await getDocs(anchorsQuery);
        const anchorDoc = snapshot.docs.find((d) => d.id === payload.anchorId);

        if (!anchorDoc) {
          throw new Error('Spatial anchor not found');
        }

        const anchor = {
          id: anchorDoc.id,
          ...anchorDoc.data(),
        } as SpatialAnchor;

        setCurrentAnchor(anchor);
        setIsAligned(true);

        return anchor;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to scan alignment';
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  const calculateAlignment = useCallback(
    (
      scannedAnchor: SpatialAnchor,
      localPosition: Vector3Data,
      localRotation: QuaternionData
    ): { position: Vector3Data; rotation: QuaternionData } => {
      const anchorPos = scannedAnchor.position;
      const anchorRot = scannedAnchor.rotation;

      const alignedPosition: Vector3Data = {
        x: localPosition.x + anchorPos.x,
        y: localPosition.y + anchorPos.y,
        z: localPosition.z + anchorPos.z,
      };

      const alignedRotation: QuaternionData = {
        x: localRotation.x + anchorRot.x,
        y: localRotation.y + anchorRot.y,
        z: localRotation.z + anchorRot.z,
        w: localRotation.w * anchorRot.w - localRotation.x * anchorRot.x -
            localRotation.y * anchorRot.y - localRotation.z * anchorRot.z,
      };

      const norm = Math.sqrt(
        alignedRotation.x ** 2 +
        alignedRotation.y ** 2 +
        alignedRotation.z ** 2 +
        alignedRotation.w ** 2
      );

      if (norm > 0) {
        alignedRotation.x /= norm;
        alignedRotation.y /= norm;
        alignedRotation.z /= norm;
        alignedRotation.w /= norm;
      }

      const matrix = new Float32Array(16);
      const { x: qx, y: qy, z: qz, w: qw } = alignedRotation;

      matrix[0] = 1 - 2 * (qy * qy + qz * qz);
      matrix[1] = 2 * (qx * qy + qz * qw);
      matrix[2] = 2 * (qx * qz - qy * qw);
      matrix[3] = 0;

      matrix[4] = 2 * (qx * qy - qz * qw);
      matrix[5] = 1 - 2 * (qx * qx + qz * qz);
      matrix[6] = 2 * (qy * qz + qx * qw);
      matrix[7] = 0;

      matrix[8] = 2 * (qx * qz + qy * qw);
      matrix[9] = 2 * (qy * qz - qx * qw);
      matrix[10] = 1 - 2 * (qx * qx + qy * qy);
      matrix[11] = 0;

      matrix[12] = alignedPosition.x;
      matrix[13] = alignedPosition.y;
      matrix[14] = alignedPosition.z;
      matrix[15] = 1;

      setAlignmentMatrix(matrix);

      return { position: alignedPosition, rotation: alignedRotation };
    },
    []
  );

  return {
    generateAlignment,
    scanAlignment,
    calculateAlignment,
    isAligned,
    alignmentMatrix,
    currentAnchor,
    anchors,
    error,
  };
}

export default useSpatialAlignment;
