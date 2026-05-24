const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

// ১. CORS কনফিগারেশন (আপনার ভার্সেল লিঙ্ক অনুযায়ী)
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://assainment09.vercel.app', // আপনার ভার্সেল লিঙ্ক
    /\.vercel\.app$/                  // সব ভার্সেল সাবডোমেইন এলাউ করবে
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// ২. মঙ্গোডিবি কানেকশন ইউআরআই (নতুন ক্লাস্টার অনুযায়ী)
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vfsreai.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // ডাটাবেস কানেক্ট করা
    await client.connect();
    const db = client.db('driveFleetDB');
    const carCollection = db.collection('cars');
    const bookingCollection = db.collection('bookings');
    const userCollection = db.collection('users');

    console.log("Successfully connected to MongoDB (Cluster: vfsreai)!");

    // ─── AUTH ROUTES ──────────────────────────────────────────────────────────

    // ইমেইল-পাসওয়ার্ড দিয়ে রেজিস্ট্রেশন
    app.post('/auth/register', async (req, res) => {
      try {
        const { name, email, photo, password } = req.body;
        
        if (!name || !email || !password) {
          return res.status(400).send({ message: 'Name, email and password are required' });
        }

        // ইমেইল অলরেডি আছে কি না চেক করা
        const exists = await userCollection.findOne({ email });
        if (exists) return res.status(400).send({ message: 'Email already registered' });

        // পাসওয়ার্ড হ্যাশ করা
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = { 
          name, 
          email, 
          photo: photo || '', 
          password: hashedPassword, 
          createdAt: new Date() 
        };

        const result = await userCollection.insertOne(newUser);
        res.status(201).send({ message: 'Registered successfully', id: result.insertedId });
      } catch (err) {
        console.error("Register Error:", err);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // ইমেইল-পাসওয়ার্ড দিয়ে লগইন
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

    // গুগল লগইন
    app.post('/auth/google', async (req, res) => {
      try {
        const { name, email, photo } = req.body;
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

    // ─── CARS ROUTES ──────────────────────────────────────────────────────────

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

    // ... অন্য সব রাউট আপনার আগের কোড অনুযায়ী এখানে থাকবে ...

  } catch (err) {
    console.error('MongoDB Error:', err);
  }
}

run().catch(console.dir);

// হেলথ চেক রাউট
app.get('/', (req, res) => res.send('DriveFleet API Running ✓'));

app.listen(port, () => console.log(`Server is running on port ${port}`));