const { query } = require('../../config/db');

// List categories
exports.listCategories = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT * FROM product_categories 
      WHERE is_active = true 
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Create a category
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const result = await query(
      `INSERT INTO product_categories (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
