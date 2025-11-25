const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// Use a secure environment variable for your MongoDB URI in production
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookhub';

// 1. DATABASE CONNECTION
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error. Please check your MONGO_URI:', err));

// 2. MONGOOSE SCHEMA AND MODEL
// NOTE: This is a placeholder model based on your client code's data usage.
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
app.use(cors()); // Allow all cross-origin requests
app.use(bodyParser.json()); // Parse incoming JSON request bodies

// Utility to send standardized JSON responses (especially for errors)
const sendResponse = (res, data, message = 'Success', success = true, status = 200) => {
    res.status(status).json({ success, message, data });
};

// 4. API ROUTES (Grouped under /api as expected by your client-side code)
const apiRouter = express.Router();

// --- AUTH/USER ROUTES PLACEHOLDERS ---
apiRouter.post('/user/login', (req, res) => {
    // Implement your user login logic here
    // Placeholder response:
    sendResponse(res, { name: 'Placeholder User', email: 'user@example.com' }, 'Login successful');
});

apiRouter.post('/user/signup', (req, res) => {
    // Implement your user signup logic here
    // Placeholder response:
    sendResponse(res, { name: 'Placeholder User', email: 'user@example.com' }, 'Signup successful', true, 201);
});

// --- BOOKS/LISTING ROUTES ---

// GET /api/books - Get all listings
apiRouter.get('/books', async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        // Client expects an array of books for the listing view
        res.json(books); 
    } catch (error) {
        sendResponse(res, null, 'Failed to fetch books', false, 500);
    }
});

// POST /api/books - Create new listing
apiRouter.post('/books', async (req, res) => {
    try {
        const newBook = new Book(req.body);
        await newBook.save();
        // Client expects the new book object back
        res.status(201).json(newBook);
    } catch (error) {
        sendResponse(res, null, 'Failed to create book', false, 500);
    }
});

// DELETE /api/books/:id - Delete a listing
apiRouter.delete('/books/:id', async (req, res) => {
    try {
        const deletedBook = await Book.findByIdAndDelete(req.params.id);
        if (!deletedBook) return sendResponse(res, null, 'Book not found', false, 404);
        // Client expects a response upon successful deletion
        res.json({ id: req.params.id, message: 'Book deleted successfully' });
    } catch (error) {
        sendResponse(res, null, 'Failed to delete book', false, 500);
    }
});

// POST /api/books/:id/message - Add a message to a listing
apiRouter.post('/books/:id/message', async (req, res) => {
    try {
        const { by, text } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return sendResponse(res, null, 'Listing not found', false, 404);

        const newMessage = { by, text };
        book.msgs.push(newMessage);
        await book.save();
        // Client-side logic in your file expects the *new message object* back
        res.status(201).json(book.msgs[book.msgs.length - 1]);
    } catch (error) {
        sendResponse(res, null, 'Failed to add message', false, 500);
    }
});

// Attach the API router
app.use('/api', apiRouter);

// 5. STATIC FILE SERVING
// Serve static files (like index.html, CSS, etc.) from the root directory
app.use(express.static(path.join(__dirname, '/')));

// 6. CATCH-ALL ROUTE FOR SINGLE PAGE APPLICATION (SPA)
// **This is the key fix.** It ensures that any request that is not an API call
// is served the index.html file, preventing the JSON parsing error.
app.get('*', (req, res) => {
    // If the URL starts with /api/ but wasn't matched, return a 404 JSON error
    if (req.originalUrl.startsWith('/api/')) {
        return sendResponse(res, null, 'API Route Not Found', false, 404);
    }
    // Otherwise, serve the main app file
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 7. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
