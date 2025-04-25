const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

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

// File storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Upload form
app.post('/upload', upload.single('image'), async (req, res) => {
  const email = req.body.email;
  const image = req.file;

  if (!image) return res.status(400).send('No image uploaded.');

  const order = {
    email,
    filename: image.filename,
    paid: false
  };

  await ordersCollection.insertOne(order);
  console.log(`📧 Email: ${email}`);
  console.log(`🖼️ Image saved as: ${image.filename}`);

  res.send('Image received! We will verify payment and email you soon.');
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
        <p><strong>File:</strong> ${order.filename}</p>
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

// 🧹 Delete order and image
app.post('/delete-order', async (req, res) => {
  const { id, filename } = req.body;

  try {
    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    if (!order) return res.json({ success: false });

    // Try delete image
    const filePath = path.join(__dirname, 'uploads', filename);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn("⚠️ Couldn't delete image:", filePath);
      } else {
        console.log("🧹 Image deleted:", filePath);
      }
    });

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
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});





