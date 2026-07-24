# ERPNext Order Booking & GPS Route Tracking Sync Suite

This repository contains a standard, white-label client suite configured to sync field operations with an **ERPNext (Frappe)** backend.

## Repository Structure

* **`standard-api/`**: Shared TypeScript SDK & ERPNext REST connection client. Contains the `FrappeAdapter` and mock testing adapter.
* **`standard-web/`**: Admin Web Dashboard built with React, Vite, and custom CSS. Allows visual route tracing and synced sales order monitoring.
* **`standard-mobile/`**: Field Agent Mobile application built with React Native and Expo. Supports GPS background logs, check-ins, and catalog order booking.

---

## Quick Start

### 1. ERPNext Backend Setup
See [standard-api/README.md](./standard-api/README.md) for custom Doctypes (`GPS Location Log`, `Visit`, and `Company`) and permissions setup.

### 2. Run Admin Web Dashboard
```bash
cd standard-web
npm install
npm run dev
```

### 3. Run Field Agent Mobile App
```bash
cd standard-mobile
npm install
npm run start
```
