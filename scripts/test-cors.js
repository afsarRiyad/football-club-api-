const http = require("http");

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/api/health",
  method: "GET",
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

req.end();