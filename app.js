require("dotenv").config();
const app = require("./server");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Isamar app listening at http://localhost:${PORT}`);
});
