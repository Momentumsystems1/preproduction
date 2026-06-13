# Momentum Road Command Center - Setup Instructions

## Migration Complete ✅

You've successfully migrated from Emerge to a clean React 19 + MapLibre GL architecture.

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
yarn install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your API keys:

```env
# Get your FREE MapTiler key from https://cloud.maptiler.com/
REACT_APP_MAPTILER_KEY=your_key_here

# Optional: Azure Maps for advanced features
REACT_APP_AZURE_MAPS_KEY=your_key_here

# Backend API
REACT_APP_API_BASE_URL=http://localhost:3001
```

### 3. Start Development Server

```bash
yarn start
```

App runs on: **http://localhost:3000**

## Project Structure

```
frontend/
├── public/
│   └── index.html           # Entry point with styles
├── src/
│   ├── lib/
│   │   ├── api.js           # Axios API client
│   │   ├── mapStyles.js     # MapLibre configurations
│   │   ├── hudConstants.js  # Icons, labels, colors
│   │   ├── styleHelpers.js  # Utility functions
│   │   └── debug.js         # Debug logging
│   ├── hooks/
│   │   └── useMapEvents.js  # Map event hooks
│   ├── components/
│   │   ├── MapContainer.jsx # Core map component
│   │   ├── HudPrimitives.jsx # UI primitives
│   │   └── MapControls.jsx  # Control components
│   ├── App.jsx              # Main app
│   ├── index.js             # React entry
│   └── index.css            # Global styles
├── .env.example
├── jsconfig.json
└── package.json
```

## Key Features

✅ **MapLibre GL Integration**
- Full control over map rendering
- FreeMaps/OpenStreetMap tile support
- Multiple style options (Normal, Satellite, 3D Terrain)

✅ **React 19 + Hooks**
- Modern React patterns
- Custom hooks for map events
- Clean component architecture

✅ **Tailwind CSS**
- Dark mode tactical UI
- Glassmorphism effects
- Responsive controls

✅ **API Layer**
- Centralized Axios client
- Easy API endpoint management
- Error handling ready

## API Integration

All API calls go through `src/lib/api.js`:

```javascript
import { fetchEvents, fetchHealth, fetchParking } from "@/lib/api";

// Example usage
const events = await fetchEvents("madrid");
const health = await fetchHealth();
const parking = await fetchParking(40.41678, -3.70379, 1500);
```

## Creating Backend

You'll need a backend API server. Here's a quick Node.js + Express setup:

```bash
mkdir backend
cd backend
npm init -y
npm install express cors axios dotenv
```

Create `backend/server.js`:

```javascript
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Example endpoints
app.get('/events/:city', (req, res) => {
  // Fetch from DGT/Azure/etc
  res.json({ count: 0, features: [], risk: "bajo" });
});

app.get('/health', (req, res) => {
  res.json({ sources: { "DGT 3.0": "OK", "SCT": "OK" } });
});

app.listen(3001, () => console.log('API on :3001'));
```

Run: `node server.js`

## Next Steps

1. ✅ Frontend setup (done)
2. 🔄 Create backend API
3. 🔄 Connect real data sources
4. 🔄 Build command center components
5. 🔄 Deploy to staging
6. 🔄 Mobile app (React Native)

## Troubleshooting

**Map not showing?**
- Check browser console for errors
- Verify `.env.local` has correct API key
- Ensure map container has width/height

**FreeMaps tiles not loading?**
- Verify `REACT_APP_MAPTILER_KEY` is set
- Check MapTiler quota isn't exceeded
- Try OSM fallback (no key needed)

**Build errors?**
- Delete `node_modules` and `.cache`
- Run `yarn install` again
- Check Node version (16+)

## Support

For questions:
- Check repository issues
- Review MIGRATION_GUIDE.md
- Contact development team

---

**Happy coding! 🚀**
