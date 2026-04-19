const { SlackApiError } = require("./client");

function sendError(res, error) {
  const statusCode =
    error instanceof SlackApiError ? 502 : error.statusCode || 500;

  return res.status(statusCode).json({
    error: error.message,
    details: error.details,
  });
}

module.exports = {
  sendError,
};
