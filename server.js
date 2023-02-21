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


app.post("/register", async (req, res) => {
  try {
    const { nombre, apellido, dni, password, telefono, rol } = req.body;
    if (!(dni && password && nombre && apellido)) {
      res.status(400).send("All input is required");
    }

    let dbquery = `SELECT * FROM users WHERE dni=${dni}`;
    const oldUser = await db.query(dbquery);

    if (Array.isArray(oldUser) && oldUser.length > 0) {
      return res.status(409).send("User Already Exist. Please Login");
    }
    encryptedPassword = await bcrypt.hash(password, 10);

    dbquery = "INSERT INTO `users` (`dni`, `nombre`, `apellido`, `telefono`, `password`, `id`, `rol`) VALUES";
    const values = ` ('${dni}', '${nombre}', '${apellido}', '${telefono}', '${encryptedPassword}', NULL,'${rol}')`;
    dbquery += values;
    const user = await db.query(dbquery);

    const token = jwt.sign(
      { user_id: user.insertId, dni },
      process.env.TOKEN_KEY,
      {
        expiresIn: "2h",
      }
    );
    user.token = token;
    res.status(201).json(user);
  } catch (err) {
    console.log(err);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { dni, password } = req.body;
    if (!(dni && password)) {
      res.status(400).send("All input is required");
    }

    let dbquery = `SELECT * FROM users WHERE dni=${dni}`;
    const oldUser = await db.query(dbquery);

    if (Array.isArray(oldUser) && oldUser.length === 0) {
      return res.status(409).send("User Does not  Exist. Please Register");
    }
    const user = oldUser[0];

    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign(
        { user_id: user.dni, dni },
        process.env.TOKEN_KEY,
        {
          expiresIn: "2h",
        }
      );
      user.token = token;
      delete user.password;
      const perm = {
        orders: ["admin", "vendedor", "confeccionista", "almacenista"],
        catalog: ["admin", "vendedor"],
        clothes: ["admin", "confeccionista"],
        materials: ["admin", "almacenista"],
      }

      res.status(200).json({ ...user, ...perm });
    } else {
      res.status(400).send("Invalid Credentials");
    }

  } catch (err) {
    console.log(err);
  }

});

app.get("/", (req, res) => {
  res.send(`API us up`);
});

app.post("/materials/create", auth, async (req, res) => {
  const params = req.params;
  const body = req.body;

  const values = `(NULL, '${body.nombre}', '${body.descripcion}', '${body.color}', '${body.cantidad}', '${body.costo}','${body.unidad}')`;
  const dbquery =
    "INSERT INTO `materiales` (`id`, `nombre`, `descripcion`, `color`, `cantidad`, `costo`,`unidad`) VALUES " +
    values;

  try {
    const result = await db.query(dbquery);
    res.status(201).send();
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.get("/materials", auth, async (req, res) => {
  const dbquery = "SELECT * FROM `materiales`";
  try {
    const result = await db.query(dbquery);
    if (Array.isArray(result) && result.length >= 0) {
      res.send(result);
    } else {
      res.status(404).send({ error: "No se encuentraron materiales" });
    }
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.get("/materials/:id", auth, async (req, res) => {
  const params = req.params;
  const dbquery = "SELECT * FROM `materiales` WHERE `id` = " + params.id;
  try {
    const result = await db.query(dbquery);

    if (Array.isArray(result) && result.length > 0) {
      res.send(result);
    } else {
      res.status(404).send({ error: "No se encuentra el material" });
    }
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.put("/materials/:id", auth, async (req, res) => {
  const params = req.params;
  const body = req.body;
  const dbquery = `UPDATE materiales SET
                    nombre = '${body.nombre}',
                    descripcion = '${body.descripcion}',
                    color='${body.color}',
                    cantidad='${body.cantidad}',
                    costo = '${body.costo}',
                    unidad = '${body.unidad}',
                    disponible = '${body.disponible}'
                  WHERE
                    materiales.id = ${params.id}`;

  const result = await db.query(dbquery);
  res.send(result);
});



module.exports = app;