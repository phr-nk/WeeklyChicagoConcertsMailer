const cron = require("node-cron");
const nodemailer = require("nodemailer");
const axios = require("axios");
const lastDayOfWeek = require("date-fns/lastDayOfWeek");
const mailchimp = require("@mailchimp/mailchimp_marketing");
const sparkPostTransport = require("nodemailer-sparkpost-transport");
require("dotenv").config();

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: "us20",
});
const url = "https://chicagoconcertapi.onrender.com/concerts";

async function runMailchimp() {
  const response = await mailchimp.lists.getListMembersInfo("c3082bee34");

  var members = [];
  response.members.map((item, index) => {
    if (item.status == "subscribed") {
      members.push(item.email_address);
    }
  });

  return members;
}

function convertDate(date) {
  var date_parsed = Date.parse(date);

  var date_formated = new Date(date_parsed);

  return date_formated;
}

function getFirstDayOfWeek(d) {
  // 👇️ clone date object, so we don't mutate it
  const date = new Date(d);
  const day = date.getDay(); // 👉️ get day of week

  // 👇️ day of month - day of week (-6 if Sunday), otherwise +1
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);

  return new Date(date.setDate(diff));
}

async function fetchData() {
  try {
    const res = await axios(url);
    const json = await res.data;

    //console.log(json);
    return json;
  } catch (err) {
    console.log("Error: " + err);
  }
}

// Create mail transporter.
let options = {
  sparkPostApiKey: process.env.SPARKPOST_API_KEY,
};
let transporter = nodemailer.createTransport(sparkPostTransport(options));

function startMailer() {
  // At 00:00 on Sunday.. 0 12 * * 1
  //cron.schedule("0 12 * * 1", function () {
  console.log("---------------------");
  console.log("Running Cron Job");

  fetchData()
    .then((res) => {
      var sortedObject = res.sort(function (a, b) {
        var dateA = new Date(a.date),
          dateB = new Date(b.date);
        return dateA - dateB;
      });

      const todaysDate = new Date();

      const thisWeeksConcerts = [];

      sortedObject.map((item, index) => {
        if (
          convertDate(item.date) <=
            lastDayOfWeek(convertDate(todaysDate), { weekStartsOn: 1 }) &&
          convertDate(item.date) >= getFirstDayOfWeek(convertDate(todaysDate))
        ) {
          thisWeeksConcerts.push(item);
        }
      });

      return thisWeeksConcerts;
    })
    .then((res) => {
      var mailOptions = {
        from: "weeklychicagoconcerts@weeklychicagoconcerts.xyz",
        to: [],
        subject: "Concerts Coming Up in Chicago This Week",
        text: "",
        html:
          "<div style=' background-image: url('https://raw.githubusercontent.com/phr-nk/WeeklyChicagoConcerts/main/src/assets/layered-yellow-wavesV2.png'); background-color:#f5d06a;font-family:Helvetica;'><h1 style='text-align: center; margin-top:1rem; color: black; font: Roboto, Helvetica, Arial, sans-serif;'><img style='width:150px;margin-top:0.5rem' src= 'https://raw.githubusercontent.com/phr-nk/WeeklyChicagoConcerts/main/src/assets/wcc_logo.png'> <br> Upcoming Concerts</h1><br><h4 style='text-align: center; font: Roboto, Helvetica, Arial, sans-serif;'>Made by <a href='https://www.frank-lenoci.me/#/'>Frank Lenoci</a></h4>",
      };

      res.map((item, index) => {
        mailOptions.text +=
          item.name + " " + item.date + " " + item.venue + " \n ";

        var date = convertDate(item.date);
        mailOptions.html +=
          "<div style='display:flex; flex-direction: column; margin-bottom:3rem'> <img style='width:300px; margin-left:auto; margin-right:auto; margin-top:2rem;' src='" +
          item.image +
          "'/>" +
          "<span style='margin-top: 0.5rem; margin-left:3%; text-align:center;font-size:large; position:relative; top:-75px;'> <strong><a href='" +
          item.link +
          "'>" +
          item.name +
          "</a></strong>: " +
          item.time +
          " ";
        date.toLocaleDateString() +
          " <b>at " +
          item.venue +
          "</b> </span><p style='text-align:center;'>" +
          item.genres !=
        ""
          ? "<strong>Genres:</strong> " + item.genres
          : "" + "</p> <br></br> </div>";
      });
      mailOptions.html +=
        "<p style='margin-left:10%; margin-bottom:10%; font: Roboto, Helvetica, Arial, sans-serif;'> Want to stop receiving emails? You can <a href='https://weeklychicagoconcerts.us20.list-manage.com/unsubscribe?u=5a79c1bc237a353a275629a12&id=c3082bee34'>unsubscribe</a> here.</p>";
      mailOptions.html += "</div>";

      runMailchimp().then((res) => {
        for (var i in res) {
          mailOptions.to = res[i];
          console.log("Sending to: " + res[i]);
          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              throw error;
            } else {
              console.log("Email successfully sent!");
            }
          });
        }
      });
    });
  //  });
}

module.exports = { startMailer, fetchData, runMailchimp };
