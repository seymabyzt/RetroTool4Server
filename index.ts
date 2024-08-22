const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc } = require('firebase/firestore');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "https://retro-tool4.vercel.app", "http://localhost:3000"],
        methods: ["GET", "POST"],
    },
});

// Firebase ve Firestore'u başlatma
const firebaseConfig = {
    apiKey: 'AIzaSyAAplxKrfuUzBqEfPhK5T3p7Pq1AUMbhw0',
    authDomain: 'retrotool4.firebaseapp.com',
    projectId: 'retrotool4',
    storageBucket: 'retrotool4.appspot.com',
    messagingSenderId:'72273977179',
    appId: '1:72273977179:web:53743ae01b24e27364c47e',
    measurementId: 'G-Y1MYHFG4EQ'
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const rooms = {};

io.on("connection", (socket) => {
    socket.on("roomID", (data) => {
        const { roomID } = data;

        socket.join(roomID);

        if (!rooms[roomID]) {
            rooms[roomID] = [];
        }

        if (!rooms[roomID].includes(socket.id)) {
            rooms[roomID].push(socket.id);
        }

        if (rooms[roomID].length === 1) {
            io.to(socket.id).emit("adminAssigned", true);
        } else {
            io.to(socket.id).emit("adminAssigned", false);
        }
    });

    // Yorum eklendiğinde Firestore'a ekle ve diğer kullanıcılara bildir
    socket.on("commentContent", async (data) => {
        const { roomID, comment, userID, column, commentID, date, likeCount, likedByUsers } = data;

        try {
            // Firestore'a yeni bir yorum ekle
            await addDoc(collection(db, 'comments'), {
                roomID,
                commentID,
                userID,
                column,
                comment,
                date,
                likeCount,
                likedByUsers,
            });

            // Yorum eklendiğini diğer kullanıcılara bildir
            io.to(roomID).emit("commentReturn", data);
        } catch (error) {
            console.error("Error adding comment: ", error);
        }
    });

    // Yorum silindiğinde Firestore'dan sil ve diğer kullanıcılara bildir
    socket.on('deleteComment', async ({ commentID, roomID }) => {
        try {
            const commentRef = doc(db, 'comments', commentID);
            await deleteDoc(commentRef);

            // Yorumun silindiğini diğer kullanıcılara bildir
            io.to(roomID).emit('commentDeleted', commentID);
        } catch (error) {
            console.error("Error deleting comment: ", error);
        }
    });

    // Adım değiştiğinde diğer kullanıcılara bildir
    socket.on("stepChange", ({ roomID, newStep }) => {
        io.to(roomID).emit("stepUpdated", newStep);
    });

    // Beğeni sayısını artır ve diğer kullanıcılara bildir
    socket.on("likeCount", async ({ commentID, roomID, column, userID }) => {
        try {
            const commentRef = doc(db, 'comments', commentID);
            await updateDoc(commentRef, {
                likeCount: getFirestore.FieldValue.increment(1),
                likedByUsers: getFirestore.FieldValue.arrayUnion(userID),
            });

            // Beğeni sayısının güncellendiğini diğer kullanıcılara bildir
            io.to(roomID).emit("likeCountUpdated", { commentID, column, userID });
        } catch (error) {
            console.error("Error updating like count: ", error);
        }
    });

    // Yorum içeriği güncellendiğinde Firestore'u güncelle ve diğer kullanıcılara bildir
    socket.on("updateCommentContent", async ({ roomID, column, updatedComments }) => {
        try {
            for (const updatedComment of updatedComments) {
                const commentRef = doc(db, 'comments', updatedComment.commentID);
                await updateDoc(commentRef, {
                    comment: updatedComment.comment,
                });
            }

            // Yorum listesinin güncellendiğini diğer kullanıcılara bildir
            io.to(roomID).emit("commentListUpdated", { column, updatedComments });
        } catch (error) {
            console.error("Error updating comment content: ", error);
        }
    });

    socket.on("disconnecting", () => {
        for (const roomID of socket.rooms) {
            const index = rooms[roomID]?.indexOf(socket.id);
            if (index !== -1 && rooms[roomID]) {
                rooms[roomID].splice(index, 1);

                if (index === 0 && rooms[roomID].length > 0) {
                    const newAdminID = rooms[roomID][0];
                    io.to(newAdminID).emit("adminAssigned", { isAdmin: true });
                }
            }
        }
    });
});
console.log(firebaseConfig);
const port = 8000;

server.listen(port, () => {
    console.log(`Server is running on port ${port}.`);
});
