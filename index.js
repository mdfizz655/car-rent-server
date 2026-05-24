const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

// CORS কনফিগারেশন
app.use(cors({
  origin: [
    'http://localhost:3000',          
    'https://assainment09.vercel.app', // আপনার ভার্সেল ডোমেইন
    /\.vercel\.app$/                  // সব ভার্সেল সাবডোমেইন এলাউ করবে
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ybxicpc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    // ডাটাবেস কানেকশন
    await client.connect();
    const db = client.db('driveFleetDB');
    const carCollection = db.collection('cars');
    const bookingCollection = db.collection('bookings');
    const userCollection = db.collection('users');

    console.log('MongoDB Connected successfully!');

    // ─── AUTH ROUTES ──────────────────────────────────────────────────────────

    // ১. ইমেইল-পাসওয়ার্ড দিয়ে রেজিস্ট্রেশন
    app.post('/auth/register', async (req, res) => {
      try {
        const { name, email, photo, password } = req.body;
        
        if (!name || !email || !password) {
          return res.status(400).send({ message: 'Name, email and password are required' });
        }

        const exists = await userCollection.findOne({ email });
        if (exists) return res.status(400).send({ message: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = { 
          name, 
          email, 
          photo: photo || '', 
          password: hashedPassword, 
          createdAt: new Date() 
        };

        const result = await userCollection.insertOne(newUser);
        res.status(201).send({ message: 'Registered successfully', insertedId: result.insertedId });
      } catch (err) {
        console.error("Register Error:", err);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // ২. ইমেইল-পাসওয়ার্ড দিয়ে লগইন
    app.post('/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await userCollection.findOne({ email });
        
        if (!user || !user.password) {
          return res.status(401).send({ message: 'Invalid email or password' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).send({ message: 'Invalid email or password' });

        const token = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
        
        res.send({
          user: { _id: user._id, name: user.name, email: user.email, photo: user.photo },
          token,
        });
      } catch (err) {
        res.status(500).send({ message: 'Server error' });
      }
    });

    // ৩. গুগল লগইন (User Upsert)
    app.post('/auth/google', async (req, res) => {
      try {
        const { name, email, photo } = req.body;
        if (!email) return res.status(400).send({ message: 'Email required' });
        
        await userCollection.updateOne(
          { email },
          { 
            $set: { name, email, photo: photo || '', updatedAt: new Date() }, 
            $setOnInsert: { createdAt: new Date() } 
          },
          { upsert: true }
        );
        res.send({ message: 'Google Auth Successful' });
      } catch (err) {
        res.status(500).send({ message: 'Server error' });
      }
    });

    // ─── CARS & BOOKINGS (সংক্ষিপ্ত রাখা হলো আপনার আগের কোড অনুযায়ী) ───────────
    app.get('/cars', async (req, res) => {
      const { search, filter } = req.query;
      let query = {};
      if (search) query.name = { $regex: search, $options: 'i' };
      if (filter && filter !== 'All') query.type = filter;
      res.send(await carCollection.find(query).toArray());
    });

    app.get('/cars/:id', async (req, res) => {
      try {
        const result = await carCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
      } catch { res.status(400).send({ message: 'Invalid ID' }); }
    });

    // ... বাকি সব এপিআই রাউট এখানে যোগ করতে পারেন ...

  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => res.send('DriveFleet API Running ✓'));
app.listen(port, () => console.log(`Server running on port ${port}`));