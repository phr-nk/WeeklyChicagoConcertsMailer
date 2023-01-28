const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const Sequelize = require("sequelize-cockroachdb");
const fetch = require("node-fetch");
const querystring = require("querystring");

// URL of the page we want to scrape
const url_shubas = "https://lh-st.com/";
const url_empty_bottle = "https://www.emptybottle.com/";
const url_hideout = "https://hideoutchicago.com/events";
const url_metro = "https://metrochicago.com/events";
const url_sv = "https://sleeping-village.com/events/";
const url_th = "https://www.thaliahallchicago.com/shows";
const url_sub = "https://www.subt.net/calendar/";
// For secure connection to CockroachDB
const fs = require("fs");
const { get } = require("prompt");
require("dotenv").config();

const weekday = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;
const spotify_search = "https://api.spotify.com/v1/search?q=";

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;

var basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

const getAccessToken = async () => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: querystring.stringify({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  return response.json();
};

const getArtistGenres = async (artist) => {
  const { access_token } = await getAccessToken();

  var search_q = spotify_search + artist + "&type=artist";

  return fetch(search_q, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
};

async function artists_genres(artists) {
  var artist_genres = artists;
  for (var i = 0; i < artist_genres.length; i++) {
    await getArtistGenres(artist_genres[i].name)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        try {
          console.log(artist_genres[i].name + " " + artist_genres[i].venue);
          console.log(data.artists.items[0].genres.toString());

          artist_genres[i].genres = data.artists.items[0].genres.toString();
        } catch (err) {
          artist_genres[i].genres = "";
          console.log(err);
        }
      });
  }
  return artist_genres;
}

