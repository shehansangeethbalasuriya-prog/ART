import { create } from 'zustand';
import type {
  User,
  ARObject,
  SpatialAnchor,
  AppState,
  ConnectionState,
  ARSessionState,
  Vector3Data,
  QuaternionData,
} from '../types';

const initialState = {
  user: null,
  currentRoom: null,
  connectionState: 'Disconnected' as ConnectionState,
  arSessionState: 'Inactive' as ARSessionState,
  objects: [] as ARObject[],
  anchors: [] as SpatialAnchor[],
  onlineUsers: [] as User[],
  localPosition: { x: 0, y: 0, z: 0 } as Vector3Data,
  localRotation: { x: 0, y: 0, z: 0, w: 1 } as QuaternionData,
  selectedObjectId: null as string | null,
  isHost: false,
};

export const useStore = create<AppState>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setARSessionState: (arSessionState) => set({ arSessionState }),

  setObjects: (objects) => set({ objects }),
  addObject: (object) => set((state) => ({ objects: [...state.objects, object] })),
  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    })),
  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
    })),

  setAnchors: (anchors) => set({ anchors }),
  addAnchor: (anchor) => set((state) => ({ anchors: [...state.anchors, anchor] })),
  removeAnchor: (id) =>
    set((state) => ({
      anchors: state.anchors.filter((anchor) => anchor.id !== id),
    })),

  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  addOnlineUser: (user) =>
    set((state) => ({ onlineUsers: [...state.onlineUsers, user] })),
  removeOnlineUser: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((user) => user.id !== userId),
    })),
  updateOnlineUser: (userId, updates) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      ),
    })),

  setLocalPosition: (localPosition) => set({ localPosition }),
  setLocalRotation: (localRotation) => set({ localRotation }),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  setIsHost: (isHost) => set({ isHost }),

  reset: () => set(initialState),
}));