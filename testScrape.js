const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const Sequelize = require("sequelize-cockroachdb");
const fetch = require("node-fetch");
const querystring = require("querystring");

const url_sub = "https://www.subt.net/calendar/";
const url_golden = "https://goldendagger.com/?twpage=0";

const weekday = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

async function getSub(returnedArtists) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      args: [`--window-size=340,844`],
      defaultViewport: {
        width: 340,
        height: 844,
      },
    });
    const page = await browser.newPage();

    for (var i = 0; i <= 14; i++) {
      await page.goto("https://www.subt.net/calendar/?twpage=" + i, {
        waitUntil: "networkidle0",
      });
      await page.waitForSelector(".artisteventsname", {
        visible: true,
      });

      const results = await page.evaluate(() => {
        return {
          html: document.querySelector("*").innerHTML,
        };
      });

      const $ = cheerio.load(results.html);

      var artists = [];

      const listItems = $(".flexmedia");

      listItems.each((idx, el) => {
        console.log($(el).children().find(".artisteventsname").text().trim());
        const artist = {
          name: "",
          id: "",
          date: "",
          dayOfWeek: "",
          venue: "",
          image: "",
          link: "",
          time: "",
          genres: [],
        };
        artist.id = idx + artists.length + 9;
        artist.name = $(el).children().find(".artisteventsname").text().trim();
        artist.date = $(el).children().find(".artisteventdate").text().trim();
        var date = new Date(artist.date);
        var day = weekday[date.getDay()];
        artist.dayOfWeek = day;
        artist.image = $(el)
          .children()
          .first()
          .attr("style")
          .replace("background-image: url('", "")
          .replace(")'", "");
        artist.link = $(el).children().first().attr("href");
        artist.time = $(el)
          .children()
          .find(".artisteventshowtime")
          .text()
          .trim();
        artist.venue = "Subterranean";
        artists.push(artist);
      });
    }
    await browser.close();
    // var final_artists_list = await artists_genres(artists);

    return artists;
  } catch (err) {
    console.log(err);
  }
}

async function getGolden(returnedArtists) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      args: [`--window-size=340,844`],
      defaultViewport: {
        width: 340,
        height: 844,
      },
    });
    const page = await browser.newPage();
    var artists = [];
    for (var i = 0; i <= 5; i++) {
      await page.goto("https://goldendagger.com/?twpage=" + i, {
        waitUntil: "networkidle0",
      });
      await page.waitForSelector(".tw-section", {
        visible: true,
      });

      const results = await page.evaluate(() => {
        return {
          html: document.querySelector("*").innerHTML,
        };
      });

      const $ = cheerio.load(results.html);

      const listItems = $(".tw-section");

      listItems.each((idx, el) => {
        console.log($(el).children().find(".tw-name").text().trim());
        const artist = {
          name: "",
          id: "",
          date: "",
          dayOfWeek: "",
          venue: "",
          image: "",
          link: "",
          time: "",
          genres: [],
        };
        artist.id = idx + 20;
        artist.name = $(el).children().find(".tw-name").text().trim();
        artist.date = $(el)
          .children()
          .find(".tw-event-date-complete")
          .text()
          .trim();
        var date = new Date(artist.date);
        var day = weekday[date.getDay()];
        artist.dayOfWeek = day;
        artist.image = $(el)
          .children()
          .find(".tw-image")
          .children()
          .find("img")
          .attr("src");

        artist.link = $(el).children().find(".tw-name").find("a").attr("href");
        artist.time = $(el).children().find(".tw-event-time").text().trim();
        artist.venue = "Golden Dagger";
        artists.push(artist);
      });
    }
    await browser.close();
    // var final_artists_list = await artists_genres(artists);

    return artists;
  } catch (err) {
    console.log(err);
  }
}

var result = getGolden().then((res) => {
  console.log(res);
});
