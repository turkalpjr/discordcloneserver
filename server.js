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
    })
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
    const {identity,roomId}=data;
    const newUser={
        identity,
        id:uuidv4(),
        socketId:socket.id,
        roomId
    }
    //join room as user who is trying to join roomm passing room id
    const room= rooms.find(room=>room.id===roomId);
    room.connectedUsers=[...room.connectedUsers,newUser];

    /// join socket.io room
    socket.join(roomId);
    //add new user to connected users array

    connectedUsers= [...connectedUsers,newUser];
    io.to(roomId).emit('room-update',{connectedUsers:room.connectedUsers});
};

server.listen(PORT, () => {
    console.log(`Server is listening on ${PORT}` );
})





