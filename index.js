const express = require("express");
const app = express();
const http = require("http").Server(app);
const path = require("path");
const cors = require("cors");
const io = require("socket.io")(http, {
  cors: {
    origin: ["http://localhost:3000", "https://giphy-chat.vercel.app"],
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const users = [];
const typers = [];

const dbConfig = require("./config");
const port = process.env.PORT || 5000;

const Message = require("./message.model");
const mongoose = require("mongoose");

mongoose
  .connect(dbConfig.MONGODB_URI, {
  useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
  })
  .then(() => {
    console.log("Successfully connected to the database");
  })
  .catch((err) => {
    console.log("Could not connect to the database. Exiting now...", err);
    process.exit();
  });

app.use(express.static(path.join(__dirname, "/app.html")));
app.use(cors());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
  next();
});
app.get("/", (req, res) => {
  res.json({
    message: "Giphy Chat Server is Running",
    time: new Date().toString(),
  });
});

io.on("connection", (socket) => {
  // Get users
  users.push({ id: socket.id });
  io.emit("users", { users: users });

  // Get all typers
  io.emit("typers", { typers: typers });

  // Get the last 10 messages from the database.
  Message.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .exec((err, messages) => {
      if (err) return console.error(err);

      // Send the last messages to the user.
      socket.emit("init", messages);
    });

  // Listen to connected users for a new message.
  socket.on("message", (msg) => {
    // Create a message with the content and the name of the user.
    const message = new Message({
      message: msg.message,
      gif: msg.gif,
      sender_id: msg.sender_id,
      sender_name: msg.sender_name,
    });

    // Save the message to the database.
    message.save((err) => {
      if (err) return console.error(err);
    });

    // Notify all other users about a new message.
    socket.broadcast.emit("push", msg);
  });

  // Listen typing events
  socket.on("start_typing", (data) => {
    typers.push(data.user);
    io.emit("typers", { typers: typers });
  });
  socket.on("stop_typing", (data) => {
    // Remove typer
    let index = -1;
    for (let i = 0; i < typers.length; i++) {
      const typer = typers[i];
      if (typer === data.user) {
        index = i;
      }
    }
    // Remove user
    if (index !== -1) {
      typers.splice(index, 1);
    }
    io.emit("typers", { typers: typers });
  });

  socket.on("disconnect", (reason) => {
    // Remove user
    let index = -1;
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user.id === socket.id) {
        index = i;
      }
    }
    // Remove user
    if (index !== -1) {
      users.splice(index, 1);
    }
    io.emit("users", { users: users });
    typers.length = 0;
    io.emit("typers", { typers: typers });
  });
});

http.listen(port, () => {
  console.log("listening on *:" + port);
});
