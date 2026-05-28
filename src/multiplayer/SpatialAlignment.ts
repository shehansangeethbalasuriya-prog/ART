import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  QRCodeManager,
  CoordinateSystem,
  type QRCodeData,
  type AlignmentTransform,
} from '../services/spatialService';
import type { Vector3, Matrix4, AlignmentData } from '../types';

const ALIGNMENT_SUBCOLLECTION = 'alignment';

export interface AlignmentState {
  isAligned: boolean;
  alignmentMatrix: AlignmentTransform | null;
  confidence: number;
  alignedAt: number | null;
  partnerUserId: string | null;
}

export type AlignmentStateCallback = (state: AlignmentState) => void;
export type AlignmentRequestCallback = (request: AlignmentRequest) => void;

export interface AlignmentRequest {
  fromUserId: string;
  toUserId: string;
  qrData: QRCodeData;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
}

export interface AlignmentSession {
  sessionId: string;
  participants: string[];
  originUserId: string;
  alignmentData: AlignmentTransform;
  createdAt: number;
  expiresAt: number;
}

export class SpatialAlignmentManager {
  private roomId: string;
  private userId: string;
  private alignmentState: AlignmentState = {
    isAligned: false,
    alignmentMatrix: null,
    confidence: 0,
    alignedAt: null,
    partnerUserId: null,
  };
  private stateCallbacks: AlignmentStateCallback[] = [];
  private requestCallbacks: AlignmentRequestCallback[] = [];
  private unsubscribe: Unsubscribe | null = null;
  private alignmentSessions: Map<string, AlignmentSession> = new Map();
  private pendingRequests: Map<string, AlignmentRequest> = new Map();
  private positionHistory: Vector3[] = [];
  private readonly POSITION_HISTORY_SIZE = 10;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.setupListener();
  }

  private setupListener(): void {
    const alignmentRef = collection(
      db,
      'rooms',
      this.roomId,
      ALIGNMENT_SUBCOLLECTION
    );

    this.unsubscribe = onSnapshot(alignmentRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();

        if (change.type === 'added' || change.type === 'modified') {
          this.processAlignmentData(data);
        }
      });
    });
  }

  initiateAlignment(qrCodeData: QRCodeData): AlignmentRequest {
    const request: AlignmentRequest = {
      fromUserId: this.userId,
      toUserId: '',
      qrData: qrCodeData,
      timestamp: Date.now(),
      status: 'pending',
    };

    this.pendingRequests.set(qrCodeData.nonce, request);
    this.saveAlignmentRequest(request);

    return request;
  }

  private async saveAlignmentRequest(
    request: AlignmentRequest
  ): Promise<void> {
    const requestRef = doc(
      db,
      'rooms',
      this.roomId,
      ALIGNMENT_SUBCOLLECTION,
      `request-${request.qrData.nonce}`
    );

    await setDoc(requestRef, {
      ...request,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  processAlignment(alignmentData: AlignmentData): AlignmentState {
    const { position, rotation, confidence } = alignmentData;

    if (confidence < 0.3) {
      return {
        ...this.alignmentState,
        isAligned: false,
        confidence,
      };
    }

    this.alignmentState = {
      isAligned: true,
      alignmentMatrix: {
        rotation: rotation as unknown as Matrix4,
        translation: position,
        scale: { x: 1, y: 1, z: 1 },
        confidence,
      },
      confidence,
      alignedAt: Date.now(),
      partnerUserId: null,
    };

    this.saveAlignmentState(this.alignmentState);
    this.notifyStateCallbacks();

    return this.alignmentState;
  }

  private async saveAlignmentState(
    state: AlignmentState
  ): Promise<void> {
    const stateRef = doc(
      db,
      'rooms',
      this.roomId,
      ALIGNMENT_SUBCOLLECTION,
      `state-${this.userId}`
    );

    await setDoc(stateRef, {
      ...state,
      userId: this.userId,
      updatedAt: serverTimestamp(),
    });
  }

  private processAlignmentData(data: DocumentData): void {
    if (data.type === 'alignment-state' && data.userId !== this.userId) {
      const partnerState = data as AlignmentState;

      if (partnerState.isAligned && partnerState.alignmentMatrix) {
        this.alignmentState = {
          isAligned: true,
          alignmentMatrix: partnerState.alignmentMatrix,
          confidence: partnerState.confidence,
          alignedAt: partnerState.alignedAt,
          partnerUserId: data.userId,
        };

        this.notifyStateCallbacks();
      }
    } else if (data.type === 'alignment-request') {
      const request = data as AlignmentRequest;
      if (request.toUserId === this.userId || !request.toUserId) {
        this.requestCallbacks.forEach((cb) => cb(request));
      }
    }
  }

  getAlignmentMatrix(): AlignmentTransform | null {
    return this.alignmentState.alignmentMatrix;
  }

  isAligned(): boolean {
    return this.alignmentState.isAligned;
  }

  getAlignmentState(): AlignmentState {
    return { ...this.alignmentState };
  }

  resetAlignment(): void {
    this.alignmentState = {
      isAligned: false,
      alignmentMatrix: null,
      confidence: 0,
      alignedAt: null,
      partnerUserId: null,
    };

    this.positionHistory = [];
    this.pendingRequests.clear();
    this.alignmentSessions.clear();

    this.clearAlignmentState();
    this.notifyStateCallbacks();
  }

  private async clearAlignmentState(): Promise<void> {
    const stateRef = doc(
      db,
      'rooms',
      this.roomId,
      ALIGNMENT_SUBCOLLECTION,
      `state-${this.userId}`
    );

    await setDoc(stateRef, {
      isAligned: false,
      alignmentMatrix: null,
      confidence: 0,
      alignedAt: null,
      partnerUserId: null,
      userId: this.userId,
      updatedAt: serverTimestamp(),
    });
  }

  transformPosition(position: Vector3): Vector3 {
    if (!this.alignmentState.alignmentMatrix) {
      return position;
    }

    return CoordinateSystem.alignToSharedOrigin(
      position,
      this.alignmentState.alignmentMatrix
    );
  }

  transformToPartnerSpace(position: Vector3): Vector3 {
    if (!this.alignmentState.alignmentMatrix) {
      return position;
    }

    const inverseTransform: AlignmentTransform = {
      rotation: this.invertRotation(this.alignmentState.alignmentMatrix.rotation),
      translation: {
        x: -this.alignmentState.alignmentMatrix.translation.x,
        y: -this.alignmentState.alignmentMatrix.translation.y,
        z: -this.alignmentState.alignmentMatrix.translation.z,
      },
      scale: {
        x: 1 / this.alignmentState.alignmentMatrix.scale.x,
        y: 1 / this.alignmentState.alignmentMatrix.scale.y,
        z: 1 / this.alignmentState.alignmentMatrix.scale.z,
      },
      confidence: this.alignmentState.alignmentMatrix.confidence,
    };

    return CoordinateSystem.alignToSharedOrigin(position, inverseTransform);
  }

  private invertRotation(rotation: Matrix4): Matrix4 {
    return {
      m11: rotation.m11, m12: rotation.m21, m13: rotation.m31, m14: 0,
      m21: rotation.m12, m22: rotation.m22, m23: rotation.m32, m24: 0,
      m31: rotation.m13, m32: rotation.m23, m33: rotation.m33, m34: 0,
      m41: 0, m42: 0, m43: 0, m44: 1,
    };
  }

  smoothPosition(newPosition: Vector3, smoothingFactor: number = 0.3): Vector3 {
    this.positionHistory.push(newPosition);
    if (this.positionHistory.length > this.POSITION_HISTORY_SIZE) {
      this.positionHistory.shift();
    }

    if (this.positionHistory.length < 3) {
      return newPosition;
    }

    const weights = this.positionHistory.map(
      (_, i) => (i + 1) / this.positionHistory.length
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const smoothed: Vector3 = {
      x: 0,
      y: 0,
      z: 0,
    };

    for (let i = 0; i < this.positionHistory.length; i++) {
      const pos = this.positionHistory[i];
      const weight = weights[i] / totalWeight;
      smoothed.x += pos.x * weight;
      smoothed.y += pos.y * weight;
      smoothed.z += pos.z * weight;
    }

    return {
      x: newPosition.x * (1 - smoothingFactor) + smoothed.x * smoothingFactor,
      y: newPosition.y * (1 - smoothingFactor) + smoothed.y * smoothingFactor,
      z: newPosition.z * (1 - smoothingFactor) + smoothed.z * smoothingFactor,
    };
  }

  onAlignmentStateChange(callback: AlignmentStateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback);
    };
  }

  onAlignmentRequest(callback: AlignmentRequestCallback): () => void {
    this.requestCallbacks.push(callback);
    return () => {
      this.requestCallbacks = this.requestCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyStateCallbacks(): void {
    for (const callback of this.stateCallbacks) {
      callback({ ...this.alignmentState });
    }
  }

  async acceptAlignmentRequest(
    request: AlignmentRequest,
    userPosition: Vector3,
    userRotation: Vector3
  ): Promise<void> {
    const updatedRequest: AlignmentRequest = {
      ...request,
      toUserId: this.userId,
      status: 'accepted',
    };

    await this.saveAlignmentRequest(updatedRequest);

    const alignmentData: AlignmentData = {
      position: userPosition,
      rotation: userRotation as any,
      confidence: 1.0,
    };

    this.processAlignment(alignmentData);
  }

  async rejectAlignmentRequest(
    request: AlignmentRequest
  ): Promise<void> {
    const updatedRequest: AlignmentRequest = {
      ...request,
      status: 'rejected',
    };

    await this.saveAlignmentRequest(updatedRequest);
    this.pendingRequests.delete(request.qrData.nonce);
  }

  getConfidence(): number {
    return this.alignmentState.confidence;
  }

  getPartnerUserId(): string | null {
    return this.alignmentState.partnerUserId;
  }

  isStale(maxAgeMs: number = 300000): boolean {
    if (!this.alignmentState.alignedAt) return true;
    return Date.now() - this.alignmentState.alignedAt > maxAgeMs;
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.stateCallbacks = [];
    this.requestCallbacks = [];
    this.pendingRequests.clear();
    this.alignmentSessions.clear();
    this.positionHistory = [];
  }
}
