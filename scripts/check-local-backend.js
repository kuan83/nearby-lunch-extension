const https = require("https");

const request = https.get({
  hostname: "localhost",
  port: 3000,
  path: "/health",
  method: "GET",
  rejectUnauthorized: false,
  timeout: 3000
}, (response) => {
  let body = "";
  response.setEncoding("utf8");
  response.on("data", (chunk) => { body += chunk; });
  response.on("end", () => {
    if (response.statusCode !== 200) process.exit(1);
    try {
      const health = JSON.parse(body);
      if (!health.ok) process.exit(1);
      process.stdout.write(JSON.stringify(health));
    } catch {
      process.exit(1);
    }
  });
});

request.on("timeout", () => request.destroy());
request.on("error", () => process.exit(1));
