require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = 3000;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB config
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let ordersCollection;

client.connect()
  .then(() => {
    const db = client.db('dopebois');
    ordersCollection = db.collection('orders');
    console.log("📦 Connected to MongoDB Atlas");
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'dopebois_uploads', // Optional: organize images inside a folder in your Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png']
  }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Upload form
app.post('/upload', upload.single('image'), async (req, res) => {
  const email = req.body.email;
  const file = req.file;

  if (!file) return res.status(400).send('No image uploaded.');

  const order = {
    email,
    cloudinaryUrl: file.path, // Cloudinary provides a URL at .path
    paid: false
  };

  await ordersCollection.insertOne(order);
  console.log(`📧 Email: ${email}`);
  console.log(`☁️ Uploaded to Cloudinary: ${file.path}`);

  res.send('Image uploaded to Cloudinary! We will verify payment and email you soon.');
});

// View uploads in admin
app.get('/uploads-data', async (req, res) => {
  const allOrders = await ordersCollection.find().toArray();
  res.json(allOrders);
});

// Mark as paid
app.post('/mark-paid', async (req, res) => {
  const id = req.body.id;
  console.log("📬 Received mark-paid request for ID:", id);

  try {
    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    if (!order) {
      console.log("⚠️ Order not found");
      return res.json({ success: false });
    }

    await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { paid: true } }
    );

    console.log("✅ Order marked as paid in DB");

    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await transporter.sendMail({
      from: '"Crypto Service" <noreply@crypto.com>',
      to: order.email,
      subject: 'Your Order is Paid ✅',
      html: `
        <h2>🧾 Invoice - Crypto Order Confirmation</h2>
        <p>Thank you for your payment!</p>
        <p><strong>Email:</strong> ${order.email}</p>
        <p><strong>Image Link:</strong> <a href="${order.cloudinaryUrl}" target="_blank">View Image</a></p>
        <p><strong>Status:</strong> ✅ Paid</p>
        <small>This is a test email sent via Ethereal.</small>
      `
    });

    console.log("📨 Test email sent:", nodemailer.getTestMessageUrl(info));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error in /mark-paid:", err);
    res.json({ success: false });
  }
});

// 🧹 Delete order (note: no delete image from Cloudinary yet, only DB)
app.post('/delete-order', async (req, res) => {
  const { id } = req.body;

  try {
    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    if (!order) return res.json({ success: false });

    // Delete from DB
    await ordersCollection.deleteOne({ _id: new ObjectId(id) });
    console.log("🗑️ Deleted order:", id);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.json({ success: false });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});







