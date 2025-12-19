const { MongoClient, ServerApiVersion } = require('mongodb');
const express=require('express');
const cors=require('cors');

require('dotenv').config();

const port=process.env.PORT || 3000;

const app=express();
app.use(cors());
app.use(express.json());


// fJCJNaGx51huwFxR



//key from FB
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//middlewire

const verifyFbToken = async(req, res, next) =>{
  const token = req.headers.authorization;

  if(!token){

    return res.status(401)
    .send({massage : 'unauthorized access'})
  }
  try{

    const idToken=token.split(' ')[1];
    const decoded=await admin.auth().verifyIdToken(idToken);
    console.log('msg',decoded)
    req.decoded_email=decoded.email;
    next();


  }
  catch{
    return res.status(401)
    .send({massage : 'unauthorized access'})

  }
}

const uri = "mongodb+srv://scicmission11:fJCJNaGx51huwFxR@cluster0.e0fb9mn.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    // create database
    const database=client.db('missionscic11');
    const usercollection=database.collection('user');
    const requestcollection=database.collection('request')


    app.post('/users',async(req,res)=>{
      const userinfo=req.body;

      
      userinfo.createdAt=new Date();
      userinfo.role='donor';

      const result=await usercollection.insertOne(userinfo);
      res.send(result)

    })


    //find all users
    app.get('/users', verifyFbToken, async(req,res) =>{
      const result=await usercollection.find().toArray();
      res.status(200).send(result);
    })
    //role base authetication

    app.get('/users/role/:email', async(req,res)=>{
      const {email}= req.params
      

      const query={email: email}

      const result=await usercollection.findOne(query)

      res.send(result)
    })

    ///updatestatus
    app.patch('/update/user/status', async(req,res)=>{

      const {email, status}=req.query;
      const query = {email :email};

      const updateStatus ={
        $set:{
          status : status
        }
      }

      const result = await usercollection.updateOne(query, updateStatus);
      res.send(result);

    })
   

    //addrequest
    app.post('/requests',verifyFbToken, async(req,res)=>{
      const requestinfo=req.body;

      
      requestinfo.createdAt=new Date();

      const result=await requestcollection.insertOne(requestinfo);
      console.log(result)
      res.send(result)

    })

    app.get('/myrequest', verifyFbToken, async(req, res)=>{
      const email = req.decoded_email;
      const query={ requesterEmail : email};
      const size =Number(req.query.size);
      const page =Number(req.query.page);

      const result= await requestcollection.find(query)
      .limit(size)
      .skip(page*size)
      .toArray();
      
    
      const totalRequest = await requestcollection.countDocuments(query);
      res.send({request : result, totalRequest});

    })

    //manage product

    app.get('/manager/products/:email', async(req,res)=>{
      const email= req.params.email;

      const query={managerEmail:email};

      const result= await productcollection.find(query).toArray();
      res.send(result)
    })
    

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('how are you?');
})

app.listen(port,()=>{
    console.log(`server is running on port ${port}`);
})