# Port Manager

A web-based tool for managing and monitoring network ports on your local system.

## Features

- View all active ports and their associated processes
- See detailed process information (PID, command, working directory)
- Kill processes directly from the web interface
- Real-time port monitoring

## Prerequisites

- Node.js (v14 or higher)
- macOS/Linux (uses `lsof` command)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd port-manager
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3006
```

The server will display all active ports and allow you to manage them through the web interface.

## API Endpoints

### GET /api/ports
Returns a list of all ports currently in use on the system.

**Response:**
```json
{
  "ports": [
    {
      "port": "3006",
      "pid": "12345",
      "command": "node",
      "user": "username",
      "address": "*:3006",
      "cwd": "~/project/port-manager",
      "fullCommand": "server.js"
    }
  ]
}
```

### POST /api/kill/:pid
Terminates a process by its PID.

**Parameters:**
- `pid` - Process ID to terminate

**Response:**
```json
{
  "success": true,
  "message": "Process 12345 terminated"
}
```

## Configuration

The server runs on port 3006 by default. To change this, edit the `port` variable in `server.js`:

```javascript
const port = 3006; // Change to your desired port
```

## Note

This tool requires appropriate permissions to view and kill processes. You may need to run it with elevated privileges for certain operations.
