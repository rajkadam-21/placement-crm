

function success(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function error(res, message = 'Error', status = 400, details = null) {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

module.exports = { success, error };
