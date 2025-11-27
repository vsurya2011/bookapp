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
    console.error('FATAL ERROR: MONGO_URI environment variable is not set.');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));


// 2. MONGOOSE SCHEMAS AND MODELS

// User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
});

UserSchema.methods.createToken = function() {
    return jwt.sign(
        { userId: this._id, name: this.name, email: this.email },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const User = mongoose.model('User', UserSchema);

// Book Schema - ADDED CONTACT FIELD
const BookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    contact: { type: String, required: true }, // New Field
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

// 3. MIDDLEWARE
app.use(cors()); 
app.use(bodyParser.json({ limit: '50mb' })); 

const sendResponse = (res, data, message = 'Success', success = true, status = 200) => {
    res.status(status).json({ success, message, data });
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return sendResponse(res, null, 'Token required.', false, 401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return sendResponse(res, null, 'Invalid token.', false, 403);
        req.user = user;
        next();
    });
};

// 4. API ROUTES
const apiRouter = express.Router();

// --- AUTH ---
apiRouter.post('/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return sendResponse(res, null, 'All fields required.', false, 400);
    if (!email.endsWith(ALLOWED_DOMAIN)) return sendResponse(res, null, `Email must end with ${ALLOWED_DOMAIN}`, false, 400);

    try {
        let user = await User.findOne({ email });
        if (user) return sendResponse(res, null, 'Account exists.', false, 409);

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ email, password: hashedPassword, name });
        await user.save();

        const token = user.createToken();
        sendResponse(res, { userId: user._id, name: user.name, email: user.email, token }, 'Account created.', true, 201);
    } catch (error) {
        sendResponse(res, null, 'Server error.', false, 500);
    }
});

apiRouter.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return sendResponse(res, null, 'Fields required.', false, 400);
    
    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return sendResponse(res, null, 'Invalid credentials.', false, 401);
        }
        const token = user.createToken();
        sendResponse(res, { userId: user._id, name: user.name, email: user.email, token }, 'Login successful.', true, 200);
    } catch (error) {
        sendResponse(res, null, 'Server error.', false, 500);
    }
});

// --- BOOKS ---

// POST Book (Updated with Contact)
apiRouter.post('/books', authenticateToken, async (req, res) => {
    const { title, author, description, price, type, condition, image, contact } = req.body;

    if (!title || !description || !type || price == null || !contact) {
        return sendResponse(res, null, 'Missing required fields (including contact).', false, 400);
    }

    try {
        const newBook = new Book({
            title, author, description, price: Number(price), type, condition, image, contact,
            owner: { userId: req.user.userId, name: req.user.name, email: req.user.email },
            exchange: type === 'Exchange' 
        });

        const savedBook = await newBook.save();
        sendResponse(res, savedBook, 'Listing published.', true, 201);
    } catch (error) {
        console.error(error);
        sendResponse(res, null, 'Failed to publish.', false, 500);
    }
});

// GET Books
apiRouter.get('/books', async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 }).select('-msgs'); 
        res.status(200).json(books); 
    } catch (error) {
        sendResponse(res, null, 'Failed to fetch.', false, 500);
    }
});

// DELETE Book
apiRouter.delete('/books/:id', authenticateToken, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return sendResponse(res, null, 'Not found.', false, 404);
        if (book.owner.userId.toString() !== req.user.userId) return sendResponse(res, null, 'Unauthorized.', false, 403);

        await Book.deleteOne({ _id: req.params.id });
        sendResponse(res, null, 'Deleted.', true, 200);
    } catch (error) {
        sendResponse(res, null, 'Failed to delete.', false, 500);
    }
});

// POST Message
apiRouter.post('/books/:id/message', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return sendResponse(res, null, 'Not found', false, 404);
        
        const newMessage = { by: req.user.name, text, timestamp: new Date() }; 
        book.msgs.push(newMessage);
        await book.save();
        
        res.status(201).json(book.msgs[book.msgs.length - 1]);
    } catch (error) {
        sendResponse(res, null, 'Failed to message', false, 500);
    }
});

app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, '/')));
app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api/')) return sendResponse(res, null, 'Not found.', false, 404);
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
