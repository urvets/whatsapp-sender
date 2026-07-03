# WhatsApp API Gateway & Developer Console

A lightweight, robust, and modern WhatsApp API Gateway designed to send automated messages, notifications, and alerts programmatically via simple HTTP requests. It features a modular TypeScript backend powered by Express and `@whiskeysockets/baileys`, alongside a premium dark-themed developer dashboard console.

---

## Key Features

- 🛠️ **Modular Architecture**: Built with TypeScript, separating connection handling, Express routing, configurations, and bootstrap sequences.
- ⚖️ **Load Balancing**: Distributes sending workloads using round-robin scheduling across all active connected WhatsApp device sessions.
- 🕒 **Rate Limiting & Queue Manager**: Database-backed queuing that staggers message dispatches according to a dynamically configured delay interval to prevent automated spam detection.
- 🔁 **Attempts & Timeout Policies**: Automatically tracks delivery attempts and logs detailed error messages. Messages automatically retry up to 3 times before permanently failing.
- 🔒 **API Key Security**: Secure conditional middleware protecting REST endpoints.
- 🖥️ **Premium Dashboard Console**: High-fidelity dark mode interface equipped with:
  - **Dynamic Port & Tunnel Routing**: Generates `/config.js` to automatically map backend API bases and API Keys to client browsers over custom reverse proxy tunnels (e.g. Cloudflare Tunnels).
  - **Outbox History & Queue Pagination**: Smoothly pages historical delivery logs and queue managers with Prev/Next navigation controls.
  - **Error Inspector Sidebar**: Collapsible right detail drawer detailing message metadata, error stack traces, and offering direct click-to-resend message queueing.
  - **Live Connection Monitor**: Displays active devices, status badges, and request pairing codes/QR codes.
  - **API Sandbox**: Test endpoint dispatches directly from the browser, displaying full JSON response payloads.
- 🐳 **Docker-Ready**: Packaged with an optimized multi-stage Docker build utilizing prune and module caching for ultra-fast deployments.

---

## Directory Structure

```text
├── src/
│   ├── config.ts     # Configuration parser & dotenv variables handler
│   ├── whatsapp.ts   # WhatsAppService wrapping Baileys socket controller & format utilities
│   ├── db.ts         # Bounded SQLite database connection and log query filtering
│   ├── queue.ts      # Active background queue scheduler
│   └── index.ts      # Gateway bootstrapper
├── public/
│   ├── index.html    # Premium developer console interface
│   ├── app.js        # Dashboard state management and event bindings
│   └── style.css     # CSS custom scrollbars and overlays
├── auth_info/        # Generated multi-file authentication session files
├── dist/             # Compiled JavaScript output
├── Dockerfile        # Multi-stage production container config
├── docker-compose.yml# Docker services orchestrator
├── package.json      # Dependencies and scripts definitions
├── tsconfig.json     # TypeScript compiler settings
```

---

## Configuration

Duplicate the `.env.example` file and create a `.env` file in the root directory:

```ini
API_PORT=3000
FRONTEND_PORT=3001
API_KEY=your_secret_api_key_here
QUEUE_DELAY_MS=2000
API_URL=http://localhost:3000
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `API_PORT` | The port hosting the REST API endpoints. | `3000` |
| `FRONTEND_PORT` | The port hosting the static dashboard web interface. | `3001` |
| `API_KEY` | Optional secret key. If specified, all operational APIs require authentication. | `None` |
| `QUEUE_DELAY_MS` | Delay in milliseconds between processing queued messages. | `5000` |
| `API_URL` | Public endpoint domain of the API, used to resolve requests in browser environments. | `None` |

---

## Launch Instructions

### Method 1: Using Docker Compose (Recommended)

1. Build and run the services:
   ```bash
   docker compose up --build -d
   ```
2. Open your web browser and navigate to the configured Frontend Port:
   - **Console Dashboard**: `http://localhost:3001` (or your reverse-tunnel URL).

### Method 2: Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the gateway in development mode (using `ts-node`):
   ```bash
   npm run dev
   ```
3. Compile to production bundles:
   ```bash
   npm run build
   ```
4. Start compiled production server:
   ```bash
   npm run start
   ```

---

## REST API Documentation

All endpoints require the `x-api-key: YOUR_API_KEY` header if `API_KEY` is defined in the `.env` file.

### 1. Send Message
Send a text message to a specific WhatsApp phone number, optionally logging it to a specific Clinic ID.
* **Route**: `POST /api/send`
* **Auth**: Secured
* **Body (JSON)**:
  ```json
  {
    "phone": "15551234567",
    "message": "Hello from API Gateway!",
    "clinicId": "CLINIC_123"
  }
  ```
* **Response (JSON)**:
  ```json
  {
    "success": true,
    "status": "queued",
    "queueId": "1782971094989-7i629dm11",
    "message": "Message successfully queued for sending"
  }
  ```
