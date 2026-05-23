const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u6o9fcg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized' });
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'Unauthorized' });
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const db = client.db('driveFleetDB');
    const carCollection = db.collection('cars');
    const bookingCollection = db.collection('bookings');
    const userCollection = db.collection('users');

    console.log('MongoDB Connected!');

    // ─── AUTH ROUTES ──────────────────────────────────────────────────────────

    // Register with email & password
    app.post('/auth/register', async (req, res) => {
      try {
        const { name, email, photo, password } = req.body;
        if (!name || !email || !password) {
          return res.status(400).send({ message: 'Name, email and password are required' });
        }
        const exists = await userCollection.findOne({ email });
        if (exists) return res.status(400).send({ message: 'Email already registered' });
        const hashed = await bcrypt.hash(password, 10);
        await userCollection.insertOne({ name, email, photo: photo || '', password: hashed, createdAt: new Date() });
        res.send({ message: 'Registered successfully' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Login with email & password
    app.post('/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await userCollection.findOne({ email });
        if (!user) return res.status(401).send({ message: 'Invalid email or password' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).send({ message: 'Invalid email or password' });
        const token = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
        res.send({
          user: { _id: user._id, name: user.name, email: user.email, photo: user.photo },
          token,
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Google login — upsert user, return JWT
    app.post('/auth/google', async (req, res) => {
      try {
        const { name, email, photo } = req.body;
        if (!email) return res.status(400).send({ message: 'Email required' });
        await userCollection.updateOne(
          { email },
          { $set: { name, email, photo: photo || '', updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        res.send({ message: 'ok' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // ─── JWT ──────────────────────────────────────────────────────────────────

    app.post('/jwt', async (req, res) => {
      const token = jwt.sign(req.body, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
      res.send({ token });
    });

    // ─── CARS ─────────────────────────────────────────────────────────────────

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
        if (!result) return res.status(404).send({ message: 'Not found' });
        res.send(result);
      } catch {
        res.status(400).send({ message: 'Invalid ID format' });
      }
    });

    app.post('/cars', verifyToken, async (req, res) => {
      res.send(await carCollection.insertOne(req.body));
    });

    app.get('/my-cars/:email', verifyToken, async (req, res) => {
      res.send(await carCollection.find({ ownerEmail: req.params.email }).toArray());
    });

    app.put('/cars/:id', verifyToken, async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      res.send(await carCollection.updateOne(filter, { $set: req.body }));
    });

    app.delete('/cars/:id', verifyToken, async (req, res) => {
      res.send(await carCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
    });

    // ─── BOOKINGS ─────────────────────────────────────────────────────────────

    app.post('/bookings', verifyToken, async (req, res) => {
      const result = await bookingCollection.insertOne(req.body);
      await carCollection.updateOne(
        { _id: new ObjectId(req.body.carId) },
        { $inc: { booking_count: 1 } }
      );
      res.send(result);
    });

    app.get('/my-bookings/:email', verifyToken, async (req, res) => {
      res.send(await bookingCollection.find({ userEmail: req.params.email }).toArray());
    });

  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => res.send('DriveFleet API Running ✓'));

app.listen(port, () => console.log(`Server running on port ${port}`));
