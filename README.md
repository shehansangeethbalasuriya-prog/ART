# SharedSpace AR

A production-ready multiplayer augmented reality platform that enables multiple users to share and interact with 3D objects in real-world spaces using WebXR, Vite, Firebase, and Three.js. No app install required — open a URL on any AR-capable device and join a shared spatial session instantly.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Spatial Alignment Strategy](#spatial-alignment-strategy)
- [Browser WebXR Limitations](#browser-webxr-limitations)
- [Multiplayer Synchronization](#multiplayer-synchronization)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Future Scalability Plan](#future-scalability-plan)

---

## Overview

SharedSpace AR is a web-based platform that allows multiple users in the same physical location to experience a shared augmented reality session through their mobile browsers. Users scan a QR code to align their coordinate systems, then collaboratively place, move, and interact with 3D objects anchored to a shared real-world coordinate frame.

The platform is designed for use cases such as:

- Collaborative spatial design review
- Interactive AR demonstrations and exhibits
- Shared gaming and entertainment experiences
- Educational simulations with multi-user interaction
- Remote collaboration anchored to physical spaces

## Features

- **Multi-user AR sessions**: Up to 8 participants per room with real-time synchronization
- **QR-code spatial anchoring**: Automatic coordinate system alignment via scanned QR markers
- **Real-time object manipulation**: Place, move, rotate, scale, and delete 3D objects collaboratively
- **Live presence indicators**: See other users' avatars and hand/controller positions in AR
- **Gesture-based controls**: Two-finger rotate, pinch-to-scale, and touch-based object placement
- **Room-based sessions**: Create private rooms and share invite links or QR codes
- **Persistent state**: Firebase Firestore keeps room state, objects, and member data in sync
- **Device-agnostic**: Works on ARCore (Android) and ARKit (iOS) capable devices via WebXR
- **No installation required**: Entirely browser-based — no native app needed
- **Responsive UI**: Overlay controls for room management, object inventory, and session info

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │  Vite +   │  │ Three.js │  │   WebXR API Layer     │ │
│  │  React    │  │  r168    │  │  (immersive-ar)       │ │
│  └─────┬────┘  └────┬─────┘  └───────────┬───────────┘ │
│        │             │                     │             │
│  ┌─────┴─────────────┴─────────────────────┴──────────┐ │
│  │              AR Session Manager                    │ │
│  │  - Camera pass-through                            │ │
│  │  - Hit testing                                    │ │
│  │  - Anchor management                              │ │
│  │  - Reference space alignment                      │ │
│  └─────────────────────┬──────────────────────────────┘ │
│                        │                                 │
│  ┌─────────────────────┴──────────────────────────────┐ │
│  │           Multiplayer Sync Layer                   │ │
│  │  - Firestore real-time listeners                  │ │
│  │  - Optimistic updates with conflict resolution     │ │
│  │  - Delta compression for position broadcasts       │ │
│  │  - Presence heartbeat (5s interval)               │ │
│  └─────────────────────┬──────────────────────────────┘ │
└────────────────────────┼────────────────────────────────┘
                         │
                    HTTPS / WSS
                         │
┌────────────────────────┼────────────────────────────────┐
│              Firebase Backend                           │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Firestore   │  │  Firebase    │  │  Firebase    │ │
│  │  (Realtime   │  │  Auth        │  │  Hosting     │ │
│  │   Database)  │  │  (Anonymous) │  │  (CDN)       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Responsibility |
|-----------|---------------|
| `ARSessionManager` | Initializes WebXR session, manages camera pass-through, hit testing, and anchor lifecycle |
| `QRCodeScanner` | Captures and decodes QR markers to establish spatial alignment origins |
| `CoordinateAligner` | Transforms local device coordinates to the shared room coordinate system |
| `ObjectManager` | CRUD operations for 3D objects, including placement, manipulation, and cleanup |
| `MultiplayerSync` | Bidirectional Firestore synchronization with optimistic updates and conflict resolution |
| `PresenceManager` | Tracks user positions, hand states, and connection health with periodic heartbeats |
| `UIOverlay` | React-based overlay for room controls, object inventory, and session management |

---

## Spatial Alignment Strategy

The fundamental challenge in multi-user AR is ensuring all participants perceive virtual objects at the same real-world location. SharedSpace AR solves this with a **QR-code anchored coordinate system**.

### How It Works

1. **Anchor Generation**: When a room is created, the system generates a unique QR code containing the room ID and a spatial origin marker. This QR code is printed or displayed at a fixed physical location.

2. **Device Alignment**: When each user joins, they point their camera at the QR code. The browser decodes it and uses WebXR's `hit-test` API to find the marker's real-world position and orientation.

3. **Coordinate Transformation**: The device's local coordinate system is then aligned to the room's shared coordinate frame using a rigid-body transform:

   ```
   SharedPosition = AlignmentMatrix × LocalPosition
   ```

   Where `AlignmentMatrix` is computed from the QR marker's detected pose (position + quaternion rotation).

4. **Anchor Establishment**: A persistent WebXR anchor is created at the QR marker's position. All subsequent object placements are referenced relative to this anchor, ensuring objects appear at consistent real-world locations regardless of device.

5. **Continuous Drift Correction**: The system periodically re-detects the QR marker (or nearby visual features) to correct accumulated tracking drift. WebXR anchors help maintain stability between corrections.

### Coordinate System Details

- **Origin**: Center of the QR code marker (bottom-left corner of the printed marker)
- **X-axis**: Rightward along the marker's surface
- **Y-axis**: Upward perpendicular to the marker's surface
- **Z-axis**: Forward along the marker's surface normal
- **Units**: Meters (consistent with WebXR tracking space)
- **Rotation**: Quaternion-based to avoid gimbal lock

### Marker Requirements

For reliable alignment, the QR code should be:

- Printed at minimum 10cm × 10cm (larger for outdoor use)
- Placed on a flat, non-reflective surface
- Well-lit with even lighting (avoid harsh shadows)
- At a height of 0.8–1.2m from the floor for comfortable scanning
- Surrounded by visual texture for feature-based drift correction

---

## Browser WebXR Limitations

WebXR provides the foundation for browser-based AR, but comes with significant limitations that SharedSpace AR must work around.

### Current Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| **No persistent anchors across sessions** | Anchors don't survive page reload | Store anchor transforms in Firestore; re-create anchors on rejoin using stored positions |
| **Limited concurrent anchor stability** | Too many anchors cause tracking jitter | Limit to ~50 active anchors per session; use spatial clustering for distant objects |
| **No native persistent storage for XR state** | Device-specific tracking data is ephemeral | Sync all state through Firestore; treat each session as fresh alignment |
| **Varying device support** | Some devices have poor AR performance | Graceful degradation to non-AR mode; device capability detection on join |
| **Camera pass-through quality varies** | Low-end devices have grainy video | Adaptive rendering quality; reduce 3D object detail on weak GPUs |
| **No shared reference space** | Each device has its own tracking origin | QR-code alignment provides artificial shared reference |
| **Frame rate limitations** | AR mode capped at device refresh rate | LOD system; reduce draw calls in AR mode |
| **Touch input conflicts** | AR gestures conflict with UI interactions | Careful UI placement; gesture zone separation; dedicated manipulation mode |
| **No audio spatialization** | No positional audio for AR objects | Planned for future release; currently visual-only |
| **Battery drain** | AR sessions consume significant power | Session time limits; automatic dimming; power-aware rendering |

### Supported Browsers

| Browser | Platform | WebXR Support | Status |
|---------|----------|---------------|--------|
| Chrome 81+ | Android (ARCore) | Full immersive-ar | Primary target |
| Samsung Internet 15+ | Android (ARCore) | Full immersive-ar | Supported |
| Safari 17+ | iOS (ARKit) | Limited (Quick Look) | Partial — non-AR fallback |
| Edge 81+ | Android (ARCore) | Full immersive-ar | Supported |
| Firefox | Any | No AR support | Non-AR fallback mode |

### Graceful Degradation

When WebXR is unavailable, the application falls back to:

1. **3D Viewport Mode**: A desktop-friendly 3D view with orbit controls
2. **Object Viewing**: Users can see and manipulate objects in a shared 3D scene
3. **Cross-platform**: Desktop users can participate alongside mobile AR users
4. **Full state sync**: All Firestore synchronization works identically in fallback mode

---

## Multiplayer Synchronization

Real-time multi-user interaction requires careful synchronization strategy balancing responsiveness, bandwidth, and consistency.

### Sync Architecture

```
Device A ──┐                    ┌── Firestore
            ├── Presence Channel ─┤
Device B ──┘                    ├── Object State
                                 └── Room Metadata
```

### Object State Model

Every 3D object in the shared space is represented as a Firestore document:

```json
{
  "id": "obj_1a2b3c4d",
  "type": "box",
  "position": { "x": 1.2, "y": 0.8, "z": -0.5 },
  "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
  "scale": { "x": 1, "y": 1, "z": 1 },
  "color": "#ff6b35",
  "createdBy": "user_abc",
  "createdAt": 1716912000000,
  "updatedAt": 1716912000000
}
```

### Synchronization Strategy

1. **Optimistic Updates**: When a user manipulates an object, the change is applied locally immediately and queued for Firestore write. This provides instant visual feedback.

2. **Conflict Resolution**: Last-write-wins based on `updatedAt` timestamp. For simultaneous edits to the same object, the most recent server timestamp wins. Users are notified of conflicts via a brief toast notification.

3. **Delta Compression**: Only changed fields are transmitted. Position updates include only `{x, y, z}` deltas rather than full object state, reducing bandwidth by ~70%.

4. **Throttled Position Broadcasts**: Position updates during rapid manipulation are throttled to 20Hz (50ms intervals). This prevents Firestore overload while maintaining smooth visual interpolation on receiving devices.

5. **Presence Heartbeat**: Each user broadcasts their position, hand state, and connection status every 5 seconds. Missed heartbeats trigger "user disconnected" indicators after 15 seconds.

6. **Object Lifecycle**:
   - **Create**: User places object → local render + Firestore create
   - **Update**: User drags object → local render + throttled Firestore update
   - **Delete**: User removes object → local cleanup + Firestore delete
   - **Gone**: Firestore delete received → local cleanup + visual fade-out

### Latency Compensation

| Strategy | Purpose |
|----------|---------|
| Server timestamp normalization | Ensures consistent ordering across devices |
| Local interpolation between sync points | Smooths movement between 20Hz updates |
| Predictive position extrapolation | Handles brief network interruptions |
| Visual fade-in on object creation | Masks 100-300ms sync delay |
| Conflict notification toasts | Transparent feedback when edits collide |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Build** | Vite 5.x | Fast bundling, HMR, optimized production builds |
| **UI Framework** | React 18 | Component-based UI with hooks |
| **3D Rendering** | Three.js r168 | WebGL-based 3D scene management |
| **AR Integration** | WebXR API | Browser-native augmented reality |
| **AR Helpers** | @google/model-viewer (optional) | High-fidelity 3D model rendering |
| **QR Detection** | jsQR / html5-qrcode | QR code scanning from camera feed |
| **Backend** | Firebase 11.x | Authentication, database, hosting |
| **Database** | Firestore (Realtime) | Multi-user state synchronization |
| **Auth** | Firebase Anonymous Auth | Passwordless session authentication |
| **Hosting** | Firebase Hosting / Vercel | Global CDN with edge caching |
| **Language** | JavaScript (ES modules) | Modern ES2022+ features |
| **Icons** | Lucide React | Lightweight, accessible icon set |

---

## Project Structure

```
sharedspace-ar/
├── .firebaserc              # Firebase project aliases (dev/prod)
├── firebase.json            # Firebase hosting and service config
├── firestore.rules          # Firestore security rules
├── vite.config.js           # Vite build configuration
├── package.json             # Dependencies and scripts
├── index.html               # Application entry point
├── .env.example             # Environment variable template
├── README.md                # This file
│
├── public/                  # Static assets (copied as-is to dist)
│   ├── models/              # 3D model files (.glb, .gltf)
│   │   ├── cube.glb
│   │   ├── sphere.glb
│   │   └── torus.glb
│   ├── textures/            # Material textures
│   │   └── grid.png
│   └── sounds/              # Interaction audio (optional)
│       └── placement.mp3
│
└── src/                     # Application source
    ├── main.js              # Entry point — mounts React app
    ├── App.jsx              # Root component, routing, session init
    │
    ├── core/                # Core AR and session management
    │   ├── ARSessionManager.js      # WebXR session lifecycle
    │   ├── CoordinateAligner.js     # QR-based coordinate alignment
    │   ├── HitTestManager.js        # AR hit testing and plane detection
    │   └── ReferenceSpaceManager.js # Shared reference space setup
    │
    ├── multiplayer/         # Real-time synchronization
    │   ├── MultiplayerSync.js       # Firestore bidirectional sync
    │   ├── PresenceManager.js       # User presence and heartbeats
    │   ├── ObjectSync.js            # Object CRUD with conflict resolution
    │   └── ThrottledBroadcast.js    # Rate-limited update broadcasting
    │
    ├── objects/             # 3D object management
    │   ├── ObjectManager.js         # Object lifecycle management
    │   ├── ObjectFactory.js         # Create typed 3D objects
    │   ├── ObjectPicker.js          # Tap-to-select and manipulation
    │   └── ObjectLibrary.js         # Available 3D primitives catalog
    │
    ├── ui/                  # React UI components
    │   ├── UIOverlay.jsx            # Main overlay container
    │   ├── RoomPanel.jsx            # Room creation and management
    │   ├── ObjectPanel.jsx          # Object selection and inventory
    │   ├── PresencePanel.jsx        # User list and status
    │   ├── SessionInfo.jsx          # Room ID, timer, connection status
    │   ├── QRScanner.jsx            # QR code scanner overlay
    │   └── Toast.jsx                # Notification toasts
    │
    ├── firebase/            # Firebase configuration
    │   ├── firebaseConfig.js        # Firebase initialization
    │   ├── firebaseAuth.js          # Anonymous authentication
    │   └── firestoreService.js      # Firestore CRUD helpers
    │
    ├── hooks/               # Custom React hooks
    │   ├── useARSession.js          # WebXR session state
    │   ├── useMultiplayer.js        # Multiplayer connection state
    │   └── useObjectManipulation.js # Touch/gesture handling
    │
    ├── utils/               # Utility functions
    │   ├── math.js                  # Vector, quaternion, matrix helpers
    │   ├── qr.js                    # QR code generation and decoding
    │   └── device.js                # Device capability detection
    │
    └── styles/              # CSS
        └── main.css                 # Global styles and overlays
```

---

## Setup Instructions

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ or **yarn** 1.22+
- **Firebase CLI** 13+ (`npm install -g firebase-tools`)
- **Git** for version control
- A **Google account** for Firebase project creation

### 1. Clone and Install

```bash
git clone https://github.com/your-org/sharedspace-ar.git
cd sharedspace-ar
npm install
```

### 2. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Name it `sharedspace-ar-dev` (for development)
4. Enable Google Analytics (optional)
5. Create the project

### 3. Enable Firebase Services

**Authentication:**
1. Go to Authentication > Sign-in method
2. Enable "Anonymous" sign-in provider
3. Add `sharedspace-ar-dev.firebaseapp.com` as an authorized domain

**Firestore:**
1. Go to Firestore Database
2. Click "Create database"
3. Start in test mode (rules are provided in `firestore.rules`)
4. Select a location closest to your users

**Hosting:**
1. Go to Hosting
2. Click "Get started"
3. Connect to your repository or deploy manually

### 4. Configure Project

```bash
# Log in to Firebase
firebase login

# Associate local project with Firebase project
firebase use --add
# Select "sharedspace-ar-dev" and alias as "dev"
```

### 5. Set Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Fill in your Firebase configuration values (see [Environment Variables](#environment-variables) below).

---

## Environment Variables

Create a `.env` file in the project root with the following:

```env
# Firebase Configuration
# Found in Firebase Console > Project Settings > Your apps > Web app
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=sharedspace-ar-dev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sharedspace-ar-dev
VITE_FIREBASE_STORAGE_BUCKET=sharedspace-ar-dev.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Session Configuration
VITE_MAX_USERS_PER_ROOM=8
VITE_PRESENCE_HEARTBEAT_MS=5000
VITE_POSITION_SYNC_THROTTLE_MS=50

# Feature Flags
VITE_ENABLE_AR_DEBUG=false
VITE_LOG_SYNC_EVENTS=false
```

**Never commit `.env` files to version control.** The `.gitignore` already excludes them.

---

## Development

### Start Development Server

```bash
npm run dev
```

This starts Vite's dev server at `http://localhost:5173` with hot module replacement.

### Development Workflow

1. Open the app in a browser (desktop for non-AR testing)
2. Create a room — this generates a QR code
3. Open a second browser tab/device and scan the QR code to join
4. Both sessions will share the same coordinate space
5. Place objects and verify they appear in both views

### Testing on Mobile

For mobile AR testing, you need HTTPS (WebXR requires a secure context):

```bash
# Option A: Use Vite's HTTPS mode
npx vite --host --https

# Option B: Use ngrok for public HTTPS URL
ngrok http 5173
```

Then open the ngrok URL on your mobile device.

### Debugging WebXR

- Use `chrome://flags#webxr-debug` to enable WebXR debug logging
- Enable `VITE_ENABLE_AR_DEBUG=true` in `.env` for additional overlay info
- Use Chrome DevTools remote debugging on connected Android devices

---

## Testing

### Unit Tests

```bash
npm run test
```

### Linting

```bash
npm run lint
```

### Build Verification

```bash
npm run build
npm run preview
```

Always verify the production build works before deploying.

---

## Deployment

### Firebase Hosting (Recommended)

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting (dev)
firebase deploy --only hosting -P dev

# Deploy to Firebase Hosting (prod)
firebase deploy --only hosting -P prod

# Deploy Firestore rules
firebase deploy --only firestore:rules -P dev
```

### Vercel (Alternative)

1. Push to GitHub
2. Connect repository in [Vercel Dashboard](https://vercel.com/dashboard)
3. Set environment variables in Vercel project settings
4. Deploy automatically on push to `main`

Vercel config (`vercel.json`):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Custom Domain

After deployment, add a custom domain:

```bash
firebase hosting:channel:deploy production --domain sharedspace.yourdomain.com
```

---

## Known Limitations

1. **Coordinate drift over time**: WebXR anchor stability degrades after ~15 minutes without re-alignment. Users should re-scan the QR marker periodically for best accuracy.

2. **8-user cap per room**: Firestore real-time listener performance degrades beyond 8 concurrent users per room. This can be increased with sharding for production deployments.

3. **Object count limit**: Each room supports up to 100 active 3D objects. Beyond this, Firestore document reads per second become a bottleneck.

4. **No cross-device AR consistency**: While objects are placed in a shared coordinate system, different device camera qualities and AR tracking systems may cause slight positional differences (1-5cm variance).

5. **iOS limitations**: Safari on iOS has limited WebXR support. iPhone users currently experience a non-AR 3D viewport mode rather than immersive camera pass-through.

6. **No audio**: Spatial audio for AR objects is not yet implemented. Currently, the experience is purely visual.

7. **No persistence across sessions**: Room state persists in Firestore, but the AR coordinate alignment must be re-established each session by scanning the QR marker.

8. **Bandwidth-dependent**: Poor network connections cause delayed object synchronization. The app works best on WiFi or 5G connections.

---

## Future Scalability Plan

### Phase 1: Performance (Current → v1.1)

- **Spatial indexing**: Implement octree-based spatial partitioning for efficient hit testing and object queries
- **Object pooling**: Pre-allocate Three.js geometries to reduce GC pressure
- **Adaptive quality**: Automatically reduce rendering quality based on device GPU capabilities
- **Compression**: Enable Draco/Meshopt compression for 3D models to reduce load times

### Phase 2: Multi-room Scaling (v1.2)

- **Sharded rooms**: Split large rooms across multiple Firestore collections for >8 user support
- **Federated presence**: Use Cloud Functions for inter-room user awareness
- **Edge computing**: Deploy Cloud Functions in regions closest to user clusters
- **Rate limiting**: Implement per-user rate limits on Firestore writes to prevent abuse

### Phase 3: Advanced Features (v2.0)

- **Persistent anchors**: Store anchor transforms for cross-session object persistence
- **3D model upload**: Allow users to upload and share custom 3D models (.glb, .gltf)
- **Spatial audio**: Integrate Howler.js or Web Audio API for positional sound
- **Hand tracking**: Support for Meta Quest and Vision Pro hand input
- **Collaborative annotations**: Draw and annotate in 3D space
- **Session recording**: Record and playback AR sessions for review

### Phase 4: Enterprise (v3.0)

- **SSO integration**: Firebase Auth with Google/Azure AD providers
- **Admin dashboard**: Room management, usage analytics, and moderation tools
- **Custom branding**: White-label support for enterprise deployments
- **SLA guarantees**: Dedicated Firestore instances and priority support
- **API access**: RESTful API for programmatic room management and object manipulation

### Infrastructure Scaling

| Metric | Current | Target (v2.0) |
|--------|---------|---------------|
| Concurrent users per room | 8 | 32 |
| Objects per room | 100 | 1,000 |
| Active rooms globally | 50 | 500 |
| Firestore reads/day | 1M | 50M |
| Deployment regions | 1 | 5 (multi-region) |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ES modules (`import`/`export`)
- Follow existing file naming conventions (PascalCase for components, camelCase for utilities)
- Keep components under 200 lines
- Write JSDoc comments for public APIs
- Test critical sync logic

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/sharedspace-ar/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/sharedspace-ar/discussions)
- **Security**: Report vulnerabilities to security@yourdomain.com
