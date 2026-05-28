import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User, UserProfile, Room, ModalType, Notification } from '../types';

interface UserState {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface RoomState {
  currentRoom: Room | null;
  rooms: Room[];
  isLoadingRooms: boolean;
}

interface UIState {
  activeModal: ModalType | null;
  sidebarOpen: boolean;
  darkMode: boolean;
  notifications: Notification[];
}

interface ConnectionState {
  isConnected: boolean;
  latency: number;
  lastSync: Date | null;
}

interface AppStoreState {
  user: UserState;
  room: RoomState;
  ui: UIState;
  connection: ConnectionState;

  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;

  setCurrentRoom: (room: Room | null) => void;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoomInList: (roomId: string, updates: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  setLoadingRooms: (loading: boolean) => void;

  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  setConnected: (connected: boolean) => void;
  setLatency: (latency: number) => void;
  setLastSync: (date: Date) => void;

  reset: () => void;
}

const initialState = {
  user: {
    currentUser: null,
    userProfile: null,
    isAuthenticated: false,
    isLoading: true,
  },
  room: {
    currentRoom: null,
    rooms: [],
    isLoadingRooms: false,
  },
  ui: {
    activeModal: null,
    sidebarOpen: true,
    darkMode: false,
    notifications: [],
  },
  connection: {
    isConnected: false,
    latency: 0,
    lastSync: null,
  },
};

let notificationCounter = 0;

export const useAppStore = create<AppStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user) =>
          set(
            (state) => ({
              user: {
                ...state.user,
                currentUser: user,
                isAuthenticated: !!user,
                isLoading: false,
              },
            }),
            false,
            'setUser'
          ),

        setUserProfile: (profile) =>
          set(
            (state) => ({
              user: {
                ...state.user,
                userProfile: profile,
              },
            }),
            false,
            'setUserProfile'
          ),

        setLoading: (loading) =>
          set(
            (state) => ({
              user: {
                ...state.user,
                isLoading: loading,
              },
            }),
            false,
            'setLoading'
          ),

        logout: () =>
          set(
            {
              user: {
                currentUser: null,
                userProfile: null,
                isAuthenticated: false,
                isLoading: false,
              },
              room: {
                currentRoom: null,
                rooms: [],
                isLoadingRooms: false,
              },
            },
            false,
            'logout'
          ),

        setCurrentRoom: (room) =>
          set(
            (state) => ({
              room: {
                ...state.room,
                currentRoom: room,
              },
            }),
            false,
            'setCurrentRoom'
          ),

        setRooms: (rooms) =>
          set(
            (state) => ({
              room: {
                ...state.room,
                rooms,
                isLoadingRooms: false,
              },
            }),
            false,
            'setRooms'
          ),

        addRoom: (room) =>
          set(
            (state) => ({
              room: {
                ...state.room,
                rooms: [room, ...state.room.rooms],
              },
            }),
            false,
            'addRoom'
          ),

        updateRoomInList: (roomId, updates) =>
          set(
            (state) => ({
              room: {
                ...state.room,
                rooms: state.room.rooms.map((r) =>
                  r.id === roomId ? { ...r, ...updates } : r
                ),
                currentRoom:
                  state.room.currentRoom?.id === roomId
                    ? { ...state.room.currentRoom, ...updates }
                    : state.room.currentRoom,
              },
            }),
            false,
            'updateRoomInList'
          ),

        removeRoom: (roomId) =>
          set(
            (state) => ({
              room: {
                ...state.room,
                rooms: state.room.rooms.filter((r) => r.id !== roomId),
                currentRoom:
                  state.room.currentRoom?.id === roomId
                    ? null
                    : state.room.currentRoom,
              },
            }),
            false,
            'removeRoom'
          ),

        setLoadingRooms: (loading) =>
          set(
            (state) => ({
              room: {
                ...state.room,
                isLoadingRooms: loading,
              },
            }),
            false,
            'setLoadingRooms'
          ),

        openModal: (modal) =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                activeModal: modal,
              },
            }),
            false,
            'openModal'
          ),

        closeModal: () =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                activeModal: null,
              },
            }),
            false,
            'closeModal'
          ),

        toggleSidebar: () =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                sidebarOpen: !state.ui.sidebarOpen,
              },
            }),
            false,
            'toggleSidebar'
          ),

        setSidebarOpen: (open) =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                sidebarOpen: open,
              },
            }),
            false,
            'setSidebarOpen'
          ),

        toggleDarkMode: () =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                darkMode: !state.ui.darkMode,
              },
            }),
            false,
            'toggleDarkMode'
          ),

        setDarkMode: (dark) =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                darkMode: dark,
              },
            }),
            false,
            'setDarkMode'
          ),

        addNotification: (notification) => {
          const id = `notification-${++notificationCounter}`;
          const newNotification: Notification = {
            ...notification,
            id,
          };

          set(
            (state) => ({
              ui: {
                ...state.ui,
                notifications: [
                  ...state.ui.notifications,
                  newNotification,
                ],
              },
            }),
            false,
            'addNotification'
          );

          if (notification.duration !== 0) {
            setTimeout(() => {
              get().removeNotification(id);
            }, notification.duration || 5000);
          }
        },

        removeNotification: (id) =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                notifications: state.ui.notifications.filter(
                  (n) => n.id !== id
                ),
              },
            }),
            false,
            'removeNotification'
          ),

        clearNotifications: () =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                notifications: [],
              },
            }),
            false,
            'clearNotifications'
          ),

        setConnected: (connected) =>
          set(
            (state) => ({
              connection: {
                ...state.connection,
                isConnected: connected,
              },
            }),
            false,
            'setConnected'
          ),

        setLatency: (latency) =>
          set(
            (state) => ({
              connection: {
                ...state.connection,
                latency,
              },
            }),
            false,
            'setLatency'
          ),

        setLastSync: (date) =>
          set(
            (state) => ({
              connection: {
                ...state.connection,
                lastSync: date,
              },
            }),
            false,
            'setLastSync'
          ),

        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'sharedspace-app-store',
        partialize: (state) => ({
          ui: {
            darkMode: state.ui.darkMode,
            sidebarOpen: state.ui.sidebarOpen,
          },
        }),
      }
    ),
    { name: 'AppStore' }
  )
);

export default useAppStore;
