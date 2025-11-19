const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const app = express();
const port = 3006; // Use dedicated port for port manager

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to get working directory for a PID
async function getWorkingDirectory(pid) {
  try {
    const { stdout } = await execPromise(`lsof -p ${pid} -a -d cwd 2>/dev/null | tail -1 | awk '{print $NF}'`);
    const cwd = stdout.trim();

    // Replace home directory with ~
    const homeDir = process.env.HOME;
    if (cwd && homeDir && cwd.startsWith(homeDir)) {
      return cwd.replace(homeDir, '~');
    }

    return cwd || null;
  } catch (error) {
    return null;
  }
}

// Helper function to get full command for a PID
async function getFullCommand(pid) {
  try {
    const { stdout } = await execPromise(`ps -ww -p ${pid} -o args= 2>/dev/null`);
    const fullCmd = stdout.trim();

    // Try to extract just the script/relevant part
    if (fullCmd.includes('node ')) {
      // For Node.js, extract the script path
      const match = fullCmd.match(/node\s+(.+?)(?:\s|$)/);
      if (match) {
        const scriptPath = match[1];
        // Get just the filename if it's a path
        return scriptPath.split('/').pop() || fullCmd;
      }
    } else if (fullCmd.includes('python') || fullCmd.includes('Python')) {
      // For Python, extract the script name
      const match = fullCmd.match(/[Pp]ython.*?\s+([^\s]+\.py)/);
      if (match) {
        return match[1].split('/').pop();
      }
    }

    // For other commands, try to get a meaningful short version
    const parts = fullCmd.split(' ');
    if (parts.length > 1) {
      // Return first 3 parts for context
      return parts.slice(0, 3).join(' ') + (parts.length > 3 ? '...' : '');
    }

    return fullCmd || null;
  } catch (error) {
    return null;
  }
}

// Get all ports in use
app.get('/api/ports', async (req, res) => {
  try {
    // Use lsof to get all listening ports
    const { stdout } = await execPromise('lsof -i -P -n | grep LISTEN');

    const lines = stdout.trim().split('\n');
    const ports = [];
    const seen = new Set();

    for (const line of lines) {
      // Parse lsof output
      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        const command = parts[0];
        const pid = parts[1];
        const user = parts[2];
        const addressPort = parts[8];

        // Extract port number from address:port format
        const portMatch = addressPort.match(/:(\d+)$/);
        if (portMatch) {
          const portNum = portMatch[1];
          const uniqueKey = `${pid}-${portNum}`;

          // Avoid duplicates
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            ports.push({
              port: portNum,
              pid: pid,
              command: command,
              user: user,
              address: addressPort,
              cwd: null,
              fullCommand: null
            });
          }
        }
      }
    }

    // Fetch additional info for each port in parallel
    await Promise.all(ports.map(async (portInfo) => {
      const [cwd, fullCommand] = await Promise.all([
        getWorkingDirectory(portInfo.pid),
        getFullCommand(portInfo.pid)
      ]);
      portInfo.cwd = cwd;
      portInfo.fullCommand = fullCommand;
    }));

    // Sort by port number
    ports.sort((a, b) => parseInt(a.port) - parseInt(b.port));

    res.json({ ports });
  } catch (error) {
    // If no ports are found, lsof returns error, so return empty array
    if (error.code === 1) {
      res.json({ ports: [] });
    } else {
      console.error('Error fetching ports:', error);
      res.status(500).json({
        error: 'Failed to fetch ports',
        details: error.message
      });
    }
  }
});

// Kill a process by PID
app.post('/api/kill/:pid', async (req, res) => {
  try {
    const { pid } = req.params;

    // Validate PID is a number
    if (!/^\d+$/.test(pid)) {
      return res.status(400).json({ error: 'Invalid PID' });
    }

    await execPromise(`kill ${pid}`);

    res.json({
      success: true,
      message: `Process ${pid} terminated`
    });
  } catch (error) {
    console.error('Error killing process:', error);
    res.status(500).json({
      error: 'Failed to kill process',
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Port manager running on http://localhost:${port}`);
});