async function getSBLH() {
  try {
    // Fetch HTML of the page we want to scrape
    const res = await axios.get(url_shubas);
    // Load HTML we fetched in the previous line
    const $ = cheerio.load(res.data);
    var artists = [];
    const listItems = $(".card");

    listItems.each((idx, el) => {
      const artist = {
        name: "",
        id: "",
        date: "",
        dayOfWeek: "",
        venue: "",
        image: "",
        link: "",
        time: "",
        ticketPrice: "",
        genres: [],
      };
      artist.id = idx;
      artist.name = $(el).children().find("h4").text();
      try {
        var date_string = $(el).children().find("span").html().split("<br>")[0];

        if (date_string.includes("Nov") || date_string.includes("Dec")) {
          date_string += ", 2022";
        } else {
          date_string += ", 2023";
        }
        var date_object = new Date(date_string);
        artist.date = date_string;
        artist.dayOfWeek = weekday[date_object.getDay()];
      } catch (err) {
        console.log(err);
      }
      artist.time = $(el)
        .children()
        .find(".tessera-showTime")
        .children()
        .last()
        .text()
        .trim();
      artist.venue = $(el).children().children("span").first().text();
      artist.image = $(el).children().find("img").attr("src");
      artist.link = $(el).children().find("a").attr("href");
      artist.name !== ""
        ? artists.push(artist)
        : console.log("No info in object");
    });
    /*
    await goToNestedSBLH(artists).then((res) => {
      artists = res;
    });
    */
    var final_artists_list = await artists_genres(artists);

    return final_artists_list;
  } catch (err) {
    console.error(err);
  }
}
async function getTH(returnedArtists) {
  try {
    const browser = await puppeteer.launch();

    const page = await browser.newPage();

    await page.goto(url_th, { waitUntil: "networkidle0" });

    //await page.screenshot({path : "image.png"})

    const html = await page.evaluate(() => {
      return {
        html: document.querySelector("*").outerHTML,
      };
    });
    const $ = cheerio.load(html.html);

    const listItems = $(".eb-item");

    var artists = [];

    var returnedList = returnedArtists;

    listItems.each((idx, el) => {
      const artist = {
        name: "",
        id: "",
        date: "",
        dayOfWeek: "",
        venue: "",
        image: "",
        link: "",
        time: "",
        ticketPrice: "",
        genres: [],
      };

      artist.link = "https://www.thaliahallchicago.com/shows";
      artist.venue = "Thalia Hall";
      artist.time = $(el).children().find(".start-time").text().trim();
      artist.id = idx + returnedList.length + 1000;
      artist.name = $(el).children().find(".title").text().trim();
      var date_string = $(el).children().find(".date").text().trim();

      date_string += ", 2023";
      artist.image = $(el)
        .children()
        .find(".item-image-inner")
        .attr("style")
        .replace("background-image:url(", "")
        .replace(");", "");
      var date_object = new Date(date_string);
      artist.date = date_string;
      artist.dayOfWeek = weekday[date_object.getDay()];

      artists.push(artist);
    });

    await browser.close();

    /*
    await goToEventbrite(artists).then((res) => {
      artists = res;
    });
*/
    var artists_with_genres = await artists_genres(artists);

    return artists_with_genres.concat(returnedList);
  } catch (err) {
    console.log("Error in TH");
    console.error(err);
  }
}
async function getEB(returnedArtists) {
  try {
    const browser = await puppeteer.launch();

    const page = await browser.newPage();

    await page.goto(url_empty_bottle);

    //await page.screenshot({path : "image.png"})

    const html = await page.evaluate(() => {
      return {
        html: document.documentElement.innerHTML,
      };
    });
    const $ = cheerio.load(html.html);

    const listItems = $(".eb-item");
    var artists = [];

    var returnedList = returnedArtists;

    listItems.each((idx, el) => {
      const artist = {
        name: "",
        id: "",
        date: "",
        dayOfWeek: "",
        venue: "",
        image: "",
        link: "",
        time: "",
        ticketPrice: "",
        genres: [],
      };

      artist.link = $(el).children().find("a").attr("href");
      artist.time = $(el).children().find(".start-time").text().trim();
      artist.venue = "Empty Bottle";
      artist.id = idx + returnedList.length + 100;
      artist.name = $(el).children().find(".title").text().trim();
      var date_string = $(el).children().find(".date").text().trim();

      date_string += ", 2023";

      artist.image = $(el)
        .children()
        .find(".item-image-inner")
        .attr("style")
        .replace("background-image:url(", "")
        .replace(");", "");
      var date_object = new Date(date_string);
      artist.date = date_string;
      artist.dayOfWeek = weekday[date_object.getDay()];

      artists.push(artist);
    });

    await browser.close();

    /*
    await goToEventbrite(artists).then((res) => {
      artists = res;
    });
  */
    var artists_with_genres = await artists_genres(artists);
    return artists_with_genres.concat(returnedList);
  } catch (err) {
    console.log("Error in EB");
    console.error(err);
  }
}

