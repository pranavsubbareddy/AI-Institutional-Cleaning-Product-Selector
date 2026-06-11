# AI Institutional Cleaning Product Selector — Ganga Maxx 🧹🤖

An intelligent platform that helps institutions select the right cleaning products based on their specific requirements. Powered by AI (Google Gemini) and a rule-based recommendation engine.

> **Live Demo:** [AI Institutional Cleaning Product Selector](https://pranavsubbareddy.github.io/AI-Institutional-Cleaning-Product-Selector/)

---

## ✨ Features

- **Smart Recommendations** — AI-powered and rule-based product selection tailored to institution type, area size, surface types, hygiene standards, and budget
- **Institution Management** — Create, update, and manage institutional profiles (hospitals, schools, hotels, offices, restaurants, factories, etc.)
- **Product Catalog** — Browse cleaning products by category, surface type, and hygiene level
- **Dashboard & Analytics** — View stats, trends, and history of recommendations across institutions
- **Cost Estimation** — Get detailed cost breakdowns with monthly estimates for recommended products
- **Responsive UI** — Modern, mobile-friendly interface built with React and Tailwind CSS

---

## 🏗️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite 5** | Build tool & dev server |
| **Tailwind CSS 3** | Utility-first styling |
| **React Router v6** | Client-side routing |
| **Recharts** | Data visualization |
| **Lucide React** | Icons |
| **Axios** | HTTP client |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js / Express** | API server |
| **Google Gemini AI** | AI-powered recommendations |
| **MySQL** | Relational database |
| **Jest** | Testing |
| **express-validator** | Input validation |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **npm** or **yarn**
- **MySQL** database (optional, for full backend features)

### Quick Start

#### 1. Clone the repo

```bash
git clone https://github.com/pranavsubbareddy/AI-Institutional-Cleaning-Product-Selector.git
cd AI-Institutional-Cleaning-Product-Selector
```

#### 2. Backend Setup

```bash
cd Backend
npm install
cp .env.example .env   # Configure your environment variables
npm run dev            # Starts API server at http://localhost:5000
```

Required environment variables:
| Variable | Description |
|---|---|
| `PORT` | API server port (default: 5000) |
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name |
| `GEMINI_API_KEY` | Google Gemini API key |

#### 3. Frontend Setup

```bash
cd Frontend
npm install
npm run dev            # Starts dev server at http://localhost:5173
```

The frontend proxies `/api` requests to the backend automatically in development.

#### 4. Seed the Database (optional)

```bash
cd Backend
npm run seed
```

---

## 📖 Available Scripts

### Frontend (`cd Frontend`)

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

### Backend (`cd Backend`)

| Script | Description |
|---|---|
| `npm run dev` | Start server with auto-reload |
| `npm start` | Start server |
| `npm run seed` | Seed the database |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

---

## 🏗️ Project Structure

```
├── Backend/
│   ├── src/
│   │   ├── database/       # Schema & seed files
│   │   ├── engine/         # Recommendation engine & Gemini integration
│   │   ├── middleware/     # Express middleware (validation)
│   │   ├── routes/         # API route handlers
│   │   └── index.js        # Server entry point
│   ├── database/           # SQL schema
│   ├── server.js           # Standalone API server (in-memory)
│   └── package.json
├── Frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components (Home, Dashboard, etc.)
│   │   ├── services/       # API client & helpers
│   │   ├── App.jsx         # Root component with routing
│   │   ├── main.jsx        # App entry point
│   │   └── index.css       # Tailwind CSS imports
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── vercel.json             # Vercel deployment config
└── README.md
```

---

## 🧪 Testing

### Backend Tests

```bash
cd Backend
npm test
```

Tests cover:
- Recommendation engine logic
- Gemini service integration
- Input validation middleware

---

## 🌐 Deployment

### Vercel (Frontend)

The frontend is configured for Vercel deployment via `vercel.json`. Connect your repo to Vercel and it will auto-deploy.

### GitHub Pages

The app uses GitHub Pages for hosting. Build the frontend and deploy the `Frontend/dist` folder:

```bash
cd Frontend && npm run build
```

Then deploy the `dist/` folder to GitHub Pages.

### Backend

The backend can be deployed to:
- **Railway** / **Render** / **Fly.io**
- Any Node.js host

Set the `VITE_API_URL` environment variable on your frontend deployment to point to your hosted backend URL.

---

## 🛣️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/products` | List products (filterable) |
| `GET` | `/api/products/:id` | Get product details |
| `POST` | `/api/institutions` | Create institution |
| `GET` | `/api/institutions` | List institutions |
| `GET` | `/api/institutions/:id` | Get institution details |
| `PUT` | `/api/institutions/:id` | Update institution |
| `DELETE` | `/api/institutions/:id` | Delete institution |
| `POST` | `/api/recommendations/process` | Generate recommendation |
| `GET` | `/api/recommendations` | List recommendations |
| `GET` | `/api/recommendations/:id` | Get recommendation details |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |
| `GET` | `/api/dashboard/institutions` | Institution usage data |

---

## 📦 Product Categories

- **General Purpose Cleaners** — All-purpose, multi-surface cleaning
- **Disinfectants & Sanitizers** — Hospital-grade disinfection
- **Glass & Surface Cleaners** — Streak-free glass and surface cleaning
- **Floor Care** — Specialized floor cleaning solutions
- **Carpet & Upholstery** — Deep cleaning for fabrics
- **Stainless Steel & Metal** — Metal polishing and protection
- **Wood & Polishing** — Wood surface care
- **Toilet & Bathroom** — Specialized bathroom hygiene
- **Hand Hygiene** — Hand soaps and sanitizers
- **Industrial & Heavy Duty** — Tough cleaning for industrial settings
- **Bio-Enzymatic** — Eco-friendly enzymatic cleaners
- **Air Care** — Air fresheners and odor control

---

## 📄 License

This project is private and proprietary.

---

*Built with ❤️ for institutional cleaning excellence — Ganga Maxx Marketplace*
