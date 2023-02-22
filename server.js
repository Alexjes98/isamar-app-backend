const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./database.js");
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const app = express();
const auth = require("./auth");



app.use(
  cors({
    origin: ["http://localhost:3000"],
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const upload = multer({
  limits: {
    fileSize: 4 * 1024 * 1024,
  }
});

app.use(express.static('./img'))

module.exports = app;