import mongoose from 'mongoose';
const { Schema } = mongoose;

const wordSchema = new Schema({
  word: [{ type: String, unique: true }],
});
export default wordSchema;
