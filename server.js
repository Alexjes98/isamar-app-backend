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


const getClothe = async ({ id }) => {
  let prenda;
  let materiales = [];

  let dbquery = `SELECT * FROM prendas WHERE id=${id}`;
  let result = await db.query(dbquery);

  if (Array.isArray(result) && result.length > 0) {
    prenda = result[0];
  }

  dbquery = `SELECT
                    materiales.id as materialId,
                    materiales.nombre,
                    materiales.color,
                    materiales.costo,
                    materiales.unidad,
                    materiales_prendas.cantidad
                    FROM
                    prendas
                    JOIN materiales_prendas ON prendas.id = materiales_prendas.prendas_id
                    JOIN materiales ON materiales.id = materiales_prendas.materiales_id
                    WHERE
                    prendas.id ="${id}"`;
  result = await db.query(dbquery);
  if (Array.isArray(result)) {
    materiales = result;
  }
  const resp = { prenda, materiales };
  return resp;
};

app.get("/clothes/:id", auth, async (req, res) => {
  const params = req.params;
  const id = params.id;
  const result = await getClothe({ id });
  res.send(result);
});

app.get("/clothes/", auth, async (req, res) => {
  let dbquery = `SELECT id FROM prendas`;
  let result = await db.query(dbquery);

  if (Array.isArray(result)) {
    const resp = result.map((clothe) => {
      return getClothe({ id: clothe.id });
    });

    const clothes = await Promise.all(resp);

    res.send(clothes);
  }
});

const createClothe = async ({ nombre, descripcion, talla, costo }) => {
  const values = `(NULL, '${nombre}', '${descripcion}', '${talla}', '${costo}')`;
  const dbquery =
    "INSERT INTO `prendas` (`id`, `nombre`, `descripcion`, `talla`, `costo`) VALUES " +
    values;
  try {
    const resp = await db.query(dbquery);

    return { id: resp.insertId };
  } catch (e) {
    return null;
  }
};

const updateClothe = async ({ id, nombre, descripcion, talla, costo, disponible }) => {
  const dbquery = `UPDATE prendas SET nombre = '${nombre}', descripcion = '${descripcion}', talla = '${talla}', costo = '${costo}', disponible='${disponible}' WHERE prendas.id =${id}`;
  try {
    const resp = await db.query(dbquery);
    console.log("epa: ", dbquery)
    return { id: resp.insertId };
  } catch (e) {
    return null;
  }
};

