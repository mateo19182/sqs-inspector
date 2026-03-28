# SQS Inspector

A simple local development tool for inspecting AWS SQS queue contents.

## Features

- View all SQS queues (auto-filters for email/DLQ queues)
- See message counts (available and in-flight)
- Peek at message contents without consuming them
- View full message details including body, attributes, and metadata
- Manual refresh for both queues and messages
- Auto-discovers queues from your AWS account

## Setup

### Prerequisites

- Node.js 18+ installed
- AWS credentials configured (via `~/.aws/credentials` or environment variables)
- AWS CLI access to SQS

### Installation

```bash
# Install all dependencies
npm run install:all
```

### Environment Variables (Optional)

Create a `.env` file in the `backend/` directory:

```env
AWS_REGION=eu-south-2  # Default region
PORT=3001              # Backend port (frontend runs on 3000)
```

If not set, it defaults to `eu-south-2`.

## Running

```bash
# Start both frontend and backend
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## How It Works

1. **Queue Discovery**: The backend lists all SQS queues in your AWS account and filters for queues containing "email" or "dlq" in the name.

2. **Message Peeking**: Uses SQS `ReceiveMessage` API to peek at messages without removing them from the queue. Messages remain visible to other consumers.

3. **Auto-Refresh**: Click "Refresh" buttons to update queue counts or reload messages.

## Usage

1. Select a queue from the left panel
2. Click "Refresh" to load messages
3. Click any message to view its full content
4. The modal shows:
   - Message body (pretty-printed JSON if applicable)
   - System attributes (sent timestamp, receive count, etc.)
   - Custom message attributes

## Architecture

```
Frontend (React + Vite)
    ↓ HTTP/REST
Backend (Express + AWS SDK)
    ↓ AWS API
SQS (eu-south-2)
```

Simple, no-auth, local-only tool for development debugging.
