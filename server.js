const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
// Render usually uses process.env.PORT, but 3000 is good for local testing.
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
// Increased limit to 10mb for image uploads (Base64 strings)
app.use(bodyParser.json({ limit: '10mb' }));
// Serve the index.html file from the root directory
app.use(express.static(path.join(__dirname, '/')));

// --- Database Connection (Using your confirmed credentials) ---
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://krishnasurya2011_db_user:c4krIbJOuuphCJG9@cluster0.8q3yfgg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// -------------------------------------------------------------
// --- MongoDB Schemas ---
// -------------------------------------------------------------

// 1. User Schema (for future full authentication integration)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // This field will be used for real Google/Password authentication later
  authProviderId: { type: String, unique: true, sparse: true }, 
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// 2. Book Schema (Updated to match new UI fields: author, subject, description, owner)
const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String }, // New
  subject: { type: String }, // New
  description: { type: String }, // New
  
  type: { type: String, enum: ['Sell', 'Buy', 'Exchange'], required: true },
  price: { type: Number, default: 0 },
  condition: { type: String, enum: ['Like New', 'Good', 'Fair'], default: 'Good' },
  image: { type: String }, // Base64 string for the image
  
  // Storing owner details (matching client-side owner object)
  owner: {
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  
  // Array to store simple messages (matches client-side 'msgs' array)
  msgs: [{
    by: String,
    text: String,
    ts: { type: Date, default: Date.now }
  }],
  
  createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', BookSchema);

// -------------------------------------------------------------
// --- Routes ---
// -------------------------------------------------------------

// --- Authentication Routes (Placeholders for future backend work) ---
// These routes are not fully implemented for security reasons, but set up the API structure.
app.post('/api/auth/register', async (req, res) => {
  // In a real app, this would hash a password or initiate OAuth flow
  try {
    const { name, email } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name, email });
      await user.save();
      console.log('New user registered:', email);
    }
    // Respond with user info (without sensitive data)
    res.status(200).json({ message: 'Registration simulated.', user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'User simulation failed: ' + err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  // In a real app, this would verify credentials and issue a JWT token
  res.status(200).json({ message: 'Login simulated successfully.' });
});

// --- Book Listing Routes ---

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
    // Ensure all data matches the new BookSchema, including owner object
    const newBook = new Book(req.body);
    await newBook.save();
    console.log('New book added:', newBook.title);
    res.status(201).json(newBook);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// 3. Delete a book
app.delete('/api/books/:id', async (req, res) => {
  try {
    const result = await Book.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Add a message to a listing (simple contact method)
app.post('/api/books/:id/message', async (req, res) => {
    try {
        const { by, text } = req.body;
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $push: { msgs: { by, text } } },
            { new: true, runValidators: true }
        );
        if (!book) {
            return res.status(404).json({ message: 'Listing not found.' });
        }
        res.status(200).json(book.msgs.slice(-1)[0]); // Return the last message
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Serve the Frontend (BookApp.html)
app.get('/', (req, res) => {
  // IMPORTANT: Ensure your HTML file is named 'index.html' or 'BookApp.html'
  // and is in the root directory for this to work correctly.
  res.sendFile(path.join(__dirname, 'BookApp.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
