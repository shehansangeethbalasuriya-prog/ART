import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Room } from '../types';

const ROOMS_COLLECTION = 'rooms';
const CODE_LENGTH = 6;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
    code += CODE_CHARS[randomIndex];
  }
  return code;
}

async function isCodeUnique(code: string): Promise<boolean> {
  const q = query(
    collection(db, ROOMS_COLLECTION),
    where('code', '==', code),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

async function generateUniqueCode(): Promise<string> {
  let code = generateRoomCode();
  let attempts = 0;
  while (!(await isCodeUnique(code)) && attempts < 10) {
    code = generateRoomCode();
    attempts++;
  }
  return code;
}

export async function createRoom(
  name: string,
  userId: string
): Promise<Room> {
  const code = await generateUniqueCode();
  const roomId = doc(collection(db, ROOMS_COLLECTION)).id;

  const roomData: Omit<Room, 'id'> = {
    name,
    code,
    createdBy: userId,
    ownerId: userId,
    members: [userId],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    memberCount: 1,
    maxMembers: 20,
    settings: {
      isPublic: true,
      maxMembers: 20,
      allowAnonymous: true,
      enablePhysics: false,
    },
  };

  await setDoc(doc(db, ROOMS_COLLECTION, roomId), {
    ...roomData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: roomId, ...roomData };
}

export async function joinRoom(
  code: string,
  userId: string
): Promise<Room | null> {
  const q = query(
    collection(db, ROOMS_COLLECTION),
    where('code', '==', code.toUpperCase()),
    limit(1)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const roomDoc = snapshot.docs[0];
  const roomData = roomDoc.data() as Omit<Room, 'id'>;

  if (roomData.members?.includes(userId)) {
    return { id: roomDoc.id, ...roomData };
  }

  if ((roomData.members?.length ?? 0) >= (roomData.maxMembers || 20)) {
    throw new Error('Room is full');
  }

  await updateDoc(doc(db, ROOMS_COLLECTION, roomDoc.id), {
    members: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });

  return {
    id: roomDoc.id,
    ...roomData,
    members: [...(roomData.members ?? []), userId],
  };
}

export async function leaveRoom(
  roomId: string,
  userId: string
): Promise<void> {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }

  const roomData = roomSnap.data() as Omit<Room, 'id'>;

  if (roomData.ownerId === userId) {
    const remainingMembers = roomData.members?.filter((m) => m !== userId) ?? [];
    if (remainingMembers.length === 0) {
      await deleteDoc(roomRef);
      return;
    }
    await updateDoc(roomRef, {
      members: arrayRemove(userId),
      ownerId: remainingMembers[0],
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(roomRef, {
      members: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const roomSnap = await getDoc(doc(db, ROOMS_COLLECTION, roomId));
  if (!roomSnap.exists()) {
    return null;
  }
  return { id: roomSnap.id, ...roomSnap.data() } as Room;
}

export function subscribeToRoom(
  roomId: string,
  callback: (room: Room | null) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    doc(db, ROOMS_COLLECTION, roomId),
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as Room);
      } else {
        callback(null);
      }
    },
    (error) => {
      onError?.(error);
    }
  );
}
