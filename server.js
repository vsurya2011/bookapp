const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
// Use the port provided by the environment (e.g., Render) or default to 10000
const PORT = process.env.PORT || 10000; 

// --- Middleware ---
// Allow requests from any origin during development/demo
app.use(cors()); 
// Increased limit to 10mb for image uploads (Base64 strings)
app.use(bodyParser.json({ limit: '10mb' })); 

// --- Database Connection ---
// The MONGODB_URI is safely managed by Render environment variables
const mongoURI = process.env.MONGODB_URI; 

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// -------------------------------------------------------------
// --- MongoDB Schemas ---
// -------------------------------------------------------------

// Schema for simple messages attached to a listing
const MessageSchema = new mongoose.Schema({
  by: { type: String, required: true }, // Sender's name
  text: { type: String, required: true },
  ts: { type: Date, default: Date.now }
}, { _id: false }); // Do not create separate IDs for sub-documents

// Book Schema (matches the client-side data structure)
const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, default: '' },
  subject: { type: String, default: '' },
  description: { type: String, default: '' },
  
  type: { type: String, enum: ['Sell', 'Buy', 'Exchange'], required: true },
  price: { type: Number, default: 0 },
  condition: { type: String, enum: ['Like New', 'Good', 'Fair'], default: 'Good' },
  image: { type: String, default: '' }, // Base64 string for the image
  
  // Storing owner details based on the user object
  owner: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    userId: { type: String, required: true }, // Unique identifier for the owner
  },
  
  msgs: [MessageSchema], // Array of embedded messages
  
  createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', BookSchema);

// -------------------------------------------------------------
// --- Routes ---
// -------------------------------------------------------------

// NEW ROOT ROUTE ADDED: Handles the default request for the server's root URL
app.get('/', (req, res) => {
  res.send('Book Hub API is running. Use /api/books or /api/auth/login to interact with the database.');
});

// 1. --- AUTHENTICATION ROUTES (SIMULATED) ---

app.post('/api/auth/login', async (req, res) => {
  const { name, email } = req.body;
  
  // *UPDATED: Check for @gmail.com domain*
  if (!email.endsWith('@gmail.com')) {
    return res.status(401).json({ error: "Access Denied: Email must end with @gmail.com" });
  }

  // Simulate successful authentication and token issuance
  const userId = `user_${Buffer.from(email).toString('base64').slice(0, 12)}`; 
  
  // In a real app, you would verify credentials and return a JWT.
  res.status(200).json({
    message: 'Login successful. (Simulated)',
    // The user object returned to the client
    user: { 
      name, 
      email, 
      userId,
      token: 'simulated_jwt_token_for_user' // Placeholder for client to store
    }
  });
});


// 2. --- BOOK LISTING ROUTES ---

// GET /api/books: Get all books
app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books: Add a book
app.post('/api/books', async (req, res) => {
  try {
    const newBook = new Book(req.body);
    await newBook.save();
    console.log('New book added:', newBook.title);
    res.status(201).json(newBook);
  } catch (err) {
    console.error('Error adding book:', err.message);
    res.status(400).json({ error: 'Failed to create listing: ' + err.message });
  }
});

// DELETE /api/books/:id: Delete a book
app.delete('/api/books/:id', async (req, res) => {
  try {
    const result = await Book.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed: ' + err.message });
  }
});

// POST /api/books/:id/message: Add a message to a listing
app.post('/api/books/:id/message', async (req, res) => {
    try {
        const { by, text } = req.body;
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $push: { msgs: { by, text } } },
            { new: true } // Return the updated document
        );
        if (!book) {
            return res.status(404).json({ message: 'Listing not found.' });
        }
        res.status(200).json(book.msgs.slice(-1)[0]); // Return the last message
    } catch (err) {
        res.status(500).json({ error: 'Message failed: ' + err.message });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  // In a production environment like Render, you do not need the local host link, 
  // but it's useful for testing.
});
