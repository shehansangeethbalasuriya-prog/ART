import { useState, useCallback, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Room, RoomSettings } from '../types';
import { useAppStore } from '../store/useAppStore';

interface UseRoomReturn {
  currentRoom: Room | null;
  rooms: Room[];
  createRoom: (name: string, settings?: Partial<RoomSettings>) => Promise<Room>;
  joinRoom: (code: string) => Promise<Room>;
  leaveRoom: () => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  listRooms: (options?: { isActive?: boolean; limitCount?: number }) => Promise<Room[]>;
  isLoading: boolean;
  error: string | null;
}

const ROOMS_COLLECTION = 'rooms';

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const defaultSettings: RoomSettings = {
  isPublic: true,
  maxMembers: 10,
  allowAnonymous: true,
  enablePhysics: true,
};

export function useRoom(): UseRoomReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<Unsubscribe | null>(null);

  const currentRoom = useAppStore((s) => s.room.currentRoom);
  const rooms = useAppStore((s) => s.room.rooms);
  const setCurrentRoom = useAppStore((s) => s.setCurrentRoom);
  const setRooms = useAppStore((s) => s.setRooms);

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
      }
    };
  }, []);

  const subscribeToRoom = useCallback(
    (roomId: string) => {
      if (unsubRef.current) {
        unsubRef.current();
      }

      const roomRef = doc(db, ROOMS_COLLECTION, roomId);
      unsubRef.current = onSnapshot(
        roomRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const roomData = {
              id: snapshot.id,
              ...snapshot.data(),
            } as Room;
            setCurrentRoom(roomData);
          } else {
            setCurrentRoom(null);
          }
        },
        (err) => {
          console.error('Room subscription error:', err);
          setError('Lost connection to room');
        }
      );
    },
    [setCurrentRoom]
  );

  const createRoom = useCallback(
    async (name: string, settings?: Partial<RoomSettings>): Promise<Room> => {
      setIsLoading(true);
      setError(null);

      try {
        const roomSettings = { ...defaultSettings, ...settings };
        const code = generateRoomCode();

        const docRef = await addDoc(collection(db, ROOMS_COLLECTION), {
          name,
          code,
          settings: roomSettings,
          memberCount: 1,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const roomSnap = await getDoc(docRef);
        if (!roomSnap.exists()) {
          throw new Error('Failed to create room');
        }

        const room = {
          id: docRef.id,
          ...roomSnap.data(),
        } as Room;

        setCurrentRoom(room);
        subscribeToRoom(docRef.id);

        setIsLoading(false);
        return room;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create room';
        setError(message);
        setIsLoading(false);
        throw new Error(message);
      }
    },
    [setCurrentRoom, subscribeToRoom]
  );

  const joinRoom = useCallback(
    async (code: string): Promise<Room> => {
      setIsLoading(true);
      setError(null);

      try {
        const roomsQuery = query(
          collection(db, ROOMS_COLLECTION),
          where('code', '==', code.toUpperCase()),
          where('isActive', '==', true),
          limit(1)
        );

        const snapshot = await getDocs(roomsQuery);

        if (snapshot.empty) {
          throw new Error('Room not found. Check the code and try again.');
        }

        const roomDoc = snapshot.docs[0];
        const roomData = {
          id: roomDoc.id,
          ...roomDoc.data(),
        } as Room;

        if (roomData.settings?.maxMembers && roomData.memberCount >= roomData.settings.maxMembers) {
          throw new Error('Room is full');
        }

        await updateDoc(doc(db, ROOMS_COLLECTION, roomDoc.id), {
          memberCount: roomData.memberCount + 1,
          updatedAt: serverTimestamp(),
        });

        setCurrentRoom(roomData);
        subscribeToRoom(roomDoc.id);

        setIsLoading(false);
        return roomData;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join room';
        setError(message);
        setIsLoading(false);
        throw new Error(message);
      }
    },
    [setCurrentRoom, subscribeToRoom]
  );

  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!currentRoom) return;

    setIsLoading(true);
    setError(null);

    try {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      const roomRef = doc(db, ROOMS_COLLECTION, currentRoom.id);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const newCount = Math.max(0, (data.memberCount || 1) - 1);

        if (newCount === 0) {
          await updateDoc(roomRef, {
            isActive: false,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(roomRef, {
            memberCount: newCount,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setCurrentRoom(null);
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave room';
      setError(message);
      setIsLoading(false);
    }
  }, [currentRoom, setCurrentRoom]);

  const deleteRoom = useCallback(
    async (roomId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        await deleteDoc(doc(db, ROOMS_COLLECTION, roomId));

        if (currentRoom?.id === roomId) {
          if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
          }
          setCurrentRoom(null);
        }

        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete room';
        setError(message);
        setIsLoading(false);
        throw new Error(message);
      }
    },
    [currentRoom, setCurrentRoom]
  );

  const listRooms = useCallback(
    async (options: { isActive?: boolean; limitCount?: number } = {}): Promise<Room[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const constraints: ReturnType<typeof where>[] = [];

        if (options.isActive !== undefined) {
          constraints.push(where('isActive', '==', options.isActive));
        }

        const q = query(
          collection(db, ROOMS_COLLECTION),
          ...constraints,
          orderBy('createdAt', 'desc'),
          limit(options.limitCount || 20)
        );

        const snapshot = await getDocs(q);
        const roomsList = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Room
        );

        setRooms(roomsList);
        setIsLoading(false);
        return roomsList;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to list rooms';
        setError(message);
        setIsLoading(false);
        throw new Error(message);
      }
    },
    [setRooms]
  );

  return {
    currentRoom,
    rooms,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    listRooms,
    isLoading,
    error,
  };
}

export default useRoom;
