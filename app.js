const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const busLogs = {}; 
// The secret key for drivers
const SECURITY_KEY = "4578"; 

io.on('connection', (socket) => {
    console.log('New Device Linked: ' + socket.id);
    socket.isAuthorized = false; // Default to unauthorized

    // Handle authentication request
    socket.on('verify-driver', (key) => {
        if (key === SECURITY_KEY) {
            socket.isAuthorized = true;
            socket.emit('auth-success');
            console.log(`Driver Authorized: ${socket.id}`);
        } else {
            socket.emit('auth-failure', "Incorrect Security Key!");
        }
    });

    socket.on('report-occupancy', (data) => {
        if (!socket.isAuthorized) return; // Block unauthorized data

        socket.occupancyStatus = data.status;
        socket.occupancyPercent = data.percent;
        socket.occupancyColor = data.color;

        io.emit('status-updated', { 
            id: socket.id, 
            status: data.status,
            percent: data.percent,
            color: data.color
        });
    });

    socket.on('send-location', (data) => {
        if (!socket.isAuthorized) return; // Block unauthorized data

        const now = Date.now();
        const prev = busLogs[socket.id] || { latitude: data.latitude, longitude: data.longitude, timestamp: now };
        const moved = Math.abs(data.latitude - prev.latitude) > 0.0001 || Math.abs(data.longitude - prev.longitude) > 0.0001;
        const isStuck = !moved && (now - prev.timestamp > 180000);

        if (moved) {
            busLogs[socket.id] = { ...data, timestamp: now };
        }

        io.emit('receive-location', { 
            id: socket.id, 
            status: socket.occupancyStatus || "Available",
            percent: socket.occupancyPercent || 10,
            color: socket.occupancyColor || "#2ecc71",
            isStuck: isStuck,
            role: 'driver', // Ensure receivers know this is a verified driver
            ...data 
        });
    });

    socket.on('disconnect', () => {
        delete busLogs[socket.id];
        io.emit('user-disconnected', socket.id);
        console.log('Device Disconnected: ' + socket.id);
    });
});

const PORT = 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`\n> ECOROUTE ACTIVE: http://localhost:${PORT}`);
    console.log(`> DRIVER KEY SET TO: ${SECURITY_KEY}\n`);
});
