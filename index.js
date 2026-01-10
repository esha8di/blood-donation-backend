const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRATE);
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware: verify Firebase token
const verifyFbToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ massage: 'unauthorized access' });
  }

  try {
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log('msg', decoded);
    req.decoded_email = decoded.email;
    next();
  } catch {
    return res.status(401).send({ massage: 'unauthorized access' });
  }
};

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e0fb9mn.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    const database = client.db('missionscic11');

    // Collections
    const usercollection = database.collection('user');
    const requestcollection = database.collection('request');
    const paymentcollection = database.collection('payment');

    // ====================== USER ROUTES ======================
    app.post('/users', async (req, res) => {
      const userinfo = req.body;
      userinfo.createdAt = new Date();
      userinfo.role = 'donor';
      userinfo.status = 'active';
      const result = await usercollection.insertOne(userinfo);
      res.send(result);
    });

    app.get('/users', verifyFbToken, async (req, res) => {
      const result = await usercollection.find().toArray();
      res.status(200).send(result);
    });

    app.get('/users/profile/:email',async(req,res)=>{
      const email = req.params.email;
      const query={
        email:email,
      }
      console.log(email)
      const result = await usercollection.findOne(query);
      res.send(result);
    })

    app.put('/profile/update/:email', async(req,res)=>{
      const email = req.params.email;
      const query={
        email:email,
      }
      const updateData= req.body;
      const updateDocument={
        $set:{
          name:updateData.name,
          district:updateData.district,
          upazila:updateData.upazila,
          bloodgrp:updateData.bloodgrp
        }
      }

      const result= await usercollection.updateOne(query, updateDocument);
     
      res.send(result)
    })


    app.get('/users/role/:email', async (req, res) => {
      const { email } = req.params;
      const result = await usercollection.findOne({ email });
      res.send(result);
    });

    app.patch('/update/user/status', async (req, res) => {
      const { email, status } = req.query;
      const updateStatus = { $set: { status: status } };
      const result = await usercollection.updateOne({ email }, updateStatus);
      res.send(result);
    });

    // ====================== REQUEST ROUTES ======================
    app.post('/requests', verifyFbToken, async (req, res) => {
      const requestinfo = req.body;
      requestinfo.createdAt = new Date();
      requestinfo.donor_status= "pending";
      const result = await requestcollection.insertOne(requestinfo);
     
      res.send(result);
    });

    app.get('/myrequest', verifyFbToken, async (req, res) => {
      const email = req.decoded_email;
      const size = Number(req.query.size);
      const page = Number(req.query.page);
      const query = { requesterEmail: email };

      const result = await requestcollection.find(query)
        .limit(size)
        .skip(page * size)
        .toArray();

      const totalRequest = await requestcollection.countDocuments(query);
      res.send({ request: result, totalRequest });
    });

    app.get('/myrequest/:email', verifyFbToken, async (req, res) => {
      const email = req.params.email;
     
      
      const query = { requesterEmail: email };

      const result =await requestcollection.find(query).toArray()
      console.log('result', result)
        

      
      res.send(result);
    });

    app.delete('/myrequest/:id', verifyFbToken, async (req, res) => {
      const id = req.params;
      const result = await requestcollection.deleteOne({ _id: new ObjectId(id) });
      // console.log('printquery:', { _id: new ObjectId(id) });
      res.send(result);
    });

    app.get('/search_request', async (req, res) => {
      const { bloodgrp, district, upazila } = req.query;
      const query = {};
      if (bloodgrp) query.bloodGroup = bloodgrp;
      if (district) query.district = district;
      if (upazila) query.upazila = upazila;

      const result = await requestcollection.find(query).toArray();
      res.send(result);
      // console.log(result);
    });

    // ====================== PAYMENT ROUTES ======================
    app.post('/create-payment-checkout', async (req, res) => {
      const information = req.body;
      const amount = parseInt(information.donation) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: { name: 'pls donate' }
          },
          quantity: 1
        }],
        mode: 'payment',
        metadata: { donorName: information?.donorName },
        customer_email: information?.donationEmail,
        success_url: `${process.env.SITE_DOMAIN}/payment_success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment_cancelled`,
      });

      res.send({ url: session.url });
    });

    app.post('/success_payment', async (req, res) => {
      const { session_id } = req.query;
      const session = await stripe.checkout.sessions.retrieve(session_id);
      // console.log(session);

      const transactionId = session.payment_intent;

      if (session.payment_status == 'paid') {
        const paymentInfo = {
          amount: session.amount_total / 100,
          currency: session.currency,
          donorEmail: session.customer_email,
          transactionId,
          paymentStatus: session.payment_status,
          paidAt: new Date()
        };

        const result = await paymentcollection.insertOne(paymentInfo);
        return res.send(result);
      }
    });

    // MongoDB ping
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// ====================== ROOT ======================
app.get('/', (req, res) => {
  res.send('how are you?');
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
