const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
// Increased limit to 10mb because book images can be large
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/')));

// --- Database Connection (Updated with your credentials) ---
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://krishnasurya2011_db_user:c4krIbJOuuphCJG9@cluster0.8q3yfgg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// --- Schema ---
const BookSchema = new mongoose.Schema({
  title: String,
  type: String, // Sell, Buy, Exchange
  price: Number,
  condition: String,
  contact: String,
  image: String, // Base64 string for the image
  createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', BookSchema);

// --- Routes ---

// 1. Get all books
app.get('/api/books', async (req, res) => {
  try {
    // Sort by newest first
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
    console.log('New book added:', newBook.title);
    res.status(201).json(newBook);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Delete a book
app.delete('/api/books/:id', async (req, res) => {
  try {
    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the Frontend (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});