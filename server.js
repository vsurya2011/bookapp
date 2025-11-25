const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
// Increase limit for image uploads (Base64 is heavy)
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/')));

// --- Database Connection (MongoDB) ---
// You must set the MONGODB_URI environment variable in Render
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookhub';

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// --- Schema ---
const BookSchema = new mongoose.Schema({
  title: String,
  type: String, // Sell, Buy, Exchange
  price: Number,
  condition: String,
  contact: String,
  image: String, // Base64 string
  createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', BookSchema);

// --- Routes ---

// 1. Get all books
app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add a book
app.post('/api/books', async (req, res) => {
  try {
    const newBook = new Book(req.body);
    await newBook.save();
    res.status(201).json(newBook);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Delete a book
app.delete('/api/books/:id', async (req, res) => {
  try {
    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
