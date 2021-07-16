const express = require('express');
const app = express();
var path = require('path');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
var rooms={}

app.use(express.static(path.join(__dirname, 'static')));
app.get('/', (req, res) => {
    const path=Math.random().toString(36).substring(2);
    res.redirect('/'+path);
});

app.get('/:id', (req, res) => {
    //let id= req.params.id;
  res.sendFile(__dirname + '/index.html');
});

app.get('/:id/new-offer', (req, res) => {
  let id= req.params.id;
  res.send(JSON.stringify(rooms[id].new_offer));
});

io.on('connection', (socket) => {
    const url= new URL(socket.handshake.headers.referer);
    const id=url.pathname.slice(1);
    let room=rooms[id];
    if(room==null){
        room={};
        rooms[id]=room;
    }
    if(Object.keys(room).length===0){
        room.socket=socket;
        room.counter=1;
    }
    else{
        room.counter+=1;
    }
    console.log('a user connected',room.counter);
    socket.on('chat message', (msg) => {
        console.log('message: ' + msg);
      });
    socket.onAny((eventName, ...args) => {
        console.log(eventName);
        if(eventName.endsWith('new_offer'))
          room.new_offer=args[0];
        socket.broadcast.emit(eventName, args[0]);
    });
    socket.on('disconnect', () => {
        room.counter-=1;
        if(room.counter==0){
            room=null;
        }
      console.log('user disconnected',room?room.counter:null);
    });
  });

// server.listen(3000,"0.0.0.0" ,() => {
//   console.log('listening on *:3000');
// });
server.listen(80,"0.0.0.0");