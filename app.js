const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

//Frontend files
app.use(express.static('public'));

// Storage for bus tracking logs
const busLogs = {}; 

io.on('connection', (socket) => {
    console.log('New Device Linked: ' + socket.id);

    // Instant Status & Capacity Update Logic
    socket.on('report-occupancy', (data) => {
        // Store status and visual data on the socket object
        socket.occupancyStatus = data.status;
        socket.occupancyPercent = data.percent;
        socket.occupancyColor = data.color;

        // Broadcast the update to everyone immediately
        io.emit('status-updated', { 
            id: socket.id, 
            status: data.status,
            percent: data.percent,
            color: data.color
        });
    });

    // Real-Time Location & Traffic Analysis
    socket.on('send-location', (data) => {
        const now = Date.now();
        const prev = busLogs[socket.id] || { latitude: data.latitude, longitude: data.longitude, timestamp: now };
        
        // To Check if moved significantly (approx 10 meters)
        const moved = Math.abs(data.latitude - prev.latitude) > 0.0001 || Math.abs(data.longitude - prev.longitude) > 0.0001;
        
        // If No movement for 3 minutes
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
            ...data 
        });
    });

    socket.on('disconnect', () => {
        delete busLogs[socket.id];
        io.emit('user-disconnected', socket.id);
        console.log('Device Disconnected: ' + socket.id);
    });
});

// PORT CONFIGURATION
const PORT = 3000;

//Portable Mode
http.listen(PORT, '0.0.0.0', () => {
    console.log("\n==========================================");
    console.log("   ECOROUTE SYSTEM STARTED SUCCESSFULLY   ");
    console.log("==========================================");
    console.log(`> Local Access: http://localhost:${PORT}`);
    console.log(`> Network Access: Use your IP address`);
    console.log(`> Status: Server is active and listening...`);
    console.log("==========================================\n");

});
