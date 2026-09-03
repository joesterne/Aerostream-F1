<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Aerodynamics & Telemetry Simulator

An interactive, web-based aerodynamics simulation and telemetry dashboard designed to mimic race engineering environments (such as Formula 1). The application features a 3D wind tunnel view using Three.js, real-time simulated telemetry, and live standings.

View your app in AI Studio: https://ai.studio/apps/51c344b0-9873-4298-bc11-dfab6e1656a1

## Features

- **3D Wind Tunnel (Three.js):** 
  - Interactive 3D view of a car (Formula 1, Hypercar, or GT3) inside a simulated wind tunnel.
  - Dynamic airflow visualization using particle systems.
- **Aerodynamics & Telemetry Simulation:**
  - Real-time calculations of Lift, Drag, Downforce, and Aero Stability based on car setup.
- **Live Dashboard:**
  - Live charts using Recharts for telemetry timelines (Downforce Load, Cl/Cd ratios, Lap Times).
  - Pit stop strategy management and live standings simulation.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (if applicable)
3. Run the app:
   `npm run dev`
