const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// SECURITY: Get MONGO_URI from the environment variables set on Render
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set. The server cannot connect to the database.");
    process.exit(1); 
}

// 1. DATABASE CONNECTION
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => {
    console.error('MongoDB connection error. Check MONGO_URI and network access:', err);
    process.exit(1); 
  });

// 2. MONGOOSE SCHEMA AND MODEL (Placeholders based on your client code)
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
app.use(cors()); 
app.use(bodyParser.json()); 

const sendResponse = (res, data, message = 'Success', success = true, status = 200) => {
    res.status(status).json({ success, message, data });
};

// 4. API ROUTES (Grouped under /api)
const apiRouter = express.Router();

// --- AUTH/USER ROUTES PLACEHOLDERS ---
apiRouter.post('/user/login', (req, res) => {
    sendResponse(res, { name: 'Placeholder User', email: 'user@example.com' }, 'Login successful');
});

apiRouter.post('/user/signup', (req, res) => {
    sendResponse(res, { name: 'Placeholder User', email: 'user@example.com' }, 'Signup successful', true, 201);
});

// --- BOOKS/LISTING ROUTES ---
apiRouter.get('/books', async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books); 
    } catch (error) {
        sendResponse(res, null, 'Failed to fetch books', false, 500);
    }
});

apiRouter.post('/books', async (req, res) => {
    try {
        const newBook = new Book(req.body);
        await newBook.save();
        res.status(201).json(newBook);
    } catch (error) {
        sendResponse(res, null, 'Failed to create book', false, 500);
    }
});

apiRouter.delete('/books/:id', async (req, res) => {
    try {
        const deletedBook = await Book.findByIdAndDelete(req.params.id);
        if (!deletedBook) return sendResponse(res, null, 'Book not found', false, 404);
        res.json({ id: req.params.id, message: 'Book deleted successfully' });
    } catch (error) {
        sendResponse(res, null, 'Failed to delete book', false, 500);
    }
});

apiRouter.post('/books/:id/message', async (req, res) => {
    try {
        const { by, text } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return sendResponse(res, null, 'Listing not found', false, 404);

        const newMessage = { by, text };
        book.msgs.push(newMessage);
        await book.save();
        res.status(201).json(book.msgs[book.msgs.length - 1]);
    } catch (error) {
        sendResponse(res, null, 'Failed to add message', false, 500);
    }
});

app.use('/api', apiRouter);

// 5. STATIC FILE SERVING
app.use(express.static(path.join(__dirname, '/')));

// 6. CATCH-ALL ROUTE (MUST BE LAST)
// This is the fix for the "Unexpected token '<'" error!
app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        return sendResponse(res, null, 'API Route Not Found', false, 404);
    }
    // Send the index.html for all other non-API routes
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 7. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
