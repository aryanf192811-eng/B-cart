const { Router } = require('express');
const { query } = require('../../config/db');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const dbResult = await query('SELECT NOW() AS server_time');
    res.json({
      status: 'ok',
      db: dbResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