async function getMetro(returnedArtists) {
  try {
    // Fetch HTML of the page we want to scrape
    const res = await axios.get(url_metro);
    // Load HTML we fetched in the previous line
    const $ = cheerio.load(res.data);
    var artists = [];
    var returnedList = returnedArtists;
    const listItems = $(".rhpSingleEvent");
    // Use .each method to loop through the li we selected
    listItems.each((idx, el) => {
      const artist = {
        name: "",
        id: "",
        date: "",
        dayOfWeek: "",
        venue: "",
        image: "",
        link: "",
        time: "",
        ticketPrice: "",
        genres: [],
      };
      // console.log($(el).children().find(".rhp-event-thumb").children("a").attr("title"))
      artist.id = idx + returnedList.length + 6;
      artist.name = $(el)
        .children()
        .find(".rhp-event-thumb")
        .children("a")
        .attr("title");
      artist.venue = "Metro";
      artist.link = $(el)
        .children()
        .find(".rhp-event-thumb")
        .children("a")
        .attr("href");
      artist.image = $(el)
        .children()
        .find(".rhp-event-thumb")
        .find(".eventListImage")
        .attr("src");
      artist.time = $(el).children().find(".eventDoorStartDate").text().trim();
      var date_string = $(el)
        .children("div")
        .find(".singleEventDate")
        .text()
        .trim();

      artist.ticketPrice = $(el).children().find(".eventCost").text().trim();

      date_string += ", 2023";

      var date_object = new Date(date_string);
      artist.date = date_string;
      artist.dayOfWeek = weekday[date_object.getDay()];
      // console.log(artist)
      artists.push(artist);
    });
    var artists_with_genres = await artists_genres(artists);
    return artists_with_genres.concat(returnedList);
  } catch (err) {
    console.error(err);
  }
}
async function getSV(returnedArtists) {
  try {
    const res = await axios.get(url_sv);
    // Load HTML we fetched in the previous line
    const $ = cheerio.load(res.data);
    var artists = [];
    var returnedList = returnedArtists;
    const listItems = $(".rhpSingleEvent");
    // Use .each method to loop through the li we selected
    listItems.each((idx, el) => {
      const artist = {
        name: "",
        id: "",
        date: "",
        dayOfWeek: "",
        venue: "",
        image: "",
        link: "",
        time: "",
        ticketPrice: "",
        genres: [],
      };
      // console.log($(el).children().find(".rhp-event-thumb").children("a").attr("title"))
      artist.id = idx + returnedList.length + 3;
      artist.name = $(el)
        .children()
        .find(".rhp-event-thumb")
        .children("a")
        .attr("title");
      artist.venue = "Sleeping Village";
      artist.link = $(el)
        .children()
        .find(".rhp-event-thumb")
        .children("a")
        .attr("href");
      artist.image = $(el)
        .children()
        .find(".rhp-event-thumb")
        .find(".eventListImage")
        .attr("src");
      artist.time = $(el).children().find(".eventDoorStartDate").text().trim();
      var date_string = $(el)
        .children("div")
        .find(".singleEventDate")
        .text()
        .trim();

      artist.ticketPrice = $(el).children().find(".eventCost").text().trim();

      date_string += ", 2023";

      var date_object = new Date(date_string);
      artist.date = date_string;
      artist.dayOfWeek = weekday[date_object.getDay()];
      artists.push(artist);
    });
    //console.log("SV Events: " + artists)
    var artists_with_genres = await artists_genres(artists);
    return artists_with_genres.concat(returnedList);
  } catch (err) {
    console.log("Error in SV");
    console.error(err);
  }
}
async function getHO(returnedArtists) {
  try {
    const { data } = await axios.get(url_hideout);

    const $ = cheerio.load(data);

    var artists = [];
    var returnedList = returnedArtists;

    const listItems = $(".rhpSingleEvent");

    listItems.each((idx, el) => {
      const artist = {
        name: "",
        id: "",
        date: "",
        dayOfWeek: "",
        venue: "",
        image: "",
        link: "",
        time: "",
        ticketPrice: "",
        genres: [],
      };
      artist.id = idx + returnedList.length + 11;
      artist.name = $(el).children().find("#eventTitle").text().trim();
      var date_string = $(el).children().find("#eventDate").text().trim();
      artist.date = date_string.substring(5, date_string.length);
      artist.time = $(el)
        .children()
        .find(".eventDoorStartDate")
        .children("span")
        .text()
        .trim();
      var date_object = new Date(date_string.substring(5, date_string.length));
      artist.dayOfWeek = weekday[date_object.getDay()];
      artist.image = $(el).children().find(".eventListImage").attr("src");
      artist.link = $(el).children().find(".on-sale").find("a").attr("href");
      artist.venue = "The Hideout";

      artists.push(artist);
    });
    /*
    await goToNestedHO(artists).then((res) => {
      artists = res;
    });
    */
    var artists_with_genres = await artists_genres(artists);
    return artists_with_genres.concat(returnedList);
  } catch (err) {
    console.error(err);
  }
}

