const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

// ১. CORS কনফিগারেশন - এটি চেক করুন আপনার লিঙ্কের সাথে মিলে কি না
app.use(cors({
  origin: [
    'http://localhost:3000',          
    'https://assainment09.vercel.app', 
    /\.vercel\.app$/                  
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ybxicpc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// ডাটাবেস ভ্যারিয়েবলগুলো গ্লোবাল রাখছি যাতে সব রাউট এগুলো পায়
let userCollection, carCollection, bookingCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db('driveFleetDB');
    userCollection = db.collection('users');
    carCollection = db.collection('cars');
    bookingCollection = db.collection('bookings');
    console.log('MongoDB Connected ✓');
  } catch (err) {
    console.error('DB Connection Fail:', err);
  }
}
connectDB();

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────

// এটি চেক করার জন্য একটি টেস্ট রাউট
app.get('/test', (req, res) => res.send('Auth route is working!'));

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, photo, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).send({ message: 'Missing fields' });
    }

    if (!userCollection) {
      return res.status(500).send({ message: 'Database not ready' });
    }

    const exists = await userCollection.findOne({ email });
    if (exists) return res.status(400).send({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await userCollection.insertOne({ 
      name, email, photo, password: hashedPassword, createdAt: new Date() 
    });
    
    res.status(201).send({ message: 'Success', id: result.insertedId });
  } catch (err) {
    res.status(500).send({ message: 'Error: ' + err.message });
  }
});

// বাকি রাউটগুলো (Login, Cars) এখানে একইভাবে লিখবেন...

app.get('/', (req, res) => res.send('DriveFleet API Running ✓'));

app.listen(port, () => console.log(`Server running on port ${port}`));