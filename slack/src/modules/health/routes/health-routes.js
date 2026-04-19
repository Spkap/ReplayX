const express = require("express");

const { getHealth } = require("../controllers/health-controller");

function createHealthRouter() {
  const router = express.Router();

  router.get("/health", getHealth);

  return router;
}

module.exports = {
  createHealthRouter,
};
