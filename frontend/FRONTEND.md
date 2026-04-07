# SentinelClear v4.0 Frontend Architecture

## Overview
The frontend architecture for SentinelClear has been completely rebuilt as a highly polished, production-ready React 19 application utilizing Vite and a bespoke Tailwind CSS implementation. This fulfills our overarching requirement to abandon clunky rendering artifacts and ensure absolute predictability over UI state, network payloads, and real-time fraud event tracking.

## Tech Stack
- **Framework:** React 19 + Vite
- **Routing:** React Router v6
- **Styling:** Tailwind CSS (Custom dark-mode glassmorphic theme defined in `tailwind.config.js`)
- **Data Fetching:** Axios with JWT Interceptors (wiring straight to our FastAPI backend)
- **Visualizations:** Recharts (Radar charts for AI outputs, Bar/Line charts for velocity anomalies)
- **Icons:** Lucide React

## Component Hierarchy & Directory Architecture
```text
src/
├── components/
│   ├── Layout.jsx          # Core application shell, sidebar routing, sticky topbar
│   ├── ProtectedRoute.jsx  # JWT token validation wrapper shielding admin routes
│   ├── CommandPalette.jsx  # Ctrl+K global navigation search built from scratch
│   └── ui/                 # Reusable primitive UI blocks (Atoms)
│       ├── Button.jsx      # Multi-variant button with async loading
│       ├── Card.jsx        # Glassmorphic composite wrappers
│       ├── Input.jsx       # Standard inputs
│       ├── Badge.jsx
│       ├── Spinner.jsx
│       └── ConfirmationModal.jsx # Destructive flow interrupter
├── hooks/
│   └── useShortcut.js      # Robust keyboard binding logic
├── lib/
│   ├── axios.js            # Pre-configured axios instance + interceptors
│   ├── auth.js             # LocalStorage token helpers
│   └── utils.js            # Tailwind twMerge class utilities
└── pages/
    ├── Login.jsx           # Clean authentication gateways
    ├── Register.jsx
    ├── Dashboard.jsx       # Financial portal overview & fast tracking
    ├── Transfer.jsx        # Transfer form + Recharts AI Radar Analysis (The brain of SentinelClear)
    ├── Ledger.jsx          # Double-entry ledger lookup table parsing raw accounting data
    ├── FraudAnalytics.jsx  # Global analytics distributions mapping backend blocks vs reviews
    ├── OpsDashboard.jsx    # Realtime WS Rules Engine Control + Slider configurations
    ├── ChaosPanel.jsx      # Hard-stop Docker kill triggers for resilience testing
    ├── LiveMonitor.jsx     # Streaming event loop placeholder
    └── DevTools.jsx        # Future state sandbox
```

## Styling & Theming
The design language heavily employs **Glassmorphism**, leveraging Tailwind's opacity flags, absolute blurring (`backdrop-blur`), and tailored dark thematic tokens.
- **Background**: `bg-background` (`#0A0D12`)
- **Containers**: `bg-card` (`#151A22`)
- **Accents**: `primary` (`#3B8FFF`), `success` (`#00E5A0`), `danger` (`#F87171`), `warning` (`#F59E0B`)

Dark mode is user-controlled through the application theme toggle and is not hardcoded at build time.

## Testing Strategy
This frontend scaffolding is built for Vite and supports standard unit and integration testing in `tests/`, but no production test harness is bundled in this repository snapshot.
All UI flows are designed to align with FastAPI backend APIs and session state management.

## Running the Application
```bash
cd frontend
npm ci
npm run dev
# Connects seamlessly to api-gateway on localhost:8000 via proxy logic in vite.config.js
```
