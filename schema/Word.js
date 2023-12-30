const { Schema } = require('mongoose');

const wordSchema = new Schema({
  word: [{ type: String, unique: true }],
});
module.exports = wordSchema;
