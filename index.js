const mailer = require("./cron-mail");
var express = require("express"),
  app = express(),
  port = process.env.PORT || 3000,
  bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.get("/", (req, res) => {
  res.send("CRON Job server for weekly Chicago concert emails.");
});

app.listen(port, () => {
  console.log(`Weekly Chicago Concerts Mailer listening on port ${port}`);
  mailer.startMailer();
});

//mailer.fetchData();
//mailer.runMailchimp();
