const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 3000;
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI; // ✅ Use environment variable here!
const client = new MongoClient(uri);

let ordersCollection;

client.connect()
  .then(() => {
    const db = client.db('dopebois'); // this will create the db automatically if not exist
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

// Mark as paid and send fake email
app.post('/mark-paid', async (req, res) => {
  const id = req.body.id;

  try {
    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    if (!order) return res.json({ success: false });

    await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { paid: true } }
    );

    // Create fake test account
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
        <table border="1" cellpadding="10">
          <tr><th>Item</th><td>Image Review Service</td></tr>
          <tr><th>Email</th><td>${order.email}</td></tr>
          <tr><th>File</th><td>${order.filename}</td></tr>
          <tr><th>Status</th><td><strong>✅ Paid</strong></td></tr>
        </table>
        <br>
        <p>We'll be in touch soon with your final results.</p>
        <small>This is an automated confirmation. No reply needed.</small>
      `
    });

    console.log("📨 Email sent:", nodemailer.getTestMessageUrl(info));
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Error marking as paid:", err);
    res.json({ success: false });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});



