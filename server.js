const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// *** CRITICAL SECURITY FIX: STRICTLY use the MONGO_URI from Render Environment Variables ***
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set. Cannot connect to the database.");
    // Force the server to stop if the critical environment variable is missing
    process.exit(1); 
}

// 1. DATABASE CONNECTION
// This uses your updated, secure connection string from the Render environment.
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => {
    console.error('MongoDB connection error. Please check your new MONGO_URI and network access:', err);
    process.exit(1); 
  });


// 2. MONGOOSE SCHEMA AND MODEL
// This schema matches the data fields used in your index.html's logic (title, owner, msgs, etc.)
const BookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    exchange: { type: Boolean, default: false },
    owner: { type: String, required: true }, 
    msgs: [{
        by: String,
        text: String,
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', BookSchema);

// 3. MIDDLEWARE SETUP
app.use(cors()); // Allows cross-origin requests
app.use(bodyParser.json()); // Parses JSON bodies

// Utility to send consistent JSON responses
const sendResponse = (res, data, message = 'Success', success = true, status = 200) => {
    res.status(status).json({ success, message, data });
};

// 4. API ROUTES (Grouped under /api, as expected by index.html: API_BASE = '/api')
const apiRouter = express.Router();

// --- AUTH/USER ROUTES (Used by index.html login/signup forms) ---
apiRouter.post('/user/login', (req, res) => {
    // Placeholder logic - replace with your actual authentication
    sendResponse(res, { name: 'Placeholder User', email: 'user@example.com' }, 'Login successful');
});

apiRouter.post('/user/signup', (req, res) => {
    // Placeholder logic - replace with your actual registration
    sendResponse(res, { name: 'Placeholder User', email: 'user@example.com' }, 'Signup successful', true, 201);
});

// --- BOOKS/LISTING ROUTES (Used by index.html fetching and creation logic) ---

// GET /api/books - Get all listings (used by loadAndRenderListings)
apiRouter.get('/books', async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        // The client-side logic expects an array response, not a wrapped JSON object
        res.json(books); 
    } catch (error) {
        sendResponse(res, null, 'Failed to fetch books', false, 500);
    }
});

// POST /api/books - Create new listing (used by listingForm submit)
apiRouter.post('/books', async (req, res) => {
    try {
        const newBook = new Book(req.body);
        await newBook.save();
        // The client-side logic expects the new book object back
        res.status(201).json(newBook);
    } catch (error) {
        sendResponse(res, null, 'Failed to create book', false, 500);
    }
});

// DELETE /api/books/:id - Delete a listing (used by handleDeleteListing)
apiRouter.delete('/books/:id', async (req, res) => {
    try {
        const deletedBook = await Book.findByIdAndDelete(req.params.id);
        if (!deletedBook) return sendResponse(res, null, 'Book not found', false, 404);
        // Returns a success message to the client
        res.json({ id: req.params.id, message: 'Book deleted successfully' });
    } catch (error) {
        sendResponse(res, null, 'Failed to delete book', false, 500);
    }
});

// POST /api/books/:id/message - Add a message (used by handleAddMessage)
apiRouter.post('/books/:id/message', async (req, res) => {
    try {
        const { by, text } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return sendResponse(res, null, 'Listing not found', false, 404);

        const newMessage = { by, text };
        book.msgs.push(newMessage);
        await book.save();
        // The client-side logic expects the *new message object* back
        res.status(201).json(book.msgs[book.msgs.length - 1]);
    } catch (error) {
        sendResponse(res, null, 'Failed to add message', false, 500);
    }
});

// Attach the API router
app.use('/api', apiRouter);

// 5. STATIC FILE SERVING
// Serve all static files (like index.html, CSS, client-side JS) from the root directory
app.use(express.static(path.join(__dirname, '/')));

// 6. CATCH-ALL ROUTE FOR SINGLE PAGE APPLICATION (SPA)
// *** This is the final fix for the "Unexpected token '<'" error! ***
app.get('*', (req, res) => {
    // If a request intended for the API fails to match any route, return a JSON error
    if (req.originalUrl.startsWith('/api/')) {
        return sendResponse(res, null, 'API Route Not Found', false, 404);
    }
    // For all other routes (like /listings, /home, etc.), send the index.html file
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 7. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
