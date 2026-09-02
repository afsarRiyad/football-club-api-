const http = require("http");

const postData = JSON.stringify({
  email: "admin@fclub.com",
  password: "password123",
});

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/api/auth/login",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
    "Origin": "http://localhost:3001",
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Headers:", JSON.stringify(res.headers, null, 2));
    console.log("Response:", data);
  });
});

req.on("error", (error) => {
  console.error("Error:", error.message);
});

req.write(postData);
req.end();