const functions = require("firebase-functions");
const express = require("express");
const bodyParser = require("body-parser");
const {
  spotifyGetAccessToken,
  spotifyGetRecentTracks,
  spotifyRefreshAccessToken,
} = require("./spotify.js");

const {
  fitbitGetAccessToken,
  fitbitGetMap,
  fitbitRefreshAccessToken,
} = require("./fitbit.js");
var cors = require("cors");
const app = express();
app.use(cors({ origin: "*" }));

app.get("/timestamp", (request, response) => {
  response.send(`${Date.now()}`);
});

// SPOTIFY CALLS
app.post("/api/spotify/user-auth", async (req, res) => {
  console.log(req.body.code, req.body.userId);
  let r = await spotifyGetAccessToken(req.body.code, req.body.userId);
  console.log(r);
  res.send(r);
});

app.post("/api/spotify/grab-songs", async (req, res) => {
  console.log(req.body);
  let response = await spotifyRefreshAccessToken(req.body.refresh_token);
  if (!response["access_token"]) {
    res.send("error");
  }
  let returnVal = await spotifyGetRecentTracks(response["access_token"]);
  res.send(JSON.stringify({ data: returnVal }));
});

// FITBIT CALLS
app.post("/api/fitbit/user-auth", async (req, res) => {
  console.log(req.body.code);
  let r = await fitbitGetAccessToken(req.body.code);
  console.log("Custom Auth code... " + r);

  res.send(r);
});

app.post("/api/fitbit/map", async (req, res) => {
  console.log(req.body.refresh_token);
  let response = await fitbitRefreshAccessToken(req.body.refresh_token);
  if (!response["access_token"]) {
    console.log("sending error...");
    res.send("error");
  }
  console.log("Got access token ", response["access_token"]);
  console.log("sending it off to get map....");
  let map = await fitbitGetMap(response["access_token"], response["user_id"]);
  console.log("sending map");
  res.send({ run_map: map });
});

app.post("/api/spotify/refresh", async (req, res) => {
  console.log(req.body.refresh_token);
  let r = await spotifyRefreshAccessToken(req.body.refresh_token);
  if (!r["access_token"]) {
    console.log("sending error...");
    res.send("error");
  }
  res.send(r["access_token"]);
});

app.get("/hello-world", async (req, res) => {
  res.send("Hello, baby!");
});

exports.app = functions.region("europe-west2").https.onRequest(app);
