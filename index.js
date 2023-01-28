const mailer = require("./cron-mail");
const Sequelize = require("sequelize-cockroachdb");
const scrapeData = require("./createConcerts");
require("dotenv").config();
/*
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
*/

//mailer.startMailer();

// Connect to CockroachDB through Sequelize
var sequelize = new Sequelize({
  dialect: "postgres",
  username: "frank",
  password: process.env.COCKROACHDB_PASSWORD,
  host: "free-tier4.aws-us-west-2.cockroachlabs.cloud",
  port: 26257,
  database: process.env.COCKROACHDB_DATABASE,
  dialectOptions: {
    ssl: {
      //For secure connection:
      ca: fs.readFileSync("/etc/secrets/root.crt").toString(),
    },
  },
  logging: false,
});

// Define the Concert model for the "concerts" table.
const Concert = sequelize.define("concerts", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
  },
  date: {
    type: Sequelize.STRING,
  },
  dayOfWeek: {
    type: Sequelize.STRING,
  },
  venue: {
    type: Sequelize.STRING,
  },
  image: {
    type: Sequelize.STRING,
  },
  link: {
    type: Sequelize.STRING,
  },
  time: {
    type: Sequelize.STRING,
  },
  ticketPrice: {
    type: Sequelize.STRING,
  },
  genres: {
    type: Sequelize.STRING,
  },
});

var data = scrapeData().then((res) => {
  Concert.sync({
    force: true,
  })
    .then(function () {
      return Concert.bulkCreate(res, { ignoreDuplicates: true });
    })
    .then(function () {
      // Retrieve concerts.
      return Concert.findAll();
    })
    .then(function (artists) {
      // Print out the balances.
      artists.forEach(function (artist) {
        console.log(
          artist.id + " " + artist.name + " " + artist.time + " " + artist.venue
        );
      });
      process.exit(0);
    })
    .catch(function (err) {
      console.error("error: " + err.message);
      process.exit(1);
    });
});

//mailer.fetchData();
//mailer.runMailchimp();
