const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); // Required for secure password hashing
const jwt = require('jsonwebtoken'); // Required for user session management

const app = express();
const PORT = process.env.PORT || 3000;

// *** CRITICAL SECURITY: Use Environment Variables ***
const MONGO_URI = process.env.MONGO_URI; 
// You MUST set this new secret key environment variable on Render!
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key_if_not_set'; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set. Cannot connect to the database.");
    process.exit(1); 
}

// 1. DATABASE CONNECTION
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => {
    console.error('MongoDB connection error. Please check MONGO_URI and network access:', err);
    process.exit(1); 
  });

// 2. MONGOOSE SCHEMAS AND MODELS

// NEW: User Schema for Authentication
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Existing Book Schema
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

// --- AUTH/USER ROUTES (FULL IMPLEMENTATION) ---

// POST /api/auth/signup - Actual Registration Logic
apiRouter.post('/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
        return sendResponse(res, null, 'Please provide name, email, and password.', false, 400);
    }
    
    try {
        // 1. Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return sendResponse(res, null, 'User with this email already exists.', false, 409);
        }

        // 2. Hash the password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Create and save the new user
        const newUser = new User({
            email,
            password: hashedPassword,
            name
        });
        await newUser.save();
        
        // 4. Issue a token (JWT)
        const token = jwt.sign({ userId: newUser._id, name: newUser.name, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

        const userData = {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            token: token // The client MUST store this token
        };

        sendResponse(res, userData, 'Signup successful. User created.', true, 201);
    } catch (error) {
        console.error('Signup Error:', error);
        // MongoDB error (e.g., validation failure)
        sendResponse(res, null, 'Server error during registration.', false, 500); 
    }
});

// POST /api/auth/login - Actual Login Logic
apiRouter.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendResponse(res, null, 'Please provide email and password.', false, 400);
    }

    try {
        // 1. Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return sendResponse(res, null, 'Invalid credentials.', false, 401);
        }

        // 2. Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return sendResponse(res, null, 'Invalid credentials.', false, 401);
        }

        // 3. Issue a token (JWT)
        const token = jwt.sign({ userId: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            token: token // The client MUST store this token
        };
        
        sendResponse(res, userData, 'Login successful.', true, 200);
    } catch (error) {
        console.error('Login Error:', error);
        sendResponse(res, null, 'Server error during login.', false, 500);
    }
});


// --- BOOKS/LISTING ROUTES (No changes, they work with the new user model) ---
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

// 6. CATCH-ALL ROUTE FOR SINGLE PAGE APPLICATION (SPA)
app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        return sendResponse(res, null, 'API Route Not Found', false, 404);
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 7. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
