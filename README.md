# Smart Restaurant - Kitchen Display System (KDS) 👨‍🍳

Real-time kitchen order management display screen for chef and staff.

## Features
- 🔔 Live incoming order alerts with optional sound chime
- 📋 Organized kitchen tickets with item quantities & special cooking instructions
- ⚡ 1-click status workflow: `Pending` ➔ `Preparing` ➔ `Ready` ➔ `Dispatched / Served`
- 🚚 Dedicated tab for Bulk Home Delivery dispatches
- 🚫 Strict cancellation safeguards for in-progress meals

## Setup & Running
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   ```bash
   copy .env.example .env
   ```
   Add your Supabase URL and Anon Key.
3. Start development server (Port 3001):
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
