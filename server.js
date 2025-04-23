const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 3000;

let orders = []; // In-memory store

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
app.post('/upload', upload.single('image'), (req, res) => {
  const email = req.body.email;
  const image = req.file;

  if (!image) return res.status(400).send('No image uploaded.');

  const order = {
    email,
    filename: image.filename,
    paid: false
  };

  orders.push(order);
  console.log(`📧 Email: ${email}`);
  console.log(`🖼️ Image saved as: ${image.filename}`);

  res.send('Image received! We will verify payment and email you soon.');
});

// View uploads in admin
app.get('/uploads-data', (req, res) => {
  res.json(orders);
});

// Mark as paid and send fake email
app.post('/mark-paid', async (req, res) => {
  const index = req.body.index;
  const order = orders[index];

  if (!order) return res.json({ success: false });

  order.paid = true;

  // Create fake test account
  const testAccount = await nodemailer.createTestAccount();

  // Set up transporter using Ethereal
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure, // true for 465, false for other ports
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });

  // Send fake email
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
  

  console.log(`📨 Email sent: ${nodemailer.getTestMessageUrl(info)}`);

  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});



