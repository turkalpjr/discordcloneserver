const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const twilio = require('twilio');

const PORT = process.env.PORT || 5002;
const app = express();
const server = http.createServer(app);

app.use(cors());

let connectedUsers = [];
let rooms = [];

//create route to check if room exists

app.get('/api/room-exists/:roomId', (req, res) => {
    debugger;
    const { roomId } = req.params;
    const room = rooms.find(room => room.id === roomId);
    if (room) {
        //send response that room exists
        if (room.connectedUsers.length > 3) {
            return res.send({ roomExists: true, full: true });
        } else {
            return res.send({ roomExists: true, full: false });
        }
    } else {
        // send response that room does not exist
        return res.send({ roomExists: false }).status;
    }
})

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});


io.on('connection', (socket) => {
    console.log(`user connected ${socket.id}`);
    socket.on('create-new-room', (data) => {
        createNewRoomHandler(data, socket);
    });
    socket.on('join-room', (data) => {
        joinRoomHandler(data, socket);
    });
    socket.on('disconnect', () => {
        disconnectHandler(socket);
    });
    socket.on('conn-signal', data => {
        signalingHandler(data, socket);
    });
    socket.on('conn-init', data => {
        initializeConnectionHandler(data, socket);
    });
})

//socket.io handlers....

const createNewRoomHandler = (data, socket) => {
    console.log('host is creating new room');
    console.log(data);
    const { identity } = data;
    const roomId = uuidv4();
    //create new user
    const newUser = {
        identity,
        id: uuidv4(),
        socketId: socket.id,
        roomId
    };
    //push that user to connectedusers
    connectedUsers = [...connectedUsers, newUser];
    //createnew room
    const newRoom = {
        id: roomId,
        connectedUsers: [newUser]
    }
    //join socket.io room
    socket.join(roomId);
    rooms = [...rooms, newRoom];

    socket.emit('room-id', { roomId });
    //emit to that client wich created that room roomId
    //emit an event to all users connected to that room about new users which are right in this room
    socket.emit('room-update', { connectedUsers: newRoom.connectedUsers });
};

const joinRoomHandler = (data, socket) => {
    const { identity, roomId } = data;
    const newUser = {
        identity,
        id: uuidv4(),
        socketId: socket.id,
        roomId
    }
    //join room as user who is trying to join roomm passing room id
    const room = rooms.find(room => room.id === roomId);
    room.connectedUsers = [...room.connectedUsers, newUser];

    /// join socket.io room
    socket.join(roomId);
    //add new user to connected users array

    connectedUsers = [...connectedUsers, newUser];

    //emit to all users which are already in this room to prepare peer connection

    room.connectedUsers.forEach(user => {
        if (user.socketId !== socket.id) {
            const data = {
                connUserSocketId: socket.id
            }
            io.to(user.socketId).emit('conn-prepare', data);
        }
    })
    io.to(roomId).emit('room-update', { connectedUsers: room.connectedUsers });
};

const disconnectHandler = (socket) => {
    // check user registersed if yes remove him from room 
    const user = connectedUsers.find((user) => user.socketId === socket.id);
    if (user) {
        /// remove user from server 
        const room = rooms.find(room => room.id === user.roomId);
        room.connectedUsers = room.connectedUsers.filter(user => user.socketId !== socket.id);
        // leave socket io room 
        socket.leave(user.roomId);
        //emit an event to rest of the users which left in the room new connected users in room
        //close the room if amount of the users which will stay will be 0
        if (room.connectedUsers.length > 0) {
            //emit to all users which are still in the room that user disconnected
            io.to(room.id).emit('user-disconnected',{socketId:socket.id});
            io.to(room.id).emit('room-update', {
                connectedUsers: room.connectedUsers,
            });
        } else {
            rooms = rooms.filter((r) => r.id !== room.id);
        }
    }
};

const signalingHandler = (data, socket) => {
    const { connUserSocketId, signal } = data;
    const signalingData = { signal, connUserSocketId: socket.id };
    io.to(connUserSocketId).emit('conn-signal', signalingData);
};

//information from clients which are already in room that they have prepared for incoming connection

const initializeConnectionHandler = (data, socket) => {
    const { connUserSocketId } = data;
    const initData = { connUserSocketId: socket.id };
    io.to(connUserSocketId).emit('conn-init', initData);
};



server.listen(PORT, () => {
    console.log(`Server is listening on ${PORT}`);
})





