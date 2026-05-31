const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const cors=require("cors");
const dotenv = require('dotenv');
dotenv.config();

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_URI;

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const databaseName = "PetU"; 

const db = client.db(databaseName); 

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(`Successfully connected to MongoDB! Using database: ${databaseName}`);

    const petCollection = db.collection("pets");

    // POST
    app.post("/petData", (req, res) => {
      const petData = req.body;
      petCollection.insertOne(petData).then(
        (result) => res.status(201).send(result),
        (error) => {
          console.error("Failed to insert pet:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      );
    });

    
    app.get("/petData", (req, res) => {
      const search = req.query.search || "";
      const species = req.query.species || "All";

       const query = { adopted: false };
   

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      if (species !== "All") {
        query.species = { $in: [species.trim()] };
      }

      petCollection.find(query).toArray().then(
        (pets) => res.status(200).send(pets),
        (error) => {
          console.error("Failed to fetch pets:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      );
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!');
});


app.get('/test-db', async (req, res) => {
    try {
        
        const usersCollection = db.collection("users");
        const count = await usersCollection.countDocuments();
        res.send(`Connected to ${databaseName}. It has ${count} users.`);
    } catch (error) {
        res.status(500).send("Database error");
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});