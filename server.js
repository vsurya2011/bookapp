const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookhub';
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key_if_not_set'; 

// --- Configuration ---
const ALLOWED_DOMAIN = '@gmail.com';

// 1. DATABASE CONNECTION
if (!MONGO_URI) {
    console.error('FATAL ERROR: MONGO_URI environment variable is not set. Cannot connect to the database.');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error. Please check your MONGO_URI and network access:', err));


// 2. MONGOOSE SCHEMAS AND MODELS

// User Schema & Model
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
});

// Utility method to generate JWT
UserSchema.methods.createToken = function() {
    return jwt.sign(
        { userId: this._id, name: this.name, email: this.email },
        JWT_SECRET,
        { expiresIn: '7d' } // Token expires in 7 days
    );
};

const User = mongoose.model('User', UserSchema);

// Book Schema & Model
const BookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    exchange: { type: Boolean, default: false },
    type: { type: String, required: true },
    condition: { type: String, default: 'Good' },
    image: { type: String },
    owner: { 
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        email: { type: String, required: true }
    }, 
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
app.use(bodyParser.json({ limit: '50mb' })); 

// Utility to send standardized JSON responses
const sendResponse = (res, data, message = 'Success', success = true, status = 200) => {
    res.status(status).json({ success, message, data });
};

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    // Get token from the Authorization header (Bearer <token>)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return sendResponse(res, null, 'Authentication token required.', false, 401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return sendResponse(res, null, 'Invalid or expired token.', false, 403);
        }
        req.user = user; // Attach user payload (userId, name, email) to the request
        next();
    });
};

// 4. API ROUTES
const apiRouter = express.Router();

// ----------------------------------------------------
// --- AUTH/USER ROUTES ---
// ----------------------------------------------------

// POST /api/auth/signup - User registration
apiRouter.post('/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
        return sendResponse(res, null, 'Please provide name, email, and password.', false, 400);
    }
    
    // Email domain validation
    if (!email.endsWith(ALLOWED_DOMAIN)) {
        return sendResponse(res, null, `Only emails ending with ${ALLOWED_DOMAIN} are allowed.`, false, 400);
    }

    try {
        // 1. Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return sendResponse(res, null, 'Account already exists. Please log in.', false, 409);
        }

        // 2. Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Create new user
        user = new User({ email, password: hashedPassword, name });
        await user.save();

        // 4. Create and return JWT
        const token = user.createToken();
        const userData = { userId: user._id, name: user.name, email: user.email, token };

        sendResponse(res, userData, 'Account created and logged in.', true, 201);
    } catch (error) {
        console.error('Signup Error:', error);
        sendResponse(res, null, 'Signup failed due to a server error.', false, 500);
    }
});

// POST /api/auth/login - User login
apiRouter.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendResponse(res, null, 'Please provide email and password.', false, 400);
    }
    
    try {
        // 1. Find user
        const user = await User.findOne({ email });
        if (!user) {
            return sendResponse(res, null, 'Invalid credentials.', false, 401);
        }

        // 2. Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return sendResponse(res, null, 'Invalid credentials.', false, 401);
        }

        // 3. Create and return JWT
        const token = user.createToken();
        const userData = { userId: user._id, name: user.name, email: user.email, token };

        sendResponse(res, userData, 'Login successful.', true, 200);
    } catch (error) {
        console.error('Login Error:', error);
        sendResponse(res, null, 'Login failed due to a server error.', false, 500);
    }
});


// ----------------------------------------------------
// --- BOOKS/LISTING ROUTES ---
// ----------------------------------------------------

// POST /api/books - Add a new listing (PROTECTED)
apiRouter.post('/books', authenticateToken, async (req, res) => {
    // req.user is set by authenticateToken middleware
    const { title, author, description, price, type, condition, image } = req.body;

    // Minimal validation
    if (!title || !description || !type || price == null) {
        return sendResponse(res, null, 'Missing required fields: title, description, type, price.', false, 400);
    }

    try {
        const newBook = new Book({
            title,
            author,
            description,
            price: Number(price),
            type,
            condition,
            image,
            // Owner details are pulled securely from the authenticated token payload
            owner: {
                userId: req.user.userId,
                name: req.user.name,
                email: req.user.email
            },
            exchange: type === 'Exchange' 
        });

        const savedBook = await newBook.save();
        sendResponse(res, savedBook, 'Listing published successfully.', true, 201);
    } catch (error) {
        console.error('Add Listing Error:', error);
        sendResponse(res, null, 'Failed to publish listing.', false, 500);
    }
});

// GET /api/books - Get all listings (PUBLIC - viewable by everyone)
apiRouter.get('/books', async (req, res) => {
    try {
        // Find all books and return them, sorted by newest first. Exclude 'msgs' for the main list.
        const books = await Book.find().sort({ createdAt: -1 }).select('-msgs'); 
        // Client expects an array of books, so we send the array directly
        res.status(200).json(books); 
    } catch (error) {
        console.error('Get Books Error:', error);
        sendResponse(res, null, 'Failed to fetch listings.', false, 500);
    }
});


// DELETE /api/books/:id - Delete a listing (PROTECTED - only by owner)
apiRouter.delete('/books/:id', authenticateToken, async (req, res) => {
    try {
        const bookId = req.params.id;
        
        const book = await Book.findById(bookId);
        if (!book) {
            return sendResponse(res, null, 'Listing not found.', false, 404);
        }

        if (book.owner.userId.toString() !== req.user.userId) {
            return sendResponse(res, null, 'Unauthorized. Only the owner can delete this listing.', false, 403);
        }

        await Book.deleteOne({ _id: bookId });
        sendResponse(res, null, 'Listing deleted successfully.', true, 200);
    } catch (error) {
        console.error('Delete Listing Error:', error);
        sendResponse(res, null, 'Failed to delete listing.', false, 500);
    }
});

// POST /api/books/:id/message - Add a message to a listing (PROTECTED)
apiRouter.post('/books/:id/message', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        const by = req.user.name; 
        const book = await Book.findById(req.params.id);
        
        if (!book) return sendResponse(res, null, 'Listing not found', false, 404);
        if (!text) return sendResponse(res, null, 'Message text is required', false, 400);

        const newMessage = { by, text, timestamp: new Date() }; 
        book.msgs.push(newMessage);
        await book.save();
        
        res.status(201).json(book.msgs[book.msgs.length - 1]);
    } catch (error) {
        console.error('Add Message Error:', error);
        sendResponse(res, null, 'Failed to add message', false, 500);
    }
});

// Attach the API router
app.use('/api', apiRouter);

// 5. STATIC FILE SERVING
app.use(express.static(path.join(__dirname, '/')));

// 6. CATCH-ALL ROUTE FOR SINGLE PAGE APPLICATION (SPA)
app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        return sendResponse(res, null, 'API Endpoint not found.', false, 404);
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 7. START SERVER
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