async function getJam(returnedArtists) {
  try {
    const browser = await puppeteer.launch({ headless: true });

    const page = await browser.newPage();

    await page.goto("https://www.jamusa.com/events", {
      waitUntil: "networkidle0",
    });

    //await page.screenshot({path : "image.png"})

    const results = await page.evaluate(() => {
      return {
        html: document.querySelector("*").outerHTML,
      };
    });
    const $2 = cheerio.load(results.html);

    var returnedList = returnedArtists;
    var artists = [];

    var sumbit = await page.$(".eventList__showMore");

    await sumbit.evaluate((b) => b.click());
    console.log("Jam Productions Button Pushed");
    await page.waitForTimeout(1000);

    sumbit = await page.$(".eventList__showMore");

    await sumbit.evaluate((b) => b.click());
    console.log("Jam Productions Button Pushed");
    await page.waitForTimeout(1000);

    sumbit = await page.$(".eventList__showMore");

    await sumbit.evaluate((b) => b.click());

    await page.waitForTimeout(1000);

    sumbit = await page.$(".eventList__showMore");

    await sumbit.evaluate((b) => b.click());
    console.log("Jam Productions Button Pushed");
    await page.waitForTimeout(1000);

    sumbit = await page.$(".eventList__showMore");

    await sumbit.evaluate((b) => b.click());
    console.log("Jam Productions Button Pushed");
    await page.waitForTimeout(1000);

    const results2 = await page.evaluate(() => {
      return {
        html: document.querySelector("*").outerHTML,
      };
    });

    const $ = cheerio.load(results2.html);

    const listItems = $(".eventItem");
    // Use .each method to loop through the li we selected
    listItems.each((idx, el) => {
      const artist = {
        name: "",
        id: "",
        date: "",
        dayOfWeek: "",
        venue: "",
        image: "",
        link: "",
        time: "",
        ticketPrice: "",
      };
      // console.log($(el).children().find(".rhp-event-thumb").children("a").attr("title"))
      artist.id = idx + artists.length + 3;
      artist.name = $(el).children().find(".title").text().trim();
      artist.venue = $(el).children().find(".location").text().trim();
      artist.link = $(el).children().find(".title").children("a").attr("href");
      artist.image = $(el).children().find("img").attr("src");
      artist.time = $(el).children().find(".time").text().trim();

      artist.date = $(el).children().find(".date").attr("aria-label");

      var date_object = new Date(artist.date);
      artist.dayOfWeek = weekday[date_object.getDay()];

      if (
        artist.venue == "Park West" ||
        artist.venue == "Bottom Lounge" ||
        artist.venue == "The VIC Theatre" ||
        artist.venue == "Riviera Theatre" ||
        artist.venue == "Byline Bank Aragon Ballroom"
      )
        artists.push(artist);
    });
    await browser.close();
    var artists_with_genres = await artists_genres(artists);
    return artists_with_genres.concat(returnedList);
  } catch (err) {
    console.error(err);
  }
}

async function getBK(returnedArtists) {
  try {
    const browser = await puppeteer.launch({ headless: true });

    const page = await browser.newPage();

    var returnedList = returnedArtists;
    var artists = [];

    for (var i = 0; i <= 6; i++) {
      await page.goto("https://www.beatkitchen.com/calendar/?twpage=" + i);

      const html = await page.evaluate(() => {
        return {
          html: document.documentElement.innerHTML,
        };
      });
      const $ = cheerio.load(html.html);

      const listItems = $(".tw-section");

      listItems.each((idx, el) => {
        const artist = {
          name: "",
          id: "",
          date: "",
          dayOfWeek: "",
          venue: "",
          image: "",
          link: "",
          time: "",
          ticketPrice: "",
          genres: [],
        };

        artist.link = $(el).children().find("a").attr("href");
        artist.time = $(el).children().find(".tw-event-time").text().trim();
        artist.venue = "Beat Kitchen";
        artist.id = idx + artists.length + 3;
        artist.name = $(el).children().find(".tw-name").text().trim();
        artist.date = $(el).children().find(".tw-event-date").text().trim();

        artist.image = $(el)
          .children()
          .find(".tw-image")
          .find("img")
          .attr("src");
        var date_object = new Date(artist.date);

        artist.dayOfWeek = weekday[date_object.getDay()];

        artists.push(artist);
      });
    }

    await browser.close();
    var artists_with_genres = await artists_genres(artists);
    return artists_with_genres.concat(returnedList);
  } catch (err) {
    console.log("Error in BK");
    console.error(err);
  }
}

