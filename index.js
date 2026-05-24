const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

// ১. CORS কনফিগারেশন
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://assainment09.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json());

// ২. মঙ্গোডিবি কানেকশন
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vfsreai.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

// ৩. টোকেন ভেরিফাই করার মিডলওয়্যার (Security)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized access' });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: 'Forbidden access' });
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const db = client.db('driveFleetDB');
    const carCollection = db.collection('cars');
    const userCollection = db.collection('users');

    console.log("Connected to MongoDB!");

    // ─── এপিআই রাউটস ──────────────────────────────────────────────

    // ৪. গাড়ি অ্যাড করার রাউট (এটিই আপনার মিসিং ছিল)
    app.post('/cars', verifyToken, async (req, res) => {
      try {
        const carData = req.body;
        // ডাটাবেসে সেভ করা
        const result = await carCollection.insertOne(carData);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to add car' });
      }
    });

    // ৫. সব গাড়ির লিস্ট পাওয়ার রাউট
    app.get('/cars', async (req, res) => {
      const { search, filter } = req.query;
      let query = {};
      if (search) query.name = { $regex: search, $options: 'i' };
      if (filter && filter !== 'All') query.type = filter;
      const result = await carCollection.find(query).toArray();
      res.send(result);
    });

    // ৬. রেজিস্ট্রেশন রাউট (আগে যা ছিল)
    app.post('/auth/register', async (req, res) => {
      const user = req.body;
      const exists = await userCollection.findOne({ email: user.email });
      if (exists) return res.status(400).send({ message: 'Already exists' });
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // ৭. লগইন করার সময় টোকেন তৈরি করা (JWT)
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
      res.send({ token });
    });

  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => res.send('DriveFleet API Running ✓'));
app.listen(port, () => console.log(`Server running on port ${port}`));