import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

let clientPromise;

if (!uri) {
  // Defer error until connection is actually used (avoids breaking build when env is missing)
  clientPromise = Promise.reject(
    new Error("Please add MONGODB_URI to your .env or .env.local file")
  );
} else if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
