const IPFS = require("ipfs-http-client");

async function upload() {
  // Connect to IPFS API
  const ipfs = new IPFS({
    host: "ipfs.infura.io",
    port: "5001",
    protocol: "https",
  });

  // Upload a file to IPFS
  const data = { foo: "bar", baz: [1, 2, 3] }; // your JSON object

  const jsonData = JSON.stringify(data); // convert the object to a JSON string

  const file = new Blob([jsonData], { type: "application/json" }); // create a new Blob object with the JSON string

  const filesAdded = await ipfs.add(file); // upload the file to IPFS

  console.log(filesAdded.cid.toString()); // print the hash of the uploaded file

}

upload();
// Print the hash of the uploaded file
