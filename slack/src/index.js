require("dotenv").config();

const { createApp } = require("./app/create-app");

const port = Number(process.env.PORT || 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`ReplayX Slack webhook listening on port ${port}`);
});
