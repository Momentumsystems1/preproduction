# Migration from Emerge to React v3.0

## Overview
This migration moves from Emerge to a traditional React stack with full control over:
- MapLibre GL integration
- Custom API layer
- Component architecture
- Real-time data flows

## Structure

```
frontend/
├── public/
│   └── index.html          # Entry point with MapLibre CSS
├── src/
│   ├── lib/
│   │   ├── api.js          # Axios API client
│   │   ├── mapStyles.js    # MapLibre style definitions
│   │   ├── hudConstants.js # Constants, icons, labels
│   │   ├── styleHelpers.js # Color/styling utilities
│   │   └── debug.js        # Debug utility
│   ├── components/
│   │   ├── MapContainer.jsx    # Core map component
│   │   └── HudPrimitives.jsx   # UI components (KPI, EventRow, etc.)
│   ├── App.jsx             # Main app
│   ├── index.js            # React entry
│   └── index.css           # Global styles + Tailwind
├── package.json
├── jsconfig.json           # Path alias for @/
└── .env.example            # Environment template
```

## Setup

1. **Install dependencies**
   ```bash
   cd frontend
   yarn install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your keys
   ```

3. **Start development**
   ```bash
   yarn start
   # Runs on http://localhost:3000
   ```

## Key Changes

### Before (Emerge)
- AI-generated components with limited control
- Emerge visual editor dependency
- Hard to debug API integrations
- Style changes not applying

### After (React v3.0)
- ✅ Full control over React components
- ✅ Custom API layer (axios)
- ✅ Direct MapLibre GL integration
- ✅ Tailwind CSS + custom utilities
- ✅ Proper state management
- ✅ Type hints ready (JSDoc)

## MapLibre Setup

The map now uses **MapTiler/FreeMaps** for tiles. Update your style URL in `lib/mapStyles.js`:

```javascript
style: "https://api.maptiler.com/maps/openstreetmap/style.json?key=YOUR_KEY"
```

## API Integration

All API calls go through `lib/api.js`:

```javascript
import { fetchEvents, fetchHealth, fetchParking } from "@/lib/api";

const events = await fetchEvents("madrid");
const health = await fetchHealth();
```

## Next Steps

1. Migrate remaining components from Emerge
2. Implement backend API (Node.js + Express)
3. Connect real data sources (DGT, Azure, etc.)
4. Deploy to staging
5. Mobile app (React Native)

## Support

For questions about the migration, see the repository issues or contact the development team.
