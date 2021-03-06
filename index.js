const functions = require("firebase-functions");
const express = require("express");
const bodyParser = require("body-parser");
const {
  spotifyGetAccessToken,
  spotifyGetRecentTracks,
  spotifyRefreshAccessToken,
  similarSongs,
} = require("./spotify.js");

const {
  fitbitGetAccessToken,
  fitbitGetMap,
  fitbitRefreshAccessToken,
  fitbitRevokeAccess,
} = require("./fitbit.js");

const { main } = require("./scraper.js");

var cors = require("cors");
const { deleteAccount } = require("./misc.js");
const { json } = require("./tcx.js");

const app = express();

// let corsOptions = {
//   origin: "https://musicmakesyourunfaster.firebaseapp.com",
//   optionsSuccessStatus: 200,
// };

app.use(cors());

app.get("/timestamp", (request, response) => {
  response.send(`${Date.now()}`);
});

// SPOTIFY CALLS
app.post("/api/spotify/user-auth", async (req, res) => {
  ////console.log(req.body.code, req.body.userId);
  let r = await spotifyGetAccessToken(req.body.code, req.body.userId);
  ////console.log(r);
  res.send(r);
});

app.post("/api/spotify/grab-songs", async (req, res) => {
  ////console.log(req.body);
  let response = await spotifyRefreshAccessToken(req.body.refresh_token);
  if (!response["access_token"]) {
    res.send("error");
  }
  let returnVal = await spotifyGetRecentTracks(response["access_token"]);
  res.send(JSON.stringify({ data: returnVal }));
});

// FITBIT CALLS
app.post("/api/fitbit/user-auth", async (req, res) => {
  let access = await fitbitGetAccessToken(req.body.code);

  res.send(access);
});

app.post("/api/fitbit/map", async (req, res) => {
  let response = await fitbitRefreshAccessToken(req.body.refresh_token);
  if (!response["access_token"]) {
    res.send("error");
  }
  let map = await fitbitGetMap(response["access_token"], response["user_id"]);
  res.send({ run_map: map });
});

app.post("/api/fitbit/revoke", async (req, res) => {
  ////console.log(req.body);
  let access_token = await fitbitRefreshAccessToken(req.body.refresh_token);
  if (!access_token["access_token"]) {
    ////console.log("sending error...");
    res.send("error");
  }
  let response = await fitbitRevokeAccess(
    access_token["access_token"],
    req.body.refresh_token
  );
  return 100;
});

app.post("/api/spotify/refresh", async (req, res) => {
  ////console.log(req.body.refresh_token);
  let r = await spotifyRefreshAccessToken(req.body.refresh_token);
  if (!r["access_token"]) {
    ////console.log("sending error...");
    res.send("error");
  }
  res.send(r["access_token"]);
});

app.get("/hello-world", async (req, res) => {
  res.send("Hello, baby!");
});

app.get("/test-create-account", async (req, res) => {
  let x = await main();
  ////console.log("Sending the response aren't i ");
  res.send(JSON.stringify({ data: x }));
});

app.get("/test-delete", async (req, res) => {
  let x = await deleteAccount();
  ////console.log("Sending the response aren't i ");
  res.send("hello");
});

app.post("/api/spotify/similar", async (req, res) => {
  // //console.log(req.body.data);
  // //console.log(req.body);
  let response = await spotifyRefreshAccessToken(req.body.refreshToken);
  if (!response["access_token"]) {
    res.send("error");
  }
  let returnVal = await similarSongs(response["access_token"], req.body);

  res.send(
    JSON.stringify({ data: returnVal, token: response["access_token"] })
  );
});

const runtimeOpts = {
  timeoutSeconds: 300,
  memory: "1GB",
};

exports.app = functions
  .runWith(runtimeOpts)
  .region("europe-west2")
  .https.onRequest(app);
