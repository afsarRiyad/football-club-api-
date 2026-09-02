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
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    if (res.statusCode === 200) {
      console.log("✅ Login successful!");
      console.log("Response:", data);
    } else {
      console.log("❌ Login failed!");
      console.log("Status:", res.statusCode);
      console.log("Response:", data);
    }
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on("error", (error) => {
  console.error("❌ Request failed:", error.message);
  process.exit(1);
});

req.write(postData);
req.end();