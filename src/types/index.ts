export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionData {
  x: number;
  y: number;
  z: number;
  w: number;
}

export enum ObjectType {
  Cube = 'Cube',
  Sphere = 'Sphere',
  Cylinder = 'Cylinder',
  Cone = 'Cone',
  Torus = 'Torus',
  GLTFModel = 'GLTFModel',
  CustomModel = 'CustomModel',
}

export interface RoomSettings {
  isPublic: boolean;
  maxMembers: number;
  allowAnonymous: boolean;
  enablePhysics: boolean;
}

export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Reconnecting = 'Reconnecting',
  Error = 'Error',
}

export enum ARSessionState {
  Inactive = 'Inactive',
  Initializing = 'Initializing',
  Running = 'Running',
  Paused = 'Paused',
  Error = 'Error',
}

export interface HitTestResult {
  position: Vector3Data;
  rotation: QuaternionData;
  normal: Vector3Data;
  distance: number;
}

export interface User {
  id: string;
  displayName: string;
  avatar: string;
  color: string;
  position: Vector3Data;
  rotation: QuaternionData;
  isOnline: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  createdBy: string;
  memberCount: number;
  isActive: boolean;
  settings: RoomSettings;
  members?: string[];
  ownerId?: string;
  maxMembers?: number;
  updatedAt?: number;
}

export interface ARObject {
  id: string;
  type: ObjectType;
  modelUrl: string | null;
  position: Vector3Data;
  rotation: QuaternionData;
  scale: Vector3Data;
  ownerId: string;
  roomId: string;
  color: string;
  name: string;
  visible: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SpatialAnchor {
  id: string;
  roomId: string;
  position: Vector3Data;
  rotation: QuaternionData;
  qrCode: string;
  imageUrl: string | null;
  createdAt: number;
}

export interface PresenceData {
  userId: string;
  roomId: string;
  position: Vector3Data;
  rotation: QuaternionData;
  lastSeen: number;
  isActive: boolean;
}

export interface Transform {
  position: Vector3Data;
  rotation: QuaternionData;
  scale: Vector3Data;
}

export interface ObjectUpdate {
  objectId: string;
  type: 'create' | 'update' | 'delete';
  changes?: Partial<Omit<ARObject, 'id' | 'createdAt'>>;
  data?: Omit<ARObject, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface AlignmentData {
  position: Vector3Data;
  rotation: QuaternionData;
  confidence: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Matrix4 {
  m11: number; m12: number; m13: number; m14: number;
  m21: number; m22: number; m23: number; m24: number;
  m31: number; m32: number; m33: number; m34: number;
  m41: number; m42: number; m43: number; m44: number;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  objectId: string;
  data?: Partial<ARObject>;
  timestamp: number;
}

export interface ConflictResolution {
  strategy: 'lastWriteWins' | 'firstWriteWins' | 'manual';
  resolvedData?: Partial<ARObject>;
  resolved?: Record<string, any>;
  source?: 'remote' | 'local';
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  color: string;
  createdAt: number;
  lastSeen: number;
}

export type RoomObject = ARObject;

export interface RoomUser {
  uid: string;
  displayName: string;
  color: string;
  isOnline: boolean;
  joinedAt: number;
  lastSeen: number;
}

export type UserPresence = PresenceData;

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  objectId: string;
  roomId: string;
  data?: Partial<ARObject>;
  timestamp: number;
  retryCount: number;
}

export interface AppState {
  user: User | null;
  currentRoom: Room | null;
  connectionState: ConnectionState;
  arSessionState: ARSessionState;
  objects: ARObject[];
  anchors: SpatialAnchor[];
  onlineUsers: User[];
  localPosition: Vector3Data;
  localRotation: QuaternionData;
  selectedObjectId: string | null;
  isHost: boolean;

  setUser: (user: User | null) => void;
  setCurrentRoom: (room: Room | null) => void;
  setConnectionState: (state: ConnectionState) => void;
  setARSessionState: (state: ARSessionState) => void;
  setObjects: (objects: ARObject[]) => void;
  addObject: (object: ARObject) => void;
  updateObject: (id: string, updates: Partial<ARObject>) => void;
  removeObject: (id: string) => void;
  setAnchors: (anchors: SpatialAnchor[]) => void;
  addAnchor: (anchor: SpatialAnchor) => void;
  removeAnchor: (id: string) => void;
  setOnlineUsers: (users: User[]) => void;
  addOnlineUser: (user: User) => void;
  removeOnlineUser: (userId: string) => void;
  updateOnlineUser: (userId: string, updates: Partial<User>) => void;
  setLocalPosition: (position: Vector3Data) => void;
  setLocalRotation: (rotation: QuaternionData) => void;
  setSelectedObjectId: (id: string | null) => void;
  setIsHost: (isHost: boolean) => void;
  reset: () => void;
}

export type ModalType = 'room' | 'settings' | 'profile' | 'objects' | null;

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
  duration?: number;
}
