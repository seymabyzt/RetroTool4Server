
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server, Socket } from "socket.io";

const app = express()
app.use(cors())

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: [
            "https://retro-tool4.vercel.app", 
            "http://localhost:3000"],
        methods: ["GET", "POST"],
    },
})

type UserInfo = {
    userID: string;
    socketID: string;
  };
  
  type RoomInfo = {
    adminUserID: string | null;   
    users: UserInfo[];           
  };
  
  const rooms: Record<string, RoomInfo> = {};

io.on('connection', (socket: Socket) => {
    socket.on('joinRoom', ({ roomID, userID }) => {
  
      socket.join(roomID);
  
      if (!rooms[roomID]) {
        rooms[roomID] = {
          adminUserID: null,
          users: []
        };
      }
  
      const room = rooms[roomID];
      let existingUser = room.users.find(u => u.userID === userID);
  
      if (!existingUser) {
        existingUser = {
          userID,
          socketID: socket.id
        };
        room.users.push(existingUser);
      } else {
        existingUser.socketID = socket.id;
      }
  
      if (!room.adminUserID) {
        room.adminUserID = userID;
      }
  
      const isAdmin = (room.adminUserID === userID);
      io.to(socket.id).emit("adminAssigned", isAdmin);
      io.to(roomID).emit("userCount", room.users.length);
      io.to(roomID).emit("userList", rooms[roomID].users);
    });

    socket.on("commentContent", (data) => {
        socket.to(data.roomID).emit("commentReturn", data)
    })

    socket.on('deleteComment', ({ commentID, roomID }) => {
        io.to(roomID).emit('commentDeleted', {commentID, roomID})
    })

    socket.on("stepChange", ({ roomID, newStep }) => {
        io.to(roomID).emit("stepUpdated", newStep)
    })

    socket.on("likeCount", ({ commentID, roomID, column, userID }) => {
        io.to(roomID).emit("likeCountUpdated", { commentID, column, userID })
    })

    socket.on("updateCommentContent", ({ roomID, column, updatedComments }) => {
        io.to(roomID).emit("commentListUpdated", { column, updatedComments })
    })

    socket.on("disconnect", () => {
        for (const roomID of socket.rooms) {
          if (!rooms[roomID]) continue;
    
          const room = rooms[roomID];
          const userIndex = room.users.findIndex(u => u.socketID === socket.id);
    
          if (userIndex !== -1) {
            const leavingUser = room.users[userIndex];
            room.users.splice(userIndex, 1);
    
            if (leavingUser.userID === room.adminUserID) {
              if (room.users.length > 0) {
                const newAdmin = room.users[0];
                room.adminUserID = newAdmin.userID;
                io.to(newAdmin.socketID).emit("adminAssigned", true);
              } else {
                room.adminUserID = null;
              }
            }
          }
          io.to(roomID).emit("userCount", room.users.length);
        }
    })
})

const port = 8000

server.listen(port, () => {
    console.log(`Server is running on port ${port}.`)
})