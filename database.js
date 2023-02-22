const mysql = require("mysql2");
const util = require("util");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const dbquery = util.promisify(connection.query).bind(connection);

query = async (text) => {
  try {
    const rows = await dbquery(text);
    return JSON.parse(JSON.stringify(rows));
  } catch (e) {
    console.log(e);
    return [];
  }
};

module.exports = { query };
