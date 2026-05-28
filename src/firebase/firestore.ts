import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QueryConstraint,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './config';
import {
  Room,
  RoomObject,
  RoomUser,
  PresenceData,
  Vector3,
  RoomSettings,
} from '../types';

const ROOMS_COLLECTION = 'rooms';
const OBJECTS_COLLECTION = 'objects';
const USERS_COLLECTION = 'users';
const PRESENCE_COLLECTION = 'presence';

// Room operations

export const createRoom = async (
  roomData: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Room> => {
  try {
    const docRef = await addDoc(collection(db, ROOMS_COLLECTION), {
      ...roomData,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const roomSnap = await getDoc(docRef);
    if (!roomSnap.exists()) {
      throw new Error('Failed to create room');
    }

    return {
      id: docRef.id,
      ...roomSnap.data(),
    } as Room;
  } catch (error) {
    console.error('Failed to create room:', error);
    throw new Error('Could not create room');
  }
};

export const getRoom = async (roomId: string): Promise<Room | null> => {
  try {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      return null;
    }

    return {
      id: roomSnap.id,
      ...roomSnap.data(),
    } as Room;
  } catch (error) {
    console.error('Failed to get room:', error);
    throw new Error('Could not retrieve room');
  }
};

export const updateRoom = async (
  roomId: string,
  updates: Partial<Omit<Room, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(roomRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to update room:', error);
    throw new Error('Could not update room');
  }
};

export const deleteRoom = async (roomId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    const objectsQuery = query(
      collection(db, OBJECTS_COLLECTION),
      where('roomId', '==', roomId)
    );
    const objectsSnap = await getDocs(objectsQuery);
    objectsSnap.forEach((doc) => batch.delete(doc.ref));

    const usersQuery = query(
      collection(db, USERS_COLLECTION),
      where('currentRoomId', '==', roomId)
    );
    const usersSnap = await getDocs(usersQuery);
    usersSnap.forEach((doc) =>
      batch.update(doc.ref, { currentRoomId: null })
    );

    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    batch.delete(roomRef);

    await batch.commit();
  } catch (error) {
    console.error('Failed to delete room:', error);
    throw new Error('Could not delete room');
  }
};

export const listRooms = async (
  options: {
    hostUid?: string;
    isActive?: boolean;
    limitCount?: number;
  } = {}
): Promise<Room[]> => {
  try {
    const constraints: QueryConstraint[] = [];

    if (options.hostUid) {
      constraints.push(where('hostUid', '==', options.hostUid));
    }
    if (options.isActive !== undefined) {
      constraints.push(where('isActive', '==', options.isActive));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(collection(db, ROOMS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Room
    );
  } catch (error) {
    console.error('Failed to list rooms:', error);
    throw new Error('Could not list rooms');
  }
};

// Object operations

export const addObject = async (
  objectData: Omit<RoomObject, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RoomObject> => {
  try {
    const docRef = await addDoc(collection(db, OBJECTS_COLLECTION), {
      ...objectData,
      isSelected: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const objectSnap = await getDoc(docRef);
    if (!objectSnap.exists()) {
      throw new Error('Failed to create object');
    }

    return {
      id: docRef.id,
      ...objectSnap.data(),
    } as RoomObject;
  } catch (error) {
    console.error('Failed to add object:', error);
    throw new Error('Could not add object');
  }
};

export const updateObject = async (
  objectId: string,
  updates: Partial<Omit<RoomObject, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    const objectRef = doc(db, OBJECTS_COLLECTION, objectId);
    await updateDoc(objectRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to update object:', error);
    throw new Error('Could not update object');
  }
};

export const deleteObject = async (objectId: string): Promise<void> => {
  try {
    const objectRef = doc(db, OBJECTS_COLLECTION, objectId);
    await deleteDoc(objectRef);
  } catch (error) {
    console.error('Failed to delete object:', error);
    throw new Error('Could not delete object');
  }
};

export const getObject = async (
  objectId: string
): Promise<RoomObject | null> => {
  try {
    const objectRef = doc(db, OBJECTS_COLLECTION, objectId);
    const objectSnap = await getDoc(objectRef);

    if (!objectSnap.exists()) {
      return null;
    }

    return {
      id: objectSnap.id,
      ...objectSnap.data(),
    } as RoomObject;
  } catch (error) {
    console.error('Failed to get object:', error);
    throw new Error('Could not retrieve object');
  }
};

export const getRoomObjects = async (roomId: string): Promise<RoomObject[]> => {
  try {
    const q = query(
      collection(db, OBJECTS_COLLECTION),
      where('roomId', '==', roomId),
      orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as RoomObject
    );
  } catch (error) {
    console.error('Failed to get room objects:', error);
    throw new Error('Could not retrieve room objects');
  }
};

// Room user operations

export const joinRoom = async (
  roomId: string,
  user: Pick<RoomUser, 'uid' | 'displayName'>
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    const userRef = doc(db, USERS_COLLECTION, user.uid);
    batch.set(
      userRef,
      {
        ...user,
        currentRoomId: roomId,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      { merge: true }
    );

    const presenceRef = doc(db, PRESENCE_COLLECTION, user.uid);
    batch.set(
      presenceRef,
      {
        userId: user.uid,
        displayName: user.displayName,
        isOnline: true,
        roomId: roomId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        lastSeen: serverTimestamp(),
        isActive: true,
      },
      { merge: true }
    );

    await batch.commit();
  } catch (error) {
    console.error('Failed to join room:', error);
    throw new Error('Could not join room');
  }
};

export const leaveRoom = async (
  roomId: string,
  uid: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    const userRef = doc(db, USERS_COLLECTION, uid);
    batch.update(userRef, {
      currentRoomId: null,
      lastSeen: serverTimestamp(),
    });

    const presenceRef = doc(db, PRESENCE_COLLECTION, uid);
    batch.update(presenceRef, {
      isOnline: false,
      currentRoomId: null,
      lastSeen: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    console.error('Failed to leave room:', error);
    throw new Error('Could not leave room');
  }
};

export const getRoomUsers = async (roomId: string): Promise<RoomUser[]> => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('currentRoomId', '==', roomId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (doc) =>
        ({
          uid: doc.id,
          ...doc.data(),
        }) as RoomUser
    );
  } catch (error) {
    console.error('Failed to get room users:', error);
    throw new Error('Could not retrieve room users');
  }
};

// Presence operations

export const setPresence = async (
  presenceData: PresenceData
): Promise<void> => {
  try {
    const presenceRef = doc(db, PRESENCE_COLLECTION, presenceData.userId);
    await setDoc(
      presenceRef,
      {
        ...presenceData,
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Failed to set presence:', error);
    throw new Error('Could not update presence');
  }
};

export const removePresence = async (uid: string): Promise<void> => {
  try {
    const presenceRef = doc(db, PRESENCE_COLLECTION, uid);
    await updateDoc(presenceRef, {
      isOnline: false,
      lastSeen: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to remove presence:', error);
    throw new Error('Could not remove presence');
  }
};

// Real-time listeners

export const subscribeToRoom = (
  roomId: string,
  callback: (room: Room | null) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  return onSnapshot(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({
          id: snapshot.id,
          ...snapshot.data(),
        } as Room);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Room subscription error:', error);
      onError?.(new Error('Failed to subscribe to room'));
    }
  );
};

export const subscribeToRoomObjects = (
  roomId: string,
  callback: (objects: RoomObject[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, OBJECTS_COLLECTION),
    where('roomId', '==', roomId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const objects = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as RoomObject
      );
      callback(objects);
    },
    (error) => {
      console.error('Objects subscription error:', error);
      onError?.(new Error('Failed to subscribe to room objects'));
    }
  );
};

export const subscribeToRoomUsers = (
  roomId: string,
  callback: (users: RoomUser[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, USERS_COLLECTION),
    where('currentRoomId', '==', roomId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const users = snapshot.docs.map(
        (doc) =>
          ({
            uid: doc.id,
            ...doc.data(),
          }) as RoomUser
      );
      callback(users);
    },
    (error) => {
      console.error('Users subscription error:', error);
      onError?.(new Error('Failed to subscribe to room users'));
    }
  );
};

export const subscribeToPresence = (
  uid: string,
  callback: (presence: PresenceData | null) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const presenceRef = doc(db, PRESENCE_COLLECTION, uid);
  return onSnapshot(
    presenceRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({
          ...snapshot.data(),
          userId: snapshot.id,
        } as PresenceData);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Presence subscription error:', error);
      onError?.(new Error('Failed to subscribe to presence'));
    }
  );
};
