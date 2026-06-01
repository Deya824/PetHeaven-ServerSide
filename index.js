const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const cors = require("cors");
const dotenv = require('dotenv');
dotenv.config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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

    // POST: Add new pet
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

    // GET: All pets with search/filter
    app.get("/petData", (req, res) => {
      const search = req.query.search || "";
      const species = req.query.species || "All";
      const query = { adopted: false };

      if (search) query.name = { $regex: search, $options: "i" };
      if (species !== "All") query.species = { $in: [species.trim()] };

      petCollection.find(query).toArray().then(
        (pets) => res.status(200).send(pets),
        (error) => {
          console.error("Failed to fetch pets:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      );
    });

    // GET: Single pet by ID
    app.get("/petData/:id", async (req, res) => {
      const id = req.params.id;
      const result = await petCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });
    app.patch("/petData/:id",async(req,res)=>{
        const id=req.params.id;
        const updateData=req.body;
        const result=await petCollection.updateOne({_id:new ObjectId(id)},
            {$set:updateData}
        )
        res.json(result);
    })

    // POST: Submit adoption request
    app.post("/adopt-request", async (req, res) => {
      const petData = req.body;
      const result = await db.collection("adopt-requests").insertOne(petData);
      res.status(201).send(result);
    });

    // GET: My adoption requests (by user email)
    app.get("/my-requests", async (req, res) => {
      const userEmail = req.query.email;
      const requests = await db.collection("adopt-requests")
        .find({ userEmail: userEmail })
        .toArray();
      res.send(requests);
    });

    // DELETE: Cancel adoption request
    app.delete("/adopt-request/:id", async (req, res) => {
      const { id } = req.params;
      const result = await db.collection("adopt-requests").deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // PATCH: Update adoption request status (approve/reject + optional officialPickupDate)
   // PATCH: Update adoption request status (approve/reject + optional officialPickupDate)
app.patch("/adopt-request/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, officialPickupDate } = req.body;

        const updateFields = { status };
        if (officialPickupDate) updateFields.officialPickupDate = officialPickupDate;

        // Update the request status
        const result = await db.collection("adopt-requests").updateOne(
            { _id: new ObjectId(id) },
            { $set: updateFields }
        );

        // If approved, mark the pet as adopted
        if (status === 'approved') {
            const request = await db.collection("adopt-requests").findOne({ _id: new ObjectId(id) });
            if (request?.petId) {
                await db.collection("pets").updateOne(
                    { _id: new ObjectId(request.petId) },
                    { $set: { adopted: true } }
                );
            }
        }

        // If rejected, mark the pet as available again
        // if (status === 'rejected') {
        //     const request = await db.collection("adopt-requests").findOne({ _id: new ObjectId(id) });
        //     if (request?.petId) {
        //         await db.collection("pets").updateOne(
        //             { _id: new ObjectId(request.petId) },
        //             { $set: { adopted: false } }
        //         );
        //     }
        // }

        res.send({ success: true, result });
    } catch (error) {
        res.status(500).send({ message: "Failed to update request status" });
    }
});

    // GET: My pet listings (by owner email)
    app.get("/my-listings", async (req, res) => {
      const { email } = req.query;
      const pets = await db.collection("pets").find({ ownerEmail: email }).toArray();
      res.send(pets);
    });

    // GET: Adoption requests for a specific pet
    app.get("/pet-requests/:petId", async (req, res) => {
      const { petId } = req.params;
      const requests = await db.collection("adopt-requests")
        .find({ petId: petId })
        .toArray();
      res.send(requests);
    });
// ADD THIS TO index.js
app.get("/my-pets-requests", async (req, res) => {
    try {
        const ownerEmail = req.query.email;
        // 1. Find all pets owned by this user
        const myPets = await db.collection("pets").find({ ownerEmail }).toArray();
        const myPetIds = myPets.map(p => p._id.toString());
        
        // 2. Find all requests for these pets
        const requests = await db.collection("adopt-requests")
            .find({ petId: { $in: myPetIds } })
            .toArray();
            
        res.send(requests);
    } catch (error) {
        res.status(500).send({ message: "Error fetching owner's pet requests" });
    }
});
    // DELETE: Remove a pet listing
    app.delete("/pets/:id", async (req, res) => {
      try {
        const { id } = req.params;
        await db.collection("pets").deleteOne({ _id: new ObjectId(id) });
        res.send({ success: true });
      } catch (error) {
        res.status(500).send({ message: "Failed to delete listing" });
      }
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