app.post("/clothes/create", auth, async (req, res) => {
  const body = req.body;
  const prenda = body.prenda;
  console.log(prenda);
  const r = await createClothe(prenda);
  if (r) {
    res.send(r);
  } else {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.put("/clothes/:id", async (req, res) => {
  const params = req.params;
  const body = req.body;
  const prendasId = params.id;
  console.log(body);
  const obj = { id: prendasId, ...body };
  const r = await updateClothe(obj);
  if (r) {
    res.send(r);
  } else {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.post("/clothes/:id/materials/add", auth, async (req, res) => {
  const params = req.params;
  const body = req.body;
  const prendasId = params.id;
  const materialId = body.materialId;
  const cantidad = body.cantidad;

  console.log("body: ", body);
  const dbquery = `INSERT INTO materiales_prendas (materiales_id, prendas_id, cantidad) VALUES ('${materialId}', '${prendasId}', ${cantidad})`;
  try {
    const resp = await db.query(dbquery);

    res.send(resp);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.put("/clothes/:id/materials/:materialId", auth, async (req, res) => {
  console.log("START");
  const params = req.params;
  const body = req.body;
  const prendasId = params.id;
  const materialId = params.materialId;
  const cantidad = body.cantidad;

  const dbquery = `UPDATE materiales_prendas SET cantidad = '${cantidad}' WHERE materiales_prendas.materiales_id = ${materialId} AND materiales_prendas.prendas_id = ${prendasId}`;
  try {
    const resp = await db.query(dbquery);

    res.send(resp);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.put("/clothes/:id/materials/:materialId/delete", auth, async (req, res) => {
  const params = req.params;
  const prendasId = params.id;
  const materialId = params.materialId;

  const dbquery = `DELETE FROM materiales_prendas WHERE materiales_prendas.materiales_id =${materialId} AND materiales_prendas.prendas_id = ${prendasId}`;
  try {
    const resp = await db.query(dbquery);

    res.send(resp);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.post("/clothes/:id/image", upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { file } = req;
    path = `img/clothesimg/`;
    console.log("file: ", file);
    const bits = file.originalname.split('.');
    const ext = bits[bits.length - 1];

    const fullPath = path + id + '.' + ext;
    console.log(fullPath);
    try {
      fs.unlink(fullPath);
    } catch (e) {
      console.log("new file");
    }

    const stream = fs.createWriteStream(fullPath, { flags: 'w+' });
    stream.once('open', function () {
      stream.write(file.buffer);
      stream.end();
    });
    res.send("ok");
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});


const getOrder = async ({ id }) => {
  let orden;

  let dbquery = `SELECT
  id,
  client_dni AS dni,
  client_nombre AS nombre,
  client_apellido AS apellido,
  client_telefono AS telefono,
  precio,
  fecha_creacion AS creacion,
  status,
  fecha_actualizacion AS actualizacion,
  costo
FROM
  orden
WHERE
  id=${id}`;
  let result = await db.query(dbquery);

  if (Array.isArray(result) && result.length > 0) {
    orden = result[0];

    dbquery = `SELECT
    prendas.id,
    prendas.nombre,
    prendas.talla,
    prendas_ordenes.cantidad,
    prendas.costo
  FROM
    prendas_ordenes
    JOIN prendas ON prendas_ordenes.prenda_id = prendas.id
    WHERE
  prendas_ordenes.orden_id =${id}`;
    result = await db.query(dbquery);
    if (Array.isArray(result)) {
      prendas = result;
    }
    const resp = { orden, prendas };
    return resp;
  } else {
    return null;
  }


};

app.get("/orders/:id", auth, async (req, res) => {
  const id = req.params.id;
  console.log(id);
  const order = await getOrder({ id });

  if (order) {
    res.send(order);
  } else {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.get("/orders", auth, async (req, res) => {
  let dbquery = `SELECT id FROM orden`;
  let result = await db.query(dbquery);

  if (Array.isArray(result)) {
    const resp = result.map((clothe) => {
      return getOrder({ id: clothe.id });
    });

    const orders = await Promise.all(resp);

    res.send(orders);

  }
});

app.post("/orders/create", auth, async (req, res) => {
  const {
    dni,
    nombre,
    apellido,
    telefono,
    precio,
    status,
    costo
  } = req.body;
  let dbquery = "INSERT INTO `orden` (`client_dni`, `client_nombre`, `client_apellido`, `client_telefono`, `precio`, `fecha_creacion`, `status`, `fecha_actualizacion`, `costo`, `id`) VALUES ";
  const values = ` ('${dni}', '${nombre}', '${apellido}', '${telefono}', '${precio}', current_timestamp(), '${status}', current_timestamp(), '${costo}', NULL)`;
  dbquery += values;
  try {
    const result = await db.query(dbquery);
    const id = result.insertId;
    res.send({ id });
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }

});

app.put("/orders/:id", auth, async (req, res) => {
  const {
    dni,
    nombre,
    apellido,
    telefono,
    precio,
    status,
    costo
  } = req.body;
  const id = req.params.id;

  const dbquery = `UPDATE orden SET client_dni = '${dni}', client_nombre = '${nombre}', client_apellido = '${apellido}', client_telefono = '${telefono}', precio = '${precio}', status = '${status}', costo = '${costo}',fecha_actualizacion = current_timestamp() WHERE orden.id = ${id}`;
  try {
    const result = await db.query(dbquery);
    res.send(result);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});


app.post("/orders/:id/clothes/add", auth, async (req, res) => {
  const orderId = req.params.id;
  const { id, cantidad } = req.body;


  const dbquery = `INSERT INTO prendas_ordenes (prenda_id, orden_id, cantidad) VALUES ('${id}', '${orderId}', ${cantidad})`;
  try {
    const resp = await db.query(dbquery);

    res.send(resp);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.put("/orders/:orderid/clothes/:clotheid", auth, async (req, res) => {
  const { orderid, clotheid } = req.params;
  const { cantidad } = req.body;


  const dbquery = `UPDATE prendas_ordenes SET cantidad=${cantidad} WHERE prenda_id=${clotheid} AND orden_id=${orderid}`;
  try {
    const resp = await db.query(dbquery);

    res.send(resp);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});
app.post("/orders/:orderid/delete", auth, async (req, res) => {
  const { orderid, clotheid } = req.params;
  let dbquery = `DELETE FROM prendas_ordenes WHERE orden_id=${orderid}`;
  try {
    const resp = await db.query(dbquery);
    dbquery = `DELETE FROM orden WHERE id=${orderid}`;
    await db.query(dbquery);
    res.send(resp);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

app.post("/orders/:orderid/clothes/:clotheid/delete", auth, async (req, res) => {
  const { orderid, clotheid } = req.params;
  const dbquery = `DELETE FROM prendas_ordenes WHERE prenda_id=${clotheid} AND orden_id=${orderid}`;
  try {
    const resp = await db.query(dbquery);

    res.send(resp);
  } catch (e) {
    res.status(500).send({ error: "Internal Error" });
  }
});

module.exports = app;