async function goToEventbrite(artists) {
  var n_artists = [];
  console.log("Start Eventbrite");
  try {
    for (var x in artists) {
      var n_artist = artists[x];
      const { data } = await axios.get(artists[x].link);
      const $ = cheerio.load(data);
      const item = $(".js-panel-display-price");
      var price = "";
      item.each((idx, el) => {
        price = $(el).text().trim();
        n_artist.ticketPrice = price;
      });
      console.log(n_artist);
      n_artists.push(n_artist);
    }
  } catch (err) {
    console.log(err);
  }
  return n_artists;
}

async function goToNestedSBLH(artists) {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  var n_artists = [];
  console.log("Start Nested SBLH");
  try {
    for (var x in artists) {
      var n_artist = artists[x];
      await page.goto(artists[x].link);
      const html = await page.evaluate(() => {
        return {
          html: document.documentElement.innerHTML,
        };
      });

      const $ = cheerio.load(html.html);
      const item = $(".ticket-type-row");
      var price = "";
      item.each((idx, el) => {
        console.log($(el).children().find("span").text());
        price = $(el).children().find("span").text().replace("S", " S");
        n_artist.ticketPrice = price;
        console.log(n_artist);
      });
      n_artists.push(n_artist);
      await page.goBack();
    }
  } catch (err) {
    console.log(err);
  }
  await browser.close();
  return n_artists;
}

async function goToNestedHO(artists) {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  var n_artists = [];
  console.log("Start Nested HO");
  try {
    for (var x in artists) {
      var n_artist = artists[x];
      await page.goto(artists[x].link);
      const html = await page.evaluate(() => {
        return {
          html: document.documentElement.innerHTML,
        };
      });

      // Load HTML we fetched in the previous line
      const $ = cheerio.load(html.html);
      const item = $(".ticket-info");
      var price = "";
      item.each((idx, el) => {
        price = $(el)
          .children()
          .find("span")
          .first()
          .text()
          .replace("*", "")
          .trim();
        n_artist.ticketPrice = price;
        n_artists.push(n_artist);
        console.log(n_artist);
      });
      await page.goBack();
    }
  } catch (err) {
    console.log(err);
  }
  await browser.close();
  return n_artists;
}
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

    await page.goto(url_sub, { waitUntil: "networkidle0" });
    await page.waitForSelector(".tw-name", {
      visible: true,
    });

    const results = await page.evaluate(() => {
      return {
        html: document.querySelector("*").innerHTML,
      };
    });

    const $ = cheerio.load(results.html);

    var artists = returnedArtists;

    const listItems = $(".tw-cal-event");

    listItems.each((idx, el) => {
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
      artist.name = $(el).children().find(".tw-name").text().trim();
      artist.date = $(el).children().find(".tw-date").children().last().text();
      var date = new Date(artist.date);
      var day = weekday[date.getDay()];
      artist.dayOfWeek = day;
      artist.image = $(el)
        .children()
        .find(".tw-image")
        .children()
        .first()
        .children()
        .first()
        .attr("src");
      artist.link = $(el)
        .children()
        .find(".tw-name")
        .children()
        .first()
        .attr("href");
      artist.time = $(el)
        .children()
        .find(".tw-event-time-complete")
        .children()
        .first()
        .text();
      artist.venue = "Subterranean";
      artists.push(artist);
    });
    await browser.close();
    var final_artists_list = await artists_genres(artists);

    return final_artists_list;
  } catch (err) {
    console.log(err);
  }
}

// Async function which scrapes the data
async function scrapeConcertData() {
  try {
    var result = await getSBLH()
      .then((res) => {
        return getMetro(res);
      })
      .then((res) => {
        return getHO(res);
      })
      .then((res) => {
        return getJam(res);
      })
      .then((res) => {
        return getSub(res);
      })
      .then((res) => {
        return getBK(res);
      })
      .then((res) => {
        return getSV(res);
      })
      .catch((err) => {
        console.log(err);
      });

    // var res2 = await getHO(res);

    var res2 = await getTH(result);
    var res3 = await getEB(res2);

    setTimeout(() => {
      console.log("Waiting");
    }, 1000);

    //var result3 = await getTH(result2);

    return res3;
    // return artists4;
  } catch (err) {
    console.log(err);
  }
}

module.exports.scrapeConcertData = scrapeConcertData;

//console.log(data